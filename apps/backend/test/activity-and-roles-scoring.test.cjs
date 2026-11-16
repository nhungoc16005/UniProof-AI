const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require(path.join(__dirname, '../node_modules/ts-node')).register({
  project: path.join(__dirname, '../tsconfig.json'),
});

const { ActivityParticipantStatus, EvidenceStatus, Role } = require('@prisma/client');

// ============================================================================
// TEST SUITE: ĐỢT 8 — BL-005, BL-014
// ============================================================================

describe('BL-005: Bộ tổng hợp nguồn hoạt động chung (Activity Aggregator)', () => {
  const {
    aggregateStudentActivitySources,
    recomputeAndSaveActivityCriterion,
  } = require('../src/activities/activity-aggregator');

  function createMockDb({
    criterion,
    attendances = [],
    existingAssessment = null,
    evidences = [],
  }) {
    let savedAssessment = existingAssessment;

    const tx = {
      criterion: {
        findUniqueOrThrow: async ({ where }) => {
          if (where.id === criterion.id) return criterion;
          throw new Error('Not found criterion');
        },
      },
      activityParticipant: {
        findMany: async ({ where }) => {
          return attendances.filter((a) => {
            if (where.studentId && a.studentId !== where.studentId) return false;
            if (where.status && a.status !== where.status) return false;
            return true;
          });
        },
      },
      criterionAssessment: {
        findUnique: async () => savedAssessment,
        upsert: async ({ create, update }) => {
          if (!savedAssessment) {
            savedAssessment = { id: 'crit-assess-1', ...create };
          } else {
            savedAssessment = { ...savedAssessment, ...update };
          }
          return savedAssessment;
        },
        update: async ({ data }) => {
          savedAssessment = { ...savedAssessment, ...data };
          return savedAssessment;
        },
      },
      evidence: {
        findMany: async () => evidences,
      },
    };

    return { tx, getSavedAssessment: () => savedAssessment };
  }

  const standardActivityCriterion = {
    id: 'crit-act-9',
    maxScore: 10,
    scoringConfig: {
      kind: 'activity_threshold',
      requiredData: ['verifiedActivityCount'],
      cheerleaderMultiplier: 0.5,
      tiers: [
        { min: 1, score: 5 },
        { min: 2, score: 7 },
        { min: 3, score: 10 },
      ],
    },
    rolesScore: null,
  };

  test('Ca 1: Cùng activityId có cả Attendance CONFIRMED và Evidence APPROVED -> Gộp thành 1 hoạt động (không đếm 2 lần)', async () => {
    const { tx } = createMockDb({
      criterion: standardActivityCriterion,
      attendances: [
        { id: 'att-1', activityId: 'act-shared-1', studentId: 'student-1', formRole: 'PARTICIPANT', status: ActivityParticipantStatus.CONFIRMED },
      ],
      existingAssessment: {
        id: 'assess-1',
        studentId: 'student-1',
        termId: 'term-1',
        criterionId: 'crit-act-9',
        verifiedData: {},
      },
      evidences: [
        { id: 'evi-1', activityId: 'act-shared-1', studentId: 'student-1', declaredRole: 'PARTICIPANT', status: EvidenceStatus.APPROVED },
      ],
    });

    const res = await aggregateStudentActivitySources(tx, {
      studentId: 'student-1',
      termId: 'term-1',
      criterionId: 'crit-act-9',
    });

    assert.equal(res.verifiedDataUpdates.verifiedActivityCount, 1, 'Cùng activityId phải được gộp thành 1 nguồn duy nhất');
    assert.equal(res.hasRoleConflict, false);
    assert.equal(res.hasUnresolvedEvidence, false);
    assert.equal(res.evaluation.status, 'READY_FOR_REVIEW');
    assert.equal(res.evaluation.suggestedScore, 5, '1 hoạt động đạt bậc 1 -> 5 điểm');
  });

  test('Ca 2: Minh chứng độc lập không gắn activityId -> Được nhận diện riêng bằng evidence.id', async () => {
    const { tx } = createMockDb({
      criterion: standardActivityCriterion,
      attendances: [
        { id: 'att-1', activityId: 'act-1', studentId: 'student-1', formRole: 'PARTICIPANT', status: ActivityParticipantStatus.CONFIRMED },
      ],
      existingAssessment: {
        id: 'assess-1',
        studentId: 'student-1',
        termId: 'term-1',
        criterionId: 'crit-act-9',
        verifiedData: {},
      },
      evidences: [
        // Minh chứng tự do không có activityId
        { id: 'evi-custom-1', activityId: null, studentId: 'student-1', declaredRole: 'PARTICIPANT', status: EvidenceStatus.APPROVED },
      ],
    });

    const res = await aggregateStudentActivitySources(tx, {
      studentId: 'student-1',
      termId: 'term-1',
      criterionId: 'crit-act-9',
    });

    assert.equal(res.verifiedDataUpdates.verifiedActivityCount, 2, '1 attendance + 1 minh chứng độc lập = 2 hoạt động');
    assert.equal(res.evaluation.suggestedScore, 7, '2 hoạt động đạt bậc 2 -> 7 điểm');
  });

  test('Ca 3: Cùng activityId có Attendance và Evidence -> Ưu tiên vai trò từ Attendance CONFIRMED', async () => {
    const communityCriterionWithRoles = {
      id: 'crit-comm-12',
      maxScore: 10,
      scoringConfig: {
        kind: 'community_activity_tier',
        requiredData: ['verifiedActivityCount', 'convertedCommunityPoints'],
        tiers: [
          { minCount: 1, minPoints: 5, score: 5 },
          { minCount: 2, minPoints: 10, score: 7 },
        ],
      },
      rolesScore: {
        PARTICIPANT: 5,
        ORGANIZER: 10,
      },
    };

    const { tx } = createMockDb({
      criterion: communityCriterionWithRoles,
      attendances: [
        // Khoa xác nhận vai trò là PARTICIPANT
        { id: 'att-1', activityId: 'act-1', studentId: 'student-1', formRole: 'PARTICIPANT', status: ActivityParticipantStatus.CONFIRMED },
      ],
      existingAssessment: {
        id: 'assess-1',
        studentId: 'student-1',
        termId: 'term-1',
        criterionId: 'crit-comm-12',
      },
      evidences: [
        // Sinh viên khai báo là ORGANIZER nhưng Khoa điểm danh là PARTICIPANT
        { id: 'evi-1', activityId: 'act-1', studentId: 'student-1', declaredRole: 'ORGANIZER', status: EvidenceStatus.APPROVED },
      ],
    });

    const res = await aggregateStudentActivitySources(tx, {
      studentId: 'student-1',
      termId: 'term-1',
      criterionId: 'crit-comm-12',
    });

    assert.equal(res.verifiedDataUpdates.verifiedActivityCount, 1);
    // Điểm quy đổi phải theo vai trò PARTICIPANT (5 điểm) của attendance, không phải ORGANIZER (10 điểm)
    assert.equal(res.verifiedDataUpdates.convertedCommunityPoints, 5, 'Phải ưu tiên vai trò PARTICIPANT từ attendance');
  });

  test('Ca 4: Không có Attendance, có nhiều Evidence APPROVED cùng activityId nhưng mâu thuẫn vai trò -> Báo blocker NEEDS_VERIFICATION', async () => {
    const communityCriterionWithRoles = {
      id: 'crit-comm-12',
      maxScore: 10,
      scoringConfig: {
        kind: 'community_activity_tier',
        requiredData: ['verifiedActivityCount', 'convertedCommunityPoints'],
        tiers: [{ minCount: 1, minPoints: 5, score: 5 }],
      },
      rolesScore: { PARTICIPANT: 5, ORGANIZER: 10 },
    };

    const { tx } = createMockDb({
      criterion: communityCriterionWithRoles,
      attendances: [], // Không có attendance
      existingAssessment: {
        id: 'assess-1',
        studentId: 'student-1',
        termId: 'term-1',
        criterionId: 'crit-comm-12',
      },
      evidences: [
        { id: 'evi-1', activityId: 'act-conflict', studentId: 'student-1', declaredRole: 'PARTICIPANT', status: EvidenceStatus.APPROVED },
        { id: 'evi-2', activityId: 'act-conflict', studentId: 'student-1', declaredRole: 'ORGANIZER', status: EvidenceStatus.APPROVED },
      ],
    });

    const res = await aggregateStudentActivitySources(tx, {
      studentId: 'student-1',
      termId: 'term-1',
      criterionId: 'crit-comm-12',
    });

    assert.equal(res.hasRoleConflict, true, 'Phát hiện mâu thuẫn vai trò');
    assert.equal(res.evaluation.status, 'NEEDS_VERIFICATION');
    assert.equal(res.evaluation.suggestedScore, null);
    assert(res.evaluation.reason.includes('Mâu thuẫn vai trò'), 'Lý do phải nêu rõ mâu thuẫn vai trò');
  });

  test('Ca 5: Còn minh chứng đang chờ xử lý -> Báo blocker NEEDS_VERIFICATION, suggestedScore: null', async () => {
    const { tx } = createMockDb({
      criterion: standardActivityCriterion,
      attendances: [
        { id: 'att-1', activityId: 'act-1', studentId: 'student-1', formRole: 'PARTICIPANT', status: ActivityParticipantStatus.CONFIRMED },
      ],
      existingAssessment: {
        id: 'assess-1',
        studentId: 'student-1',
        termId: 'term-1',
        criterionId: 'crit-act-9',
      },
      evidences: [
        { id: 'evi-pending', activityId: 'act-2', studentId: 'student-1', declaredRole: 'PARTICIPANT', status: EvidenceStatus.NEEDS_HUMAN_REVIEW },
      ],
    });

    const res = await aggregateStudentActivitySources(tx, {
      studentId: 'student-1',
      termId: 'term-1',
      criterionId: 'crit-act-9',
    });

    assert.equal(res.hasUnresolvedEvidence, true);
    assert.equal(res.evaluation.status, 'NEEDS_VERIFICATION');
    assert.equal(res.evaluation.suggestedScore, null);
    assert(res.evaluation.reason.includes('Còn minh chứng đang chờ xử lý'));
  });

  test('Ca 6: recomputeAndSaveActivityCriterion vô hiệu hóa officialScore cũ khi căn cứ thay đổi', async () => {
    const { tx, getSavedAssessment } = createMockDb({
      criterion: standardActivityCriterion,
      attendances: [
        { id: 'att-1', activityId: 'act-1', studentId: 'student-1', formRole: 'PARTICIPANT', status: ActivityParticipantStatus.CONFIRMED },
      ],
      existingAssessment: {
        id: 'assess-1',
        studentId: 'student-1',
        termId: 'term-1',
        criterionId: 'crit-act-9',
        verifiedData: { verifiedActivityCount: 1 },
        officialScore: 5,
        officialReason: 'Cán bộ đã chốt',
        finalizedAt: new Date(),
        finalReviewerId: 'officer-1',
      },
      evidences: [],
    });

    await recomputeAndSaveActivityCriterion(tx, {
      studentId: 'student-1',
      termId: 'term-1',
      criterionId: 'crit-act-9',
    });

    const updated = getSavedAssessment();
    assert.equal(updated.officialScore, null, 'officialScore cũ phải bị vô hiệu hóa (null)');
    assert.equal(updated.officialReason, null);
    assert.equal(updated.finalizedAt, null);
    assert.equal(updated.finalReviewerId, null);
    assert.equal(updated.suggestedScore, 5);
  });
});

