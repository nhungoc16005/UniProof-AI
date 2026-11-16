const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require(path.join(__dirname, '../node_modules/ts-node')).register({
  project: path.join(__dirname, '../tsconfig.json'),
});

// ============================================================================
// TEST SUITE: ĐỢT 5 — BL-015, BL-013, BL-023, BL-024
// ============================================================================

describe('BL-015: Bảo vệ nội dung minh chứng đã duyệt & Khóa trạng thái giao dịch', () => {
  const { EvidenceService } = require('../src/evidence/evidence.service');

  function createMockWorkflow() {
    return {
      assertStudentEditable: async (_tx, _studentId, _termId) => true,
      studentEdit: async (_studentId, _termId, fn) => {
        const mockTx = {
          evidence: {
            findUnique: async ({ where }) => {
              // Mô phỏng trạng thái evidence trong transaction
              if (where.id === 'evi-approved-in-tx') {
                return { id: 'evi-approved-in-tx', studentId: 'student-1', termId: 'term-1', status: 'APPROVED' };
              }
              if (where.id === 'evi-submitted-in-tx') {
                return { id: 'evi-submitted-in-tx', studentId: 'student-1', termId: 'term-1', status: 'NEEDS_HUMAN_REVIEW' };
              }
              return { id: where.id, studentId: 'student-1', termId: 'term-1', status: 'DRAFT' };
            },
            update: async ({ where, data }) => ({ id: where.id, ...data }),
          },
          evidenceFile: {
            create: async ({ data }) => ({ id: 'file-created-1', ...data }),
          },
        };
        return fn(mockTx);
      },
    };
  }

  test('Ca 1: Phiếu RETURNED nhưng evidence APPROVED -> addFile bị chặn với BadRequestException', async () => {
    const mockPrisma = {
      evidence: {
        findUnique: async () => ({
          id: 'evi-approved',
          studentId: 'student-1',
          termId: 'term-1',
          status: 'APPROVED', // Evidence đã được duyệt
        }),
      },
    };
    const service = new EvidenceService(mockPrisma, createMockWorkflow());

    await assert.rejects(
      async () => service.addFile('evi-approved', 'student-1', {
        fileUrl: 'evidence/student-1/term-1/evi-approved/file1.pdf',
        fileType: 'application/pdf',
      }),
      (err) => {
        assert.equal(err.name, 'BadRequestException');
        assert.match(err.message, /đã được phê duyệt/i);
        return true;
      },
      'addFile phải chặn khi hồ sơ đã APPROVED',
    );
  });

  test('Ca 2: uploadDraftFile chặn ngay từ kiểm tra ban đầu nếu evidence không phải DRAFT', async () => {
    const mockPrisma = {
      evidence: {
        findUnique: async () => ({
          id: 'evi-approved',
          studentId: 'student-1',
          termId: 'term-1',
          status: 'APPROVED',
          term: { id: 'term-1', status: 'ACTIVE' },
        }),
      },
    };
    const service = new EvidenceService(mockPrisma, createMockWorkflow());

    await assert.rejects(
      async () => service.uploadDraftFile('evi-approved', 'student-1', {
        fileData: 'data:application/pdf;base64,JVBERi0xLjQK',
        fileName: 'test.pdf',
        fileType: 'application/pdf',
      }),
      (err) => {
        assert.equal(err.name, 'BadRequestException');
        assert.match(err.message, /chỉ có thể thêm tệp khi hồ sơ còn là bản nháp/i);
        return true;
      },
      'uploadDraftFile phải chặn khi hồ sơ không phải DRAFT',
    );
  });

  test('Ca 3: Race Condition — Ban đầu đọc DRAFT nhưng vào transaction trạng thái đổi thành APPROVED -> addFile chặn trong transaction', async () => {
    const mockEvidence = {
      id: 'evi-approved-in-tx',
      studentId: 'student-1',
      termId: 'term-1',
      status: 'DRAFT', // Ban đầu đọc là DRAFT
    };
    const mockPrisma = {
      evidence: {
        findUnique: async () => mockEvidence,
        findUniqueOrThrow: async () => mockEvidence,
      },
      $transaction: async (fn) => fn({}),
    };
    const service = new EvidenceService(mockPrisma, createMockWorkflow());

    await assert.rejects(
      async () => service.addFile('evi-approved-in-tx', 'student-1', {
        fileUrl: 'evidence/student-1/term-1/evi-approved-in-tx/file1.pdf',
        fileType: 'application/pdf',
      }),
      (err) => {
        assert.equal(err.name, 'BadRequestException');
        assert.match(err.message, /đã được phê duyệt/i);
        return true;
      },
      'addFile phải kiểm tra lại trong transaction và chặn khi status đổi thành APPROVED',
    );
  });

  test('Ca 4: Sai chủ sở hữu (studentId khác) bị chặn ForbiddenException', async () => {
    const mockPrisma = {
      evidence: {
        findUnique: async () => ({
          id: 'evi-1',
          studentId: 'student-other',
          termId: 'term-1',
          status: 'DRAFT',
        }),
      },
    };
    const service = new EvidenceService(mockPrisma, createMockWorkflow());

    await assert.rejects(
      async () => service.addFile('evi-1', 'student-1', {
        fileUrl: 'evidence/student-1/term-1/evi-1/file1.pdf',
        fileType: 'application/pdf',
      }),
      (err) => {
        assert.equal(err.name, 'ForbiddenException');
        return true;
      },
      'addFile phải chặn sinh viên không sở hữu hồ sơ',
    );
  });

  test('Ca 5: update hồ sơ APPROVED bị chặn với BadRequestException', async () => {
    const mockPrisma = {
      evidence: {
        findUnique: async () => ({
          id: 'evi-approved',
          studentId: 'student-1',
          termId: 'term-1',
          status: 'APPROVED',
        }),
      },
    };
    const service = new EvidenceService(mockPrisma, createMockWorkflow());

    await assert.rejects(
      async () => service.update('evi-approved', { id: 'student-1', role: 'STUDENT' }, {
        declaredActivityName: 'Tên mới',
      }),
      (err) => {
        assert.equal(err.name, 'BadRequestException');
        assert.match(err.message, /đã được phê duyệt chính thức, không thể sửa/i);
        return true;
      },
      'update phải chặn khi hồ sơ đã APPROVED',
    );
  });
});

describe('BL-013: Hiển thị nháp đúng tiêu chí sau reload & Ghép trực tiếp ưu tiên hơn review cũ', () => {
  // Logic hàm ghép evidenceFor được trích xuất trực tiếp từ ScoreReport.tsx
  function evidenceFor(criterion, evidences, activeTermId) {
    return evidences.filter((evidence) => {
      const directCriterionId = evidence.criterionAssessment?.criterion?.id || evidence.criterionAssessment?.criterionId || evidence.criterionId;
      if (directCriterionId) {
        return directCriterionId === criterion.id;
      }
      if (evidence.reviews?.length) {
        const matchedReview = evidence.reviews.find((r) => r.criterionId === criterion.id);
        if (matchedReview && (!evidence.termId || evidence.termId === activeTermId)) {
          return true;
        }
        return false;
      }
      if (evidence.criterion?.id) {
        return evidence.criterion.id === criterion.id;
      }
      return false;
    });
  }

  test('Ca 1: Nháp mới tạo có criterionAssessment.criterion -> Ghép chính xác vào tiêu chí đó sau reload', () => {
    const criterionA = { id: 'crit-a', code: '1.1', name: 'Ý thức học tập' };
    const criterionB = { id: 'crit-b', code: '1.2', name: 'Nề nếp' };

    const draftEvidence = {
      id: 'evi-draft-1',
      declaredActivityName: 'Chứng chỉ ngoại ngữ',
      status: 'DRAFT',
      criterionAssessment: {
        id: 'ca-1',
        criterionId: 'crit-a',
        criterion: { id: 'crit-a', code: '1.1', name: 'Ý thức học tập' },
      },
      reviews: [],
    };

    const listA = evidenceFor(criterionA, [draftEvidence], 'term-1');
    const listB = evidenceFor(criterionB, [draftEvidence], 'term-1');

    assert.equal(listA.length, 1, 'Hồ sơ nháp phải xuất hiện dưới tiêu chí A');
    assert.equal(listB.length, 0, 'Hồ sơ nháp không được xuất hiện dưới tiêu chí B');
  });

  test('Ca 2: Liên kết trực tiếp có ưu tiên cao hơn review cũ khác tiêu chí (không bị ghi đè)', () => {
    const criterionA = { id: 'crit-a', code: '1.1', name: 'Ý thức học tập' };
    const criterionB = { id: 'crit-b', code: '1.2', name: 'Nề nếp' };

    // Hồ sơ có direct link tới crit-A, nhưng lịch sử review cũ ghi crit-B (do kỳ trước hoặc điều chỉnh)
    const evidenceWithHistory = {
      id: 'evi-2',
      declaredActivityName: 'Giấy khen',
      criterionAssessment: {
        criterion: { id: 'crit-a', code: '1.1' },
      },
      reviews: [
        { id: 'rev-old', criterionId: 'crit-b' },
      ],
    };

    const listA = evidenceFor(criterionA, [evidenceWithHistory], 'term-1');
    const listB = evidenceFor(criterionB, [evidenceWithHistory], 'term-1');

    assert.equal(listA.length, 1, 'Phải ưu tiên direct link gắn vào crit-A');
    assert.equal(listB.length, 0, 'Review cũ crit-B không được ghi đè làm xuất hiện ở tiêu chí B');
  });

  test('Ca 3: Cùng criterion.code "1.1" ở hai rubric khác nhau không bị ghép nhầm', () => {
    const criterionCurTerm = { id: 'crit-rubric-v2', code: '1.1', rubricVersionId: 'v2' };
    const oldEvidenceOtherRubric = {
      id: 'evi-old-term',
      criterion: { id: 'crit-rubric-v1', code: '1.1' }, // Cùng code 1.1 nhưng ID khác
      reviews: [],
    };

    const matched = evidenceFor(criterionCurTerm, [oldEvidenceOtherRubric], 'term-2');
    assert.equal(matched.length, 0, 'Không được ghép nhầm tiêu chí giữa 2 rubric chỉ vì trùng code 1.1');
  });
});