describe('BL-014: Lưu và sử dụng rolesScore xuyên suốt Rubric & Round-trip CriteriaService', () => {
  const { CriteriaService, validateScoringConfig } = require('../src/criteria/criteria.service');
  const { BadRequestException, NotFoundException } = require('@nestjs/common');
  const { DUT_RUBRIC_CRITERIA } = require('../src/criteria/dut-rubric');
  const { aggregateStudentActivitySources } = require('../src/activities/activity-aggregator');

  test('Ca 1 (DEC-009): Tiêu chí 12 trong DUT_RUBRIC_CRITERIA không tự gán mặc định rolesScore (giữ nguyên rubric hiện hành)', () => {
    const crit12 = DUT_RUBRIC_CRITERIA.find((c) => c.code === '12');
    assert(crit12, 'Phải có tiêu chí 12');
    assert.equal(crit12.rolesScore ?? null, null, 'DEC-009 cấm tự thêm mức 5/7/2.5 vào DUT_RUBRIC_CRITERIA');
  });

  test('Ca 2: rolesScore thiếu vai trò CHEERLEADER -> aggregateStudentActivitySources báo blocker NEEDS_VERIFICATION, không fallback', async () => {
    const communityCriterionMissingCheerleader = {
      id: 'crit-12-missing-cheerleader',
      maxScore: 10,
      scoringConfig: {
        kind: 'community_activity_tier',
        requiredData: ['verifiedActivityCount', 'convertedCommunityPoints'],
        tiers: [{ minCount: 1, minPoints: 5, score: 5 }],
      },
      rolesScore: {
        PARTICIPANT: 5,
        ORGANIZER: 7,
        // Thiếu CHEERLEADER / CO_VU
      },
    };

    const mockTx = {
      criterion: { findUniqueOrThrow: async () => communityCriterionMissingCheerleader },
      activityParticipant: {
        findMany: async () => [
          { id: 'att-1', activityId: 'act-1', studentId: 'student-1', formRole: 'CO_VU', status: 'CONFIRMED' },
        ],
      },
      criterionAssessment: { findUnique: async () => null },
      evidence: { findMany: async () => [] },
    };

    const res = await aggregateStudentActivitySources(mockTx, {
      studentId: 'student-1',
      termId: 'term-1',
      criterionId: 'crit-12-missing-cheerleader',
    });

    assert.equal(res.evaluation.status, 'NEEDS_VERIFICATION', 'Không được fallback sang 0 hay PARTICIPANT khi thiếu rate CHEERLEADER');
    assert.equal(res.evaluation.suggestedScore, null);
    assert(res.evaluation.reason.includes('thiếu cấu hình điểm'));
  });

  test('Ca 3: validateScoringConfig chấp nhận rolesScore hợp lệ cho community_activity_tier', () => {
    assert.doesNotThrow(() => {
      validateScoringConfig('12', 10, {
        kind: 'community_activity_tier',
        requiredData: ['verifiedActivityCount', 'convertedCommunityPoints'],
        tiers: [{ minCount: 1, minPoints: 5, score: 5 }],
        rolesScore: {
          PARTICIPANT: 5,
          ORGANIZER: 7,
          CHEERLEADER: 2.5,
        },
      });
    });
  });

  test('Ca 4: validateScoringConfig từ chối rolesScore chứa điểm số âm', () => {
    assert.throws(
      () => {
        validateScoringConfig('12', 10, {
          kind: 'community_activity_tier',
          requiredData: ['verifiedActivityCount', 'convertedCommunityPoints'],
          tiers: [{ minCount: 1, minPoints: 5, score: 5 }],
          rolesScore: {
            PARTICIPANT: -2, // Không hợp lệ
          },
        });
      },
      (err) => {
        assert(err instanceof BadRequestException);
        assert(err.message.includes('rolesScore không hợp lệ'));
        return true;
      }
    );
  });

  test('Ca 5: Tiêu chí cộng đồng tính đúng điểm theo rolesScore cấu hình', async () => {
    const communityCriterion = {
      id: 'crit-12-roles',
      maxScore: 10,
      scoringConfig: {
        kind: 'community_activity_tier',
        requiredData: ['verifiedActivityCount', 'convertedCommunityPoints'],
        tiers: [
          { minCount: 1, minPoints: 5, score: 5 },
          { minCount: 2, minPoints: 10, score: 7 },
          { minCount: 3, minPoints: 15, score: 10 },
        ],
      },
      rolesScore: {
        PARTICIPANT: 5,
        ORGANIZER: 7,
        CHEERLEADER: 2.5,
      },
    };

    const mockTx = {
      criterion: { findUniqueOrThrow: async () => communityCriterion },
      activityParticipant: {
        findMany: async () => [
          { id: 'att-1', activityId: 'act-1', studentId: 'student-1', formRole: 'PARTICIPANT', status: 'CONFIRMED' },
          { id: 'att-2', activityId: 'act-2', studentId: 'student-1', formRole: 'ORGANIZER', status: 'CONFIRMED' },
        ],
      },
      criterionAssessment: { findUnique: async () => null },
      evidence: { findMany: async () => [] },
    };

    const res = await aggregateStudentActivitySources(mockTx, {
      studentId: 'student-1',
      termId: 'term-1',
      criterionId: 'crit-12-roles',
    });

    // 1 PARTICIPANT (5đ) + 1 ORGANIZER (7đ) = 12đ cộng đồng; 2 hoạt động
    assert.equal(res.verifiedDataUpdates.verifiedActivityCount, 2);
    assert.equal(res.verifiedDataUpdates.convertedCommunityPoints, 12);
    // Bậc 2: minCount: 2, minPoints: 10 -> score: 7 điểm
    assert.equal(res.evaluation.status, 'READY_FOR_REVIEW');
    assert.equal(res.evaluation.suggestedScore, 7);
  });

  test('Ca 6: Tiêu chí community_activity_tier thiếu rolesScore trong rubric -> Báo blocker NEEDS_VERIFICATION', async () => {
    const communityCriterionMissingRoles = {
      id: 'crit-12-missing',
      maxScore: 10,
      scoringConfig: {
        kind: 'community_activity_tier',
        requiredData: ['verifiedActivityCount', 'convertedCommunityPoints'],
        tiers: [{ minCount: 1, minPoints: 5, score: 5 }],
      },
      rolesScore: null, // Thiếu rolesScore
    };

    const mockTx = {
      criterion: { findUniqueOrThrow: async () => communityCriterionMissingRoles },
      activityParticipant: {
        findMany: async () => [
          { id: 'att-1', activityId: 'act-1', studentId: 'student-1', formRole: 'PARTICIPANT', status: 'CONFIRMED' },
        ],
      },
      criterionAssessment: { findUnique: async () => null },
      evidence: { findMany: async () => [] },
    };

    const res = await aggregateStudentActivitySources(mockTx, {
      studentId: 'student-1',
      termId: 'term-1',
      criterionId: 'crit-12-missing',
    });

    assert.equal(res.evaluation.status, 'NEEDS_VERIFICATION');
    assert.equal(res.evaluation.suggestedScore, null);
    assert(res.evaluation.reason.includes('chưa cấu hình bảng điểm vai trò rolesScore'));
  });

  test('Ca 7: Round-trip CriteriaService — Cập nhật draft -> Đọc getTermRubric -> Sao chép createTerm bảo toàn 100% rolesScore', async () => {
    const terms = [
      {
        id: 'term-src',
        code: '2026_HK1',
        name: 'Học kỳ 1 2026-2027',
        status: 'UPCOMING',
        startDate: new Date('2026-09-01'),
        endDate: new Date('2027-01-15'),
        submissionDeadline: new Date('2026-10-01'),
        reviewDeadline: new Date('2026-10-15'),
        appealDeadline: new Date('2026-10-25'),
      },
    ];

    let rubricVersions = [
      {
        id: 'ver-src',
        termId: 'term-src',
        version: 1,
        status: 'DRAFT',
        source: 'INIT',
      },
    ];

    let rubricCategories = [];
    let criteria = [];
    const auditLogs = [];

    const mockTx = {
      term: {
        findUnique: async ({ where }) => terms.find((t) => (where.id ? t.id === where.id : t.code === where.code)),
        create: async ({ data }) => {
          const t = { id: `term-new-${terms.length + 1}`, ...data };
          terms.push(t);
          return t;
        },
      },
      rubricVersion: {
        findFirst: async ({ where }) => rubricVersions.filter((v) => v.termId === where.termId).pop() || null,
        findUniqueOrThrow: async ({ where }) => rubricVersions.find((v) => v.id === where.id),
        create: async ({ data }) => {
          const v = { id: `ver-${rubricVersions.length + 1}`, ...data };
          rubricVersions.push(v);
          return v;
        },
        update: async ({ where, data }) => {
          const v = rubricVersions.find((item) => item.id === where.id);
          if (v) Object.assign(v, data);
          return v;
        },
      },
      rubricCategory: {
        create: async ({ data }) => {
          const cat = { id: `cat-${rubricCategories.length + 1}`, ...data };
          rubricCategories.push(cat);
          return cat;
        },
        deleteMany: async ({ where }) => {
          rubricCategories = rubricCategories.filter((c) => c.rubricVersionId !== where.rubricVersionId);
        },
      },
      criterion: {
        createMany: async ({ data }) => {
          for (const item of data) {
            criteria.push({ id: `crit-${criteria.length + 1}`, ...item });
          }
        },
        findMany: async ({ where }) => criteria.filter((c) => c.rubricVersionId === where.rubricVersionId),
        deleteMany: async ({ where }) => {
          criteria = criteria.filter((c) => c.rubricVersionId !== where.rubricVersionId);
        },
      },
      aiSuggestion: { updateMany: async () => ({ count: 0 }) },
      review: { updateMany: async () => ({ count: 0 }) },
      auditLog: {
        create: async ({ data }) => {
          auditLogs.push(data);
          return { id: `audit-${auditLogs.length}`, ...data };
        },
      },
    };

    const mockPrisma = {
      ...mockTx,
      $transaction: async (fn) => fn(mockTx),
      term: {
        findUnique: async ({ where }) => terms.find((t) => (where.id ? t.id === where.id : t.code === where.code)),
      },
      rubricVersion: {
        findFirst: async ({ where }) => {
          const v = rubricVersions.filter((ver) => ver.termId === where.termId && (where.status ? ver.status === where.status : true)).pop();
          if (!v) return null;
          const cats = rubricCategories.filter((c) => c.rubricVersionId === v.id).map((c) => ({
            ...c,
            criteria: criteria.filter((cr) => cr.categoryId === c.id),
          }));
          return { ...v, categories: cats, sourceTemplateVersion: null };
        },
        count: async () => rubricVersions.length,
      },
      criterionAssessment: { count: async () => 0 },
      evidence: { count: async () => 0 },
    };

    const mockWorkflow = {
      lock: async (_tx, termId) => terms.find((t) => t.id === termId) || { id: termId, status: 'UPCOMING' },
    };

    const criteriaService = new CriteriaService(mockPrisma, mockWorkflow);

    // 1. Cập nhật draft bằng updateTermRubricDraft với rolesScore
    const sampleDefinition = {
      categories: [
        {
          code: 'CAT_1',
          name: 'Ý thức học tập',
          maxScore: 20,
          position: 1,
          criteria: [
            {
              code: '1',
              name: 'Điểm TBC học tập',
              description: 'Đánh giá dựa trên kết quả học tập kỳ',
              maxScore: 20,
              scoringConfig: { kind: 'manual_verified', requiredData: ['verified'] },
            },
          ],
        },
        {
          code: 'CAT_2',
          name: 'Hoạt động phong trào & Cộng đồng',
          maxScore: 80,
          position: 2,
          criteria: [
            {
              code: '12',
              name: 'Hoạt động tình nguyện hè vì cộng đồng',
              description: 'Đánh giá điểm hoạt động tình nguyện theo vai trò',
              maxScore: 80,
              scoringConfig: {
                kind: 'community_activity_tier',
                requiredData: ['verifiedActivityCount', 'convertedCommunityPoints'],
                tiers: [{ minCount: 1, minPoints: 5, score: 80 }],
              },
              rolesScore: {
                PARTICIPANT: 5,
                ORGANIZER: 7,
                CHEERLEADER: 2.5,
              },
            },
          ],
        },
      ],
    };

    await criteriaService.updateTermRubricDraft('term-src', sampleDefinition, 'admin-1', 'Cập nhật cấu hình vai trò');

    // 2. Đọc lại bằng getTermRubric: Kiểm tra rolesScore được bảo toàn
    const readRubric = await criteriaService.getTermRubric('term-src');
    assert(readRubric.definition, 'Phải đọc được definition');
    const readCrit12 = readRubric.definition.categories[1].criteria.find((c) => c.code === '12');
    assert(readCrit12, 'Phải có tiêu chí 12 trong readRubric');
    assert.deepEqual(readCrit12.rolesScore, {
      PARTICIPANT: 5,
      ORGANIZER: 7,
      CHEERLEADER: 2.5,
    }, 'getTermRubric phải trả về đúng rolesScore đã lưu');

    // 3. Giả lập ban hành rubric kỳ nguồn (PUBLISHED) để kỳ mới kế thừa
    rubricVersions[0].status = 'PUBLISHED';
    terms[0].status = 'ACTIVE';

    // 4. Tạo kỳ mới kế thừa kỳ nguồn thông qua createTerm
    const createTermDto = {
      code: '2027_HK1',
      name: 'Học kỳ 1 2027-2028',
      startDate: '2027-09-01T00:00:00.000Z',
      endDate: '2028-01-15T00:00:00.000Z',
      submissionDeadline: '2027-10-01T00:00:00.000Z',
      reviewDeadline: '2027-10-15T00:00:00.000Z',
      appealDeadline: '2027-10-25T00:00:00.000Z',
      rubricSourceType: 'TERM',
      sourceTermId: 'term-src',
    };

    const newTerm = await criteriaService.createTerm(createTermDto, 'admin-1');
    assert(newTerm, 'Phải tạo được kỳ mới');

    // 5. Đọc lại rubric của kỳ mới vừa được copy: rolesScore phải được bảo toàn 100%
    const readNewTermRubric = await criteriaService.getTermRubric(newTerm.id);
    assert(readNewTermRubric.definition, 'Kỳ mới phải có definition rubric sao chép');
    const newCrit12 = readNewTermRubric.definition.categories[1].criteria.find((c) => c.code === '12');
    assert(newCrit12, 'Phải có tiêu chí 12 ở kỳ mới');
    assert.deepEqual(newCrit12.rolesScore, {
      PARTICIPANT: 5,
      ORGANIZER: 7,
      CHEERLEADER: 2.5,
    }, 'createTerm khi copy rubric từ kỳ nguồn phải bảo toàn 100% rolesScore');
  });
});