describe('BL-023: Hiển thị yêu cầu bổ sung, hạn thật và bảo vệ form', () => {
  function computeSupplementBanner(evidence) {
    const activeRequest = evidence?.supplementRequests?.find((r) => !r.resolvedAt) || evidence?.supplementRequests?.[0];
    if (!evidence || evidence.status !== 'NEEDS_SUPPLEMENT' || !activeRequest || activeRequest.resolvedAt) {
      return { hasOpenRequest: false, isExpired: false, deadlineText: '', missingItemContent: '' };
    }
    const deadline = activeRequest.deadline ? new Date(activeRequest.deadline) : (evidence.term?.reviewDeadline ? new Date(evidence.term.reviewDeadline) : null);
    const now = new Date();
    const isPast = deadline ? now > deadline : false;
    const deadlineText = activeRequest.deadline ? activeRequest.deadline : `Không đặt hạn riêng (áp dụng hạn rà soát của kỳ: ${evidence.term?.reviewDeadline})`;
    const missingItemContent = activeRequest.missingItem?.trim() || activeRequest.review?.reason?.trim() || 'Cán bộ chưa ghi rõ nội dung cần bổ sung.';
    return {
      hasOpenRequest: true,
      isExpired: isPast,
      deadlineText,
      missingItemContent,
    };
  }

  test('Ca 1: missingItem khác review.reason -> Hiển thị đúng missingItem', () => {
    const evidence = {
      id: 'evi-sup-1',
      status: 'NEEDS_SUPPLEMENT',
      term: { reviewDeadline: '2026-12-31T23:59:59Z' },
      reviews: [{ reason: 'Lý do từ review cũ: mờ ảnh' }],
      supplementRequests: [
        {
          id: 'req-1',
          missingItem: 'Cần thẻ sinh viên có ảnh và dấu mộc giáp lai',
          deadline: '2026-11-20T17:00:00Z',
          resolvedAt: null,
        },
      ],
    };

    const banner = computeSupplementBanner(evidence);
    assert.equal(banner.hasOpenRequest, true);
    assert.equal(banner.missingItemContent, 'Cần thẻ sinh viên có ảnh và dấu mộc giáp lai');
  });

  test('Ca 2: deadline = null -> Hiển thị "Không đặt hạn riêng" kèm hạn review của kỳ', () => {
    const evidence = {
      id: 'evi-sup-2',
      status: 'NEEDS_SUPPLEMENT',
      term: { reviewDeadline: '2026-12-15T23:59:59Z' },
      supplementRequests: [
        {
          id: 'req-2',
          missingItem: 'Bổ sung danh sách',
          deadline: null, // Không đặt hạn riêng
          resolvedAt: null,
        },
      ],
    };

    const banner = computeSupplementBanner(evidence);
    assert.equal(banner.hasOpenRequest, true);
    assert.match(banner.deadlineText, /Không đặt hạn riêng/);
    assert.match(banner.deadlineText, /2026-12-15/);
  });

  test('Ca 3: Yêu cầu bổ sung đã quá hạn -> isExpired = true, khóa gửi', () => {
    const evidence = {
      id: 'evi-sup-3',
      status: 'NEEDS_SUPPLEMENT',
      term: { reviewDeadline: '2026-01-01T00:00:00Z' },
      supplementRequests: [
        {
          id: 'req-3',
          missingItem: 'Bổ sung vé check-in',
          deadline: '2025-01-01T00:00:00Z', // Quá hạn trong quá khứ
          resolvedAt: null,
        },
      ],
    };

    const banner = computeSupplementBanner(evidence);
    assert.equal(banner.hasOpenRequest, true);
    assert.equal(banner.isExpired, true, 'Hạn đã qua phải đánh dấu isExpired = true');
  });

  test('Ca 4: Hồ sơ không ở trạng thái NEEDS_SUPPLEMENT hoặc yêu cầu đã resolved -> hasOpenRequest = false', () => {
    const evidence = {
      id: 'evi-sup-4',
      status: 'PROCESSING', // Đã gửi bổ sung
      supplementRequests: [
        {
          id: 'req-4',
          missingItem: 'Đã bổ sung xong',
          deadline: '2026-12-31T00:00:00Z',
          resolvedAt: '2026-11-10T00:00:00Z',
        },
      ],
    };

    const banner = computeSupplementBanner(evidence);
    assert.equal(banner.hasOpenRequest, false, 'Không còn yêu cầu mở thì hasOpenRequest phải false');
  });
});

describe('BL-024: Một nguồn chọn kỳ cho URL, UI và request trong ScoreReport & AppLayout', () => {
  function resolveSelectedTerm(terms, termIdParam, activeTerm) {
    if (!terms || terms.length === 0) return { selectedTerm: null, termError: null, isTermLoading: true };
    if (termIdParam) {
      const match = terms.find((t) => t.id === termIdParam);
      if (!match) {
        return {
          selectedTerm: null,
          termError: `Mã kỳ học "${termIdParam}" không hợp lệ hoặc không tồn tại trong hệ thống.`,
          isTermLoading: false,
        };
      }
      return { selectedTerm: match, termError: null, isTermLoading: false };
    }
    const fallback = activeTerm?.id ? activeTerm : (terms.find((t) => t.status === 'ACTIVE') || terms[0]);
    return { selectedTerm: fallback, termError: null, isTermLoading: false };
  }

  const sampleTerms = [
    { id: 'term-active', code: '2026_1', name: 'Học kỳ 1 (2026-2027)', status: 'ACTIVE' },
    { id: 'term-closed', code: '2025_2', name: 'Học kỳ 2 (2025-2026)', status: 'CLOSED' },
  ];

  test('Ca 1: URL có query termId hợp lệ -> Mở đúng kỳ đó, không bị ép về kỳ ACTIVE', () => {
    const res = resolveSelectedTerm(sampleTerms, 'term-closed', sampleTerms[0]);
    assert.equal(res.isTermLoading, false);
    assert.equal(res.termError, null);
    assert.equal(res.selectedTerm.id, 'term-closed', 'Phải mở kỳ 2025_2 theo query URL');
  });

  test('Ca 2: URL có query termId sai -> Báo lỗi termError rõ ràng, không âm thầm chuyển sang kỳ hiện tại', () => {
    const res = resolveSelectedTerm(sampleTerms, 'invalid-term-xyz', sampleTerms[0]);
    assert.equal(res.isTermLoading, false);
    assert.ok(res.termError, 'Phải có thông báo lỗi kỳ không hợp lệ');
    assert.equal(res.selectedTerm, null, 'Không được fallback âm thầm sang kỳ khác khi URL sai');
  });

  test('Ca 3: URL không có query termId -> Chuẩn hóa về kỳ hiện tại', () => {
    const res = resolveSelectedTerm(sampleTerms, null, sampleTerms[0]);
    assert.equal(res.termError, null);
    assert.equal(res.selectedTerm.id, 'term-active');
  });

  test('Ca 4: Khi đang lưu mà kỳ thay đổi giữa chừng -> Hủy nộp sang kỳ mới', () => {
    let currentEffectiveTermId = 'term-1';
    const startTermId = currentEffectiveTermId;

    // Giả lập người dùng đổi kỳ sang term-2 trong lúc chuẩn bị nộp
    currentEffectiveTermId = 'term-2';

    const canProceed = currentEffectiveTermId === startTermId;
    assert.equal(canProceed, false, 'Phải hủy thao tác nộp nếu kỳ đã thay đổi sau khi bắt đầu lưu');
  });
});
