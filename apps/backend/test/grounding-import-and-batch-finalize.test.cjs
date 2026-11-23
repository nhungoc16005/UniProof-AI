const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require(path.join(__dirname, '../node_modules/ts-node')).register({
  project: path.join(__dirname, '../tsconfig.json'),
});

const {
  CriterionAssessmentStatus,
  DeadlineExtensionType,
  EvidenceStatus,
  ImportBatchStatus,
  ImportBatchType,
  GroundingStatus,
  Role,
  TermStatus,
} = require('@prisma/client');

const { GroundingImportService } = require('../src/grounding-import/grounding-import.service');
const { AssessmentsService } = require('../src/assessments/assessments.service');
const { ActivitiesService } = require('../src/activities/activities.service');
const { CriteriaService } = require('../src/criteria/criteria.service');
const { WorkflowService } = require('../src/evaluation-workflow/workflow.service');

// ============================================================================
// TEST SUITE: PHASE 1 — CĂN CỨ CHẤM ĐIỂM, IMPORT EXCEL & CHỐT PHIẾU HÀNG LOẠT
// ============================================================================

describe('Phase 1: Căn cứ chấm điểm, Import Excel & Chốt phiếu hàng loạt', () => {

  function createMockPrisma() {
    const data = {
      terms: new Map(),
      rubricVersions: new Map(),
      criteria: new Map(),
      users: new Map(),
      handoffs: new Map(),
      submissions: new Map(),
      criterionAssessments: new Map(),
      evidences: new Map(),
      appeals: new Map(),
      activities: new Map(),
      activityParticipants: new Map(),
      importBatches: new Map(),
      academicGroundings: new Map(),
      clubGroundings: new Map(),
      assessmentPublications: new Map(),
      auditLogs: [],
      aiJobs: [],
    };

    const prisma = {
      $transaction: async (fn) => fn(prisma),
      $queryRaw: async () => [{ id: 'term-1', status: 'ACTIVE' }],
      term: {
        findUnique: async ({ where }) => data.terms.get(where.id) || null,
        findUniqueOrThrow: async ({ where }) => {
          const t = data.terms.get(where.id);
          if (!t) throw new Error('Term not found');
          return t;
        },
      },
      rubricVersion: {
        findFirst: async ({ where }) => {
          const all = [...data.rubricVersions.values()].filter(r => r.termId === where.termId && (!where.status || r.status === where.status));
          return all[0] || null;
        },
        findUnique: async ({ where }) => data.rubricVersions.get(where.id) || null,
      },
      criterion: {
        findFirst: async ({ where }) => {
          return [...data.criteria.values()].find(c => {
            if (where.code && c.code !== where.code) return false;
            if (where.id && c.id !== where.id) return false;
            return true;
          }) || null;
        },
        findMany: async ({ where }) => {
          return [...data.criteria.values()];
        },
      },
      user: {
        findUnique: async ({ where }) => {
          if (where.id) return data.users.get(where.id) || null;
          if (where.studentCode) return [...data.users.values()].find(u => u.studentCode === where.studentCode) || null;
          return null;
        },
        findMany: async ({ where }) => {
          return [...data.users.values()].filter(u => {
            if (where.studentCode?.in && !where.studentCode.in.includes(u.studentCode)) return false;
            if (where.role && u.role !== where.role) return false;
            return true;
          });
        },
      },
      assessmentHandoff: {
        findUnique: async ({ where }) => {
          if (where.studentId_termId) {
            return data.handoffs.get(`${where.studentId_termId.studentId}:${where.studentId_termId.termId}`) || null;
          }
          return [...data.handoffs.values()].find(h => h.id === where.id) || null;
        },
        findMany: async ({ where }) => {
          return [...data.handoffs.values()].filter(h => {
            if (where.termId && h.termId !== where.termId) return false;
            if (where.facultyId && h.facultyId !== where.facultyId) return false;
            if (where.studentId?.in && !where.studentId.in.includes(h.studentId)) return false;
            if (where.status && h.status !== where.status) return false;
            return true;
          });
        },
        count: async ({ where }) => {
          return [...data.handoffs.values()].filter(h => {
            if (where.termId && h.termId !== where.termId) return false;
            if (where.status && h.status !== where.status) return false;
            return true;
          }).length;
        },
      },
      assessmentSubmission: {
        findFirst: async ({ where }) => {
          return [...data.submissions.values()].find(s => s.studentId === where.studentId && s.termId === where.termId && (!where.status || s.status === where.status)) || null;
        },
        findUnique: async ({ where }) => {
          if (where.studentId_termId_rubricVersionId) {
            const { studentId, termId, rubricVersionId } = where.studentId_termId_rubricVersionId;
            return data.submissions.get(`${studentId}:${termId}:${rubricVersionId}`) || null;
          }
          return null;
        },
        upsert: async ({ where, create, update }) => {
          const key = `${create.studentId}:${create.termId}:${create.rubricVersionId}`;
          const existing = data.submissions.get(key);
          const val = existing ? { ...existing, ...update } : { id: `sub-${Math.random()}`, ...create };
          data.submissions.set(key, val);
          return val;
        },
        count: async ({ where }) => {
          return [...data.submissions.values()].filter(s => s.studentId === where.studentId && s.termId === where.termId && (!where.status || s.status === where.status)).length;
        },
      },
      criterionAssessment: {
        findUnique: async ({ where }) => {
          if (where.studentId_termId_criterionId) {
            const { studentId, termId, criterionId } = where.studentId_termId_criterionId;
            return data.criterionAssessments.get(`${studentId}:${termId}:${criterionId}`) || null;
          }
          if (where.id) {
            return [...data.criterionAssessments.values()].find(ca => ca.id === where.id) || null;
          }
          return null;
        },
        findMany: async ({ where }) => {
          return [...data.criterionAssessments.values()].filter(ca => {
            if (where.studentId && ca.studentId !== where.studentId) return false;
            if (where.termId && ca.termId !== where.termId) return false;
            return true;
          });
        },
        upsert: async ({ where, create, update }) => {
          const { studentId, termId, criterionId } = where.studentId_termId_criterionId;
          const key = `${studentId}:${termId}:${criterionId}`;
          const existing = data.criterionAssessments.get(key);
          const val = existing ? { ...existing, ...update } : { id: `ca-${Math.random()}`, ...create };
          data.criterionAssessments.set(key, val);
          return val;
        },
        update: async ({ where, data: updateData }) => {
          const item = [...data.criterionAssessments.values()].find(ca => ca.id === where.id);
          if (item) Object.assign(item, updateData);
          return item;
        },
        updateMany: async ({ where, data: updateData }) => {
          let count = 0;
          for (const item of data.criterionAssessments.values()) {
            if (where.studentId && item.studentId !== where.studentId) continue;
            if (where.termId && item.termId !== where.termId) continue;
            if (where.status && item.status !== where.status) continue;
            Object.assign(item, updateData);
            count++;
          }
          return { count };
        },
      },
      evidence: {
        findMany: async ({ where }) => {
          return [...data.evidences.values()].filter(e => {
            if (where.studentId && e.studentId !== where.studentId) return false;
            if (where.termId && e.termId !== where.termId) return false;
            if (where.status && typeof where.status === 'object' && where.status.in && !where.status.in.includes(e.status)) return false;
            return true;
          });
        },
        count: async ({ where }) => {
          return (await prisma.evidence.findMany({ where })).length;
        },
        update: async ({ where, data: updateData }) => {
          const item = data.evidences.get(where.id);
          if (item) Object.assign(item, updateData);
          return item;
        },
      },
      aiProcessingJob: {
        create: async ({ data: jobData }) => {
          data.aiJobs.push(jobData);
          return { id: `job-${Math.random()}`, ...jobData };
        },
      },
      appeal: {
        count: async ({ where }) => {
          return [...data.appeals.values()].filter(a => a.studentId === where.studentId && a.termId === where.termId && a.status === where.status).length;
        },
      },
      assessmentPublication: {
        findMany: async ({ where }) => [],
        count: async ({ where }) => {
          return [...data.assessmentPublications.values()].filter(p => !where?.termId || p.termId === where.termId).length;
        },
      },
      importBatch: {
        count: async ({ where }) => [...data.importBatches.values()].filter(b => b.termId === where.termId && b.status === where.status).length,
        findUnique: async ({ where }) => {
          if (where.idempotencyKey) {
            return [...data.importBatches.values()].find(b => b.idempotencyKey === where.idempotencyKey) || null;
          }
          return data.importBatches.get(where.id) || null;
        },
        findUniqueOrThrow: async ({ where }) => {
          const b = data.importBatches.get(where.id);
          if (!b) throw new Error('Batch not found');
          return b;
        },
        findMany: async ({ where }) => {
          return [...data.importBatches.values()].filter(b => {
            if (where.termId && b.termId !== where.termId) return false;
            if (where.facultyId && b.facultyId !== where.facultyId) return false;
            return true;
          });
        },
        create: async ({ data: batchData }) => {
          const b = { id: `batch-${Math.random()}`, ...batchData };
          data.importBatches.set(b.id, b);
          return b;
        },
        update: async ({ where, data: updateData }) => {
          const b = data.importBatches.get(where.id);
          if (b) Object.assign(b, updateData);
          return b;
        },
      },
      academicGrounding: {
        findFirst: async ({ where }) => [...data.academicGroundings.values()].find(g => g.termId === where.termId && g.studentId === where.studentId && g.criterionCode === where.criterionCode && g.status === where.status) || null,
        findMany: async ({ where }) => {
          return [...data.academicGroundings.values()].filter(g => {
            if (where.batchId && g.batchId !== where.batchId) return false;
            if (where.studentId && g.studentId !== where.studentId) return false;
            if (where.termId && g.termId !== where.termId) return false;
            if (where.status && g.status !== where.status) return false;
            return true;
          });
        },
        createMany: async ({ data: rows }) => {
          for (const r of rows) {
            data.academicGroundings.set(`ag-${Math.random()}`, { id: `ag-${Math.random()}`, ...r });
          }
          return { count: rows.length };
        },
        updateMany: async ({ where, data: updateData }) => {
          let count = 0;
          for (const item of data.academicGroundings.values()) {
            if (where.batchId && item.batchId !== where.batchId) continue;
            Object.assign(item, updateData);
            count++;
          }
          return { count };
        },
      },
      clubLeadershipGrounding: {
        findMany: async ({ where }) => {
          return [...data.clubGroundings.values()].filter(g => {
            if (where.batchId && g.batchId !== where.batchId) return false;
            if (where.studentId && g.studentId !== where.studentId) return false;
            if (where.termId && g.termId !== where.termId) return false;
            if (where.status && g.status !== where.status) return false;
            return true;
          });
        },
        createMany: async ({ data: rows }) => {
          for (const r of rows) {
            data.clubGroundings.set(`cg-${Math.random()}`, { id: `cg-${Math.random()}`, ...r });
          }
          return { count: rows.length };
        },
        updateMany: async ({ where, data: updateData }) => {
          let count = 0;
          for (const item of data.clubGroundings.values()) {
            if (where.batchId && item.batchId !== where.batchId) continue;
            Object.assign(item, updateData);
            count++;
          }
          return { count };
        },
      },
      activity: {
        findUnique: async ({ where }) => data.activities.get(where.id) || null,
        findUniqueOrThrow: async ({ where }) => {
          const a = data.activities.get(where.id);
          if (!a) throw new Error('Activity not found');
          return a;
        },
      },
      activityParticipant: {
        updateMany: async ({ where, data: updateData }) => {
          let count = 0;
          for (const item of data.activityParticipants.values()) {
            if (where.batchId && item.batchId !== where.batchId) continue;
            if (where.status?.not && item.status === where.status.not) continue;
            Object.assign(item, { ...updateData, revision: (item.revision || 1) + (updateData.revision?.increment || 0) });
            count++;
          }
          return { count };
        },
        findMany: async ({ where }) => {
          return [...data.activityParticipants.values()].filter(p => {
            if (where.activityId && p.activityId !== where.activityId) return false;
            if (where.batchId && p.batchId !== where.batchId) return false;
            if (where.studentId && p.studentId !== where.studentId) return false;
            if (where.status && p.status !== where.status) return false;
            return true;
          });
        },
        deleteMany: async ({ where }) => {
          let count = 0;
          for (const [k, v] of data.activityParticipants.entries()) {
            if (where.batchId && v.batchId === where.batchId) {
              data.activityParticipants.delete(k);
              count++;
            }
          }
          return { count };
        },
        createMany: async ({ data: rows }) => {
          for (const r of rows) {
            data.activityParticipants.set(`ap-${Math.random()}`, { id: `ap-${Math.random()}`, status: 'DRAFT', ...r });
          }
          return { count: rows.length };
        },
      },
      auditLog: {
        create: async ({ data: logData }) => {
          data.auditLogs.push(logData);
          return { id: `audit-${Math.random()}`, ...logData };
        },
      },
      faculty: {
        findFirst: async () => ({ id: 'fac-cntt' }),
      },
    };

    return { prisma, data };
  }

  // ==========================================================================
  // NHÓM 1: IMPORT & VALIDATION
  // ==========================================================================

  test('Ca 1: MSSV dạng text giữ số 0 ở đầu ("0102210001"), không bị ép thành số; preview VALID', async () => {
    const { prisma, data } = createMockPrisma();

    data.terms.set('term-1', { id: 'term-1', status: 'ACTIVE', workflowEnabled: true, evidenceBasisWorkflowEnabled: true });
    data.rubricVersions.set('ver-1', {
      id: 'ver-1', termId: 'term-1', status: 'PUBLISHED', version: 1,
      criteria: [
        { id: 'crit-1', code: '1', maxScore: 6, scoringConfig: { kind: 'attendance_penalty', requiredData: ['examBans', 'classWarnings'], baseScore: 6, examBanPenalty: 3, warningPenalty: 1 } },
      ],
    });
    data.criteria.set('crit-1', { id: 'crit-1', code: '1', maxScore: 6, scoringConfig: { kind: 'attendance_penalty', requiredData: ['examBans', 'classWarnings'], baseScore: 6, examBanPenalty: 3, warningPenalty: 1 } });

    // Sinh viên có MSSV bắt đầu bằng số 0
    data.users.set('sv-1', { id: 'sv-1', studentCode: '0102210001', fullName: 'Nguyễn Văn Zero', role: 'STUDENT', class: { facultyId: 'fac-cntt' } });
    data.handoffs.set('sv-1:term-1', { studentId: 'sv-1', termId: 'term-1', facultyId: 'fac-cntt', status: 'WORKING' });

    const mockWorkflow = { scope: async () => {} };
    const mockActivities = {};
    const service = new GroundingImportService(prisma, mockWorkflow, mockActivities);

    const preview = await service.preview(
      { id: 'staff-1', role: Role.STAFF, facultyId: 'fac-cntt' },
      {
        termId: 'term-1',
        type: ImportBatchType.ACADEMIC,
        source: 'HocVu_Test.xlsx',
        rows: [
          {
            studentCode: '0102210001',
            criterionCode: '1',
            data: { examBans: 0, classWarnings: 1 },
          },
        ],
      }
    );

    assert.equal(preview.validCount, 1);
    assert.equal(preview.errorCount, 0);
    assert.equal(preview.previewItems[0].studentCode, '0102210001', 'MSSV phải giữ nguyên số 0 ở đầu');
    assert.equal(preview.previewItems[0].status, 'VALID');
  });

  test('Ca 2: Dữ liệu học vụ có trường thiếu / sai kiểu -> Validator phát hiện và Preview đánh dấu ERROR', async () => {
    const { prisma, data } = createMockPrisma();

    data.terms.set('term-1', { id: 'term-1', status: 'ACTIVE', workflowEnabled: true, evidenceBasisWorkflowEnabled: true });
    data.rubricVersions.set('ver-1', {
      id: 'ver-1', termId: 'term-1', status: 'PUBLISHED',
      criteria: [
        { id: 'crit-1', code: '1', maxScore: 6, scoringConfig: { kind: 'attendance_penalty', requiredData: ['examBans', 'classWarnings'], baseScore: 6, examBanPenalty: 3, warningPenalty: 1 } },
      ],
    });
    data.criteria.set('crit-1', { id: 'crit-1', code: '1', maxScore: 6, scoringConfig: { kind: 'attendance_penalty', requiredData: ['examBans', 'classWarnings'], baseScore: 6, examBanPenalty: 3, warningPenalty: 1 } });
    data.users.set('sv-1', { id: 'sv-1', studentCode: '102210001', fullName: 'Trần Văn A', role: 'STUDENT', class: { facultyId: 'fac-cntt' } });
    data.handoffs.set('sv-1:term-1', { studentId: 'sv-1', termId: 'term-1', facultyId: 'fac-cntt', status: 'WORKING' });

    const service = new GroundingImportService(prisma, {}, {});

    // Row có examBans là chuỗi thay vì số không âm
    const preview = await service.preview(
      { id: 'staff-1', role: Role.STAFF, facultyId: 'fac-cntt' },
      {
        termId: 'term-1',
        type: ImportBatchType.ACADEMIC,
        source: 'HocVu_Test.xlsx',
        rows: [
          {
            studentCode: '102210001',
            criterionCode: '1',
            data: { examBans: 'INVALID', classWarnings: 0 },
          },
        ],
      }
    );

    assert.equal(preview.validCount, 0);
    assert.equal(preview.errorCount, 1);
    assert.equal(preview.previewItems[0].status, 'ERROR');
    assert.match(preview.previewItems[0].reason, /không âm/);
  });

  test('Ca 3: MSSV ngoài phạm vi Khoa của cán bộ -> Preview đánh dấu ERROR', async () => {
    const { prisma, data } = createMockPrisma();

    data.terms.set('term-1', { id: 'term-1', status: 'ACTIVE', workflowEnabled: true, evidenceBasisWorkflowEnabled: true });
    data.rubricVersions.set('ver-1', {
      id: 'ver-1', termId: 'term-1', status: 'PUBLISHED',
      criteria: [{ id: 'crit-1', code: '1', maxScore: 6, scoringConfig: { kind: 'attendance_penalty', requiredData: ['examBans', 'classWarnings'] } }],
    });
    data.criteria.set('crit-1', { id: 'crit-1', code: '1', maxScore: 6, scoringConfig: { kind: 'attendance_penalty', requiredData: ['examBans', 'classWarnings'] } });

    // Sinh viên thuộc Khoa Cơ khí (fac-ck)
    data.users.set('sv-ck', { id: 'sv-ck', studentCode: '103210001', fullName: 'Lê Cơ Khí', role: 'STUDENT', class: { facultyId: 'fac-ck' } });
    data.handoffs.set('sv-ck:term-1', { studentId: 'sv-ck', termId: 'term-1', facultyId: 'fac-ck', status: 'WORKING' });

    const service = new GroundingImportService(prisma, {}, {});

    // Cán bộ Khoa CNTT (fac-cntt) preview sinh viên Khoa Cơ khí
    const preview = await service.preview(
      { id: 'staff-cntt', role: Role.STAFF, facultyId: 'fac-cntt' },
      {
        termId: 'term-1',
        type: ImportBatchType.ACADEMIC,
        source: 'HocVu.xlsx',
        rows: [{ studentCode: '103210001', criterionCode: '1', data: { examBans: 0, classWarnings: 0 } }],
      }
    );

    assert.equal(preview.validCount, 0);
    assert.equal(preview.errorCount, 1);
    assert.match(preview.previewItems[0].reason, /không thuộc Khoa quản lý/);
  });

  test('Ca 4: Trùng lặp sinh viên + tiêu chí trong cùng file -> Dòng thứ 2 đánh dấu ERROR', async () => {
    const { prisma, data } = createMockPrisma();

    data.terms.set('term-1', { id: 'term-1', status: 'ACTIVE', workflowEnabled: true, evidenceBasisWorkflowEnabled: true });
    data.rubricVersions.set('ver-1', {
      id: 'ver-1', termId: 'term-1', status: 'PUBLISHED',
      criteria: [{ id: 'crit-1', code: '1', maxScore: 6, scoringConfig: { kind: 'attendance_penalty', requiredData: ['examBans', 'classWarnings'] } }],
    });
    data.criteria.set('crit-1', { id: 'crit-1', code: '1', maxScore: 6, scoringConfig: { kind: 'attendance_penalty', requiredData: ['examBans', 'classWarnings'] } });
    data.users.set('sv-1', { id: 'sv-1', studentCode: '102210001', fullName: 'Nguyễn Văn A', role: 'STUDENT', class: { facultyId: 'fac-cntt' } });
    data.handoffs.set('sv-1:term-1', { studentId: 'sv-1', termId: 'term-1', facultyId: 'fac-cntt', status: 'WORKING' });

    const service = new GroundingImportService(prisma, {}, {});

    const preview = await service.preview(
      { id: 'staff-1', role: Role.STAFF, facultyId: 'fac-cntt' },
      {
        termId: 'term-1',
        type: ImportBatchType.ACADEMIC,
        source: 'HocVu.xlsx',
        rows: [
          { studentCode: '102210001', criterionCode: '1', data: { examBans: 0, classWarnings: 0 } },
          { studentCode: '102210001', criterionCode: '1', data: { examBans: 1, classWarnings: 2 } }, // Trùng lặp
        ],
      }
    );

    assert.equal(preview.validCount, 1);
    assert.equal(preview.errorCount, 1);
    assert.equal(preview.previewItems[1].status, 'ERROR');
    assert.match(preview.previewItems[1].reason, /Trùng lặp MSSV/);
  });

  test('Ca 5: Preview tuyệt đối KHÔNG ghi vào database (chỉ đọc)', async () => {
    const { prisma, data } = createMockPrisma();

    data.terms.set('term-1', { id: 'term-1', status: 'ACTIVE', workflowEnabled: true, evidenceBasisWorkflowEnabled: true });
    data.rubricVersions.set('ver-1', {
      id: 'ver-1', termId: 'term-1', status: 'PUBLISHED',
      criteria: [{ id: 'crit-1', code: '1', maxScore: 6, scoringConfig: { kind: 'attendance_penalty', requiredData: ['examBans', 'classWarnings'] } }],
    });
    data.criteria.set('crit-1', { id: 'crit-1', code: '1', maxScore: 6, scoringConfig: { kind: 'attendance_penalty', requiredData: ['examBans', 'classWarnings'] } });
    data.users.set('sv-1', { id: 'sv-1', studentCode: '102210001', fullName: 'Nguyễn Văn A', role: 'STUDENT', class: { facultyId: 'fac-cntt' } });
    data.handoffs.set('sv-1:term-1', { studentId: 'sv-1', termId: 'term-1', facultyId: 'fac-cntt', status: 'WORKING' });

    const service = new GroundingImportService(prisma, {}, {});

    await service.preview(
      { id: 'staff-1', role: Role.STAFF, facultyId: 'fac-cntt' },
      {
        termId: 'term-1',
        type: ImportBatchType.ACADEMIC,
        source: 'HocVu.xlsx',
        rows: [{ studentCode: '102210001', criterionCode: '1', data: { examBans: 0, classWarnings: 0 } }],
      }
    );

    assert.equal(data.importBatches.size, 0, 'Preview không được tạo ImportBatch');
    assert.equal(data.academicGroundings.size, 0, 'Preview không được tạo AcademicGrounding');
    assert.equal(data.auditLogs.length, 0, 'Preview không được ghi AuditLog');
  });

  test('Ca 6: Confirm import ghi đúng dòng hợp lệ; hỗ trợ idempotencyReplay khi gửi trùng idempotencyKey', async () => {
    const { prisma, data } = createMockPrisma();

    data.terms.set('term-1', { id: 'term-1', status: 'ACTIVE', workflowEnabled: true, evidenceBasisWorkflowEnabled: true });
    data.rubricVersions.set('ver-1', {
      id: 'ver-1', termId: 'term-1', status: 'PUBLISHED',
      criteria: [{ id: 'crit-1', code: '1', maxScore: 6, scoringConfig: { kind: 'attendance_penalty', requiredData: ['examBans', 'classWarnings'] } }],
    });
    data.criteria.set('crit-1', { id: 'crit-1', code: '1', maxScore: 6, scoringConfig: { kind: 'attendance_penalty', requiredData: ['examBans', 'classWarnings'] } });
    data.users.set('sv-1', { id: 'sv-1', studentCode: '102210001', fullName: 'Nguyễn Văn A', role: 'STUDENT', class: { facultyId: 'fac-cntt' } });
    data.handoffs.set('sv-1:term-1', { studentId: 'sv-1', termId: 'term-1', facultyId: 'fac-cntt', status: 'WORKING' });

    const mockAssessments = { syncStudentGrounding: async () => {} };
    const service = new GroundingImportService(prisma, {}, {}, mockAssessments);

    const firstRun = await service.confirm(
      { id: 'staff-1', role: Role.STAFF, facultyId: 'fac-cntt' },
      {
        termId: 'term-1',
        type: ImportBatchType.ACADEMIC,
        source: 'HocVu.xlsx',
        idempotencyKey: 'idemp-test-1',
        previewTermId: 'term-1',
        validRows: [{ studentCode: '102210001', criterionCode: '1', data: { examBans: 0, classWarnings: 0 } }],
      }
    );

    assert.equal(firstRun.success, true);
    assert.equal(data.importBatches.size, 1);
    assert.equal(data.academicGroundings.size, 1);

    // Gửi lại cùng idempotencyKey -> Idempotency replay an toàn
    const secondRun = await service.confirm(
      { id: 'staff-1', role: Role.STAFF, facultyId: 'fac-cntt' },
      {
        termId: 'term-1',
        type: ImportBatchType.ACADEMIC,
        source: 'HocVu.xlsx',
        idempotencyKey: 'idemp-test-1',
        previewTermId: 'term-1',
        validRows: [{ studentCode: '102210001', criterionCode: '1', data: { examBans: 0, classWarnings: 0 } }],
      }
    );

    assert.equal(secondRun.idempotencyReplay, true);
    assert.equal(data.importBatches.size, 1, 'Không được tạo thêm lô mới khi gửi lặp');
  });

  test('Ca 7: Tái sử dụng batchAddParticipants nhận participants: [{ studentCode, formRole }] và gán batchId', async () => {
    const { prisma, data } = createMockPrisma();
    const { ActivitiesService } = require('../src/activities/activities.service');

    data.terms.set('term-1', { id: 'term-1', status: 'ACTIVE', workflowEnabled: true, evidenceBasisWorkflowEnabled: true });
    data.activities.set('act-1', { id: 'act-1', termId: 'term-1', facultyId: 'fac-cntt', organizer: 'Đoàn Khoa CNTT' });
    data.users.set('sv-1', { id: 'sv-1', studentCode: '102210001', role: 'STUDENT' });
    data.users.set('sv-2', { id: 'sv-2', studentCode: '102210002', role: 'STUDENT' });

    const mockWorkflow = {
      scope: async () => {},
      lock: async () => data.terms.get('term-1'),
    };
    const activitiesService = new ActivitiesService(prisma, mockWorkflow);

    const result = await activitiesService.batchAddParticipants(
      'act-1',
      {
        participants: [
          { studentCode: '102210001', formRole: 'BAN_TO_CHUC' },
          { studentCode: '102210002', formRole: 'CO_VU' },
        ],
        batchId: 'batch-act-1',
        source: 'Import_NgayHoi.xlsx',
      },
      { id: 'staff-1', role: Role.STAFF, facultyId: 'fac-cntt' }
    );

    assert.equal(result.success, true);
    assert.equal(result.addedCount, 2);

    const p1 = [...data.activityParticipants.values()].find(p => p.studentId === 'sv-1');
    assert.ok(p1);
    assert.equal(p1.formRole, 'BAN_TO_CHUC');
    assert.equal(p1.batchId, 'batch-act-1');
    assert.equal(p1.source, 'Import_NgayHoi.xlsx');

    const p2 = [...data.activityParticipants.values()].find(p => p.studentId === 'sv-2');
    assert.ok(p2);
    assert.equal(p2.formRole, 'CO_VU');
    assert.equal(p2.batchId, 'batch-act-1');
  });

  // ==========================================================================
  // NHÓM 2: TỰ ĐỘNG ĐỒNG BỘ CĂN CỨ VÀO CRITERION ASSESSMENT (POINT 2)
  // ==========================================================================

  test('Ca 8: Sau khi import AcademicGrounding, tự động đồng bộ vào CriterionAssessment (verifiedData, suggestedScore, READY_FOR_REVIEW)', async () => {
    const { prisma, data } = createMockPrisma();

    data.terms.set('term-1', { id: 'term-1', status: 'ACTIVE', workflowEnabled: true, evidenceBasisWorkflowEnabled: true });
    data.rubricVersions.set('ver-1', {
      id: 'ver-1', termId: 'term-1', status: 'PUBLISHED',
      criteria: [
        {
          id: 'crit-1', code: '1', maxScore: 6,
          scoringConfig: { kind: 'attendance_penalty', requiredData: ['examBans', 'classWarnings'], baseScore: 6, examBanPenalty: 3, warningPenalty: 1 },
        },
      ],
    });
    data.criteria.set('crit-1', {
      id: 'crit-1', code: '1', maxScore: 6,
      scoringConfig: { kind: 'attendance_penalty', requiredData: ['examBans', 'classWarnings'], baseScore: 6, examBanPenalty: 3, warningPenalty: 1 },
    });
    data.users.set('sv-1', { id: 'sv-1', studentCode: '102210001', fullName: 'Nguyễn Văn A', role: 'STUDENT', class: { facultyId: 'fac-cntt' } });
    data.handoffs.set('sv-1:term-1', { studentId: 'sv-1', termId: 'term-1', facultyId: 'fac-cntt', status: 'WORKING' });

    const assessmentsService = new AssessmentsService(prisma, {}, {});
    const groundingImportService = new GroundingImportService(prisma, {}, {}, assessmentsService);

    // Confirm import dữ liệu: cấm thi 0, nhắc nhở 1 lần -> Điểm đề xuất = 6 - 1 = 5 điểm
    await groundingImportService.confirm(
      { id: 'staff-1', role: Role.STAFF, facultyId: 'fac-cntt' },
      {
        termId: 'term-1',
        previewTermId: 'term-1',
        type: ImportBatchType.ACADEMIC,
        source: 'HocVu.xlsx',
        validRows: [{ studentCode: '102210001', criterionCode: '1', data: { examBans: 0, classWarnings: 1 } }],
      }
    );

    // Kiểm tra CriterionAssessment của sv-1 sau khi đồng bộ
    const ca = data.criterionAssessments.get('sv-1:term-1:crit-1');
    assert.ok(ca, 'Phải có bản ghi CriterionAssessment sau khi đồng bộ');
    assert.equal(ca.suggestedScore, 5, 'Điểm đề xuất phải được tính tự động từ công thức');
    assert.equal(ca.status, CriterionAssessmentStatus.READY_FOR_REVIEW);
    assert.deepEqual(ca.verifiedData, { examBans: 0, classWarnings: 1 });
  });

  test('Ca 9: Tiêu chí đã FINALIZED trước đó không bị ghi đè điểm chính thức khi đồng bộ grounding', async () => {
    const { prisma, data } = createMockPrisma();

    data.terms.set('term-1', { id: 'term-1', status: 'ACTIVE', workflowEnabled: true, evidenceBasisWorkflowEnabled: true });
    data.rubricVersions.set('ver-1', {
      id: 'ver-1', termId: 'term-1', status: 'PUBLISHED',
      criteria: [{ id: 'crit-1', code: '1', maxScore: 6, scoringConfig: { kind: 'attendance_penalty', requiredData: ['examBans', 'classWarnings'], baseScore: 6, examBanPenalty: 3, warningPenalty: 1 } }],
    });
    data.users.set('sv-1', { id: 'sv-1', studentCode: '102210001', fullName: 'Nguyễn Văn A', role: 'STUDENT' });

    // Đã chốt chính thức 4 điểm trước đó
    data.criterionAssessments.set('sv-1:term-1:crit-1', {
      id: 'ca-1', studentId: 'sv-1', termId: 'term-1', criterionId: 'crit-1',
      status: CriterionAssessmentStatus.FINALIZED, officialScore: 4, officialReason: 'Đã chốt trước',
    });

    data.academicGroundings.set('ag-1', {
      id: 'ag-1', studentId: 'sv-1', termId: 'term-1', criterionCode: '1',
      data: { examBans: 0, classWarnings: 0 }, status: 'ACTIVE',
    });

    const assessmentsService = new AssessmentsService(prisma, {}, {});
    await assessmentsService.syncStudentGrounding(prisma, 'sv-1', 'term-1');

    const ca = data.criterionAssessments.get('sv-1:term-1:crit-1');
    assert.equal(ca.status, CriterionAssessmentStatus.FINALIZED);
    assert.equal(ca.officialScore, 4, 'Điểm chính thức đã FINALIZED không được thay đổi');
  });

  test('Ca 10: getMine là request chỉ đọc, tuyệt đối KHÔNG ghi DB; đồng bộ diễn ra khi nộp phiếu (submitSelfAssessment)', async () => {
    const { prisma, data } = createMockPrisma();

    data.terms.set('term-1', { id: 'term-1', status: 'ACTIVE', workflowEnabled: true, evidenceBasisWorkflowEnabled: true });
    data.rubricVersions.set('ver-1', {
      id: 'ver-1', termId: 'term-1', status: 'PUBLISHED', version: 1,
      categories: [{ id: 'cat-1', code: 'KHUNG_I', name: 'Khung 1', maxScore: 20, position: 1, criteria: [{ id: 'crit-1', code: '1', maxScore: 6, scoringConfig: { kind: 'attendance_penalty', requiredData: ['examBans', 'classWarnings'], baseScore: 6, examBanPenalty: 3, warningPenalty: 1 } }] }],
      criteria: [{ id: 'crit-1', code: '1', maxScore: 6, scoringConfig: { kind: 'attendance_penalty', requiredData: ['examBans', 'classWarnings'], baseScore: 6, examBanPenalty: 3, warningPenalty: 1 } }],
    });
    data.users.set('sv-1', { id: 'sv-1', studentCode: '102210001', role: 'STUDENT' });
    data.criterionAssessments.set('sv-1:term-1:crit-1', {
      id: 'ca-1',
      studentId: 'sv-1',
      termId: 'term-1',
      criterionId: 'crit-1',
      selfScore: 6,
      status: CriterionAssessmentStatus.NEEDS_VERIFICATION,
    });
    data.academicGroundings.set('ag-1', {
      id: 'ag-1', studentId: 'sv-1', termId: 'term-1', criterionCode: '1',
      data: { examBans: 0, classWarnings: 0 }, status: 'ACTIVE', source: 'Phòng Đào tạo',
    });

    const mockWorkflow = {
      publication: async () => null,
      studentEdit: async (studentId, termId, write) => write(prisma),
      assertStudentEditable: async () => {},
    };
    const mockDeadlines = { resolve: async () => ({ deadline: new Date(Date.now() + 86400000), source: 'TERM' }) };
    const assessmentsService = new AssessmentsService(prisma, mockWorkflow, mockDeadlines);

    // 1. Gọi getMine (GET request) - TUYỆT ĐỐI KHÔNG GHI THÊM HOẶC THAY ĐỔI DB
    const mine = await assessmentsService.getMine('sv-1', 'term-1', false);
    assert.ok(mine);
    const caBefore = data.criterionAssessments.get('sv-1:term-1:crit-1');
    assert.equal(caBefore.suggestedScore, undefined, 'getMine chỉ đọc, không tự ý tính/ghi suggestedScore vào DB');

    // 2. Khi sinh viên nộp phiếu (submitSelfAssessment) - Đồng bộ diễn ra tại đây
    const submitRes = await assessmentsService.submitSelfAssessment('sv-1', 'term-1');
    assert.ok(submitRes);
    const caAfter = data.criterionAssessments.get('sv-1:term-1:crit-1');
    assert.equal(caAfter.suggestedScore, 6, 'Đồng bộ tính suggestedScore khi nộp phiếu');
    assert.equal(caAfter.status, CriterionAssessmentStatus.READY_FOR_REVIEW);
  });

  test('BL-033: student sees stored suggestions while official scores follow publication', async () => {
    const { prisma, data } = createMockPrisma();
    const term = { id: 'term-1', status: 'REVIEWING', workflowEnabled: true, evidenceBasisWorkflowEnabled: false };
    const criteria = [
      { id: 'academic', code: '1' },
      { id: 'attendance', code: '8' },
      { id: 'missing', code: '9' },
    ];
    data.rubricVersions.set('ver-1', {
      id: 'ver-1', termId: term.id, term, status: 'PUBLISHED',
      categories: [{ code: 'I', criteria }],
    });
    criteria.forEach((criterion, index) => {
      data.criterionAssessments.set('sv-1:term-1:' + criterion.id, {
        studentId: 'sv-1', termId: term.id, criterionId: criterion.id,
        suggestedScore: [5, 0, null][index],
        status: CriterionAssessmentStatus.FINALIZED,
        officialScore: 9,
        officialReason: 'Lý do nội bộ',
        finalizedAt: new Date('2026-11-02'),
        finalReviewerId: 'staff-private',
        verifiedData: index === 0 ? { examBans: 0 } : { verifiedActivityCount: 0 },
        verificationNote: 'Ghi chú nội bộ',
        suggestionReason: 'Căn cứ nội bộ',
      });
    });
    let publication = null;
    const service = new AssessmentsService(prisma, { publication: async () => publication }, {
      resolve: async () => ({ deadline: new Date('2026-12-01'), source: 'TERM' }),
    });
    const read = async () => (await service.getMine('sv-1', term.id)).categories[0].criteria.map(c => c.assessment);
    const before = await read();
    assert.deepEqual(before.map(c => c.suggestedScore), [5, 0, null]);
    for (const row of before) {
      for (const field of ['verifiedData', 'verificationNote', 'suggestionReason', 'officialScore', 'officialReason', 'finalizedAt', 'finalReviewerId']) {
        assert.equal(row[field], null, field);
      }
    }

    const finalizedAt = new Date('2026-11-01');
    publication = { revision: 1, snapshot: { categories: [{ criteria: [
      { id: 'academic', assessment: { officialScore: 3, officialReason: 'Lý do đã công bố', finalizedAt } },
    ] }] } };
    const [published, unpublished] = await read();
    assert.equal(published.suggestedScore, 5);
    assert.equal(published.officialScore, 3);
    assert.equal(published.officialReason, 'Lý do đã công bố');
    assert.equal(published.finalizedAt, finalizedAt);
    assert.equal(published.verifiedData, null);
    assert.equal(unpublished.officialScore, null);
  });

  // ==========================================================================
  // NHÓM 3: MINH CHỨNG 0-FILE & PREFLIGHT Ở KỲ MỚI
  // ==========================================================================

  test('Ca 11: Ở kỳ evidenceBasisWorkflowEnabled = true, minh chứng 0 file có mô tả >= 10 ký tự nộp thành công, chuyển sang NEEDS_HUMAN_REVIEW và KHÔNG tạo AiJob', async () => {
    const { prisma, data } = createMockPrisma();

    data.terms.set('term-new', { id: 'term-new', status: 'ACTIVE', workflowEnabled: true, evidenceBasisWorkflowEnabled: true });
    data.rubricVersions.set('ver-new', {
      id: 'ver-new', termId: 'term-new', status: 'PUBLISHED',
      categories: [{ id: 'cat-1', name: 'Khung 1', maxScore: 20, criteria: [{ id: 'crit-1', code: '1', maxScore: 6 }] }],
      criteria: [{ id: 'crit-1', code: '1', maxScore: 6 }],
    });
    data.users.set('sv-1', { id: 'sv-1', studentCode: '102210001', role: 'STUDENT' });
    data.criterionAssessments.set('sv-1:term-new:crit-1', { studentId: 'sv-1', termId: 'term-new', criterionId: 'crit-1', selfScore: 6 });

    // Minh chứng DRAFT không có tệp (files: []) nhưng có mô tả hợp lệ >= 10 ký tự
    data.evidences.set('evi-1', {
      id: 'evi-1', studentId: 'sv-1', termId: 'term-new', status: 'DRAFT', files: [],
      declaredActivityName: 'Tham gia hỗ trợ ngày hội tuyển sinh',
      description: 'Tôi tham gia hỗ trợ bàn hướng dẫn từ 7h sáng đến 17h chiều tại khu F',
    });

    const mockWorkflow = {
      assertStudentEditable: async () => {},
      studentEdit: async (studentId, termId, fn) => fn(prisma),
    };
    const mockDeadlines = { resolve: async () => ({ deadline: new Date(Date.now() + 86400000), source: 'TERM' }) };

    const assessmentsService = new AssessmentsService(prisma, mockWorkflow, mockDeadlines);

    const submitResult = await assessmentsService.submitSelfAssessment('sv-1', 'term-new');
    assert.equal(submitResult.submittedEvidenceCount, 1);

    const updatedEvi = data.evidences.get('evi-1');
    assert.equal(updatedEvi.status, EvidenceStatus.NEEDS_HUMAN_REVIEW, '0-file evidence phải chuyển sang NEEDS_HUMAN_REVIEW');
    assert.equal(data.aiJobs.length, 0, 'Tuyệt đối KHÔNG tạo AiProcessingJob cho evidence không có tệp');
  });

  test('Ca 12: Ở kỳ evidenceBasisWorkflowEnabled = false (kỳ cũ), minh chứng 0 file bị chặn như quy tắc cũ', async () => {
    const { prisma, data } = createMockPrisma();

    data.terms.set('term-old', { id: 'term-old', status: 'ACTIVE', workflowEnabled: true, evidenceBasisWorkflowEnabled: false });
    data.rubricVersions.set('ver-old', {
      id: 'ver-old', termId: 'term-old', status: 'PUBLISHED',
      categories: [{ id: 'cat-1', name: 'Khung 1', maxScore: 20, criteria: [{ id: 'crit-1', code: '1', maxScore: 6 }] }],
      criteria: [{ id: 'crit-1', code: '1', maxScore: 6 }],
    });
    data.users.set('sv-1', { id: 'sv-1', studentCode: '102210001', role: 'STUDENT' });
    data.criterionAssessments.set('sv-1:term-old:crit-1', { studentId: 'sv-1', termId: 'term-old', criterionId: 'crit-1', selfScore: 6 });

    data.evidences.set('evi-1', {
      id: 'evi-1', studentId: 'sv-1', termId: 'term-old', status: 'DRAFT', files: [],
      description: 'Mô tả rất dài hơn mười ký tự nhưng kỳ cũ bắt buộc phải có tệp',
    });

    const mockWorkflow = { assertStudentEditable: async () => {}, studentEdit: async (_s, _t, action) => action(prisma) };
    const mockDeadlines = { resolve: async () => ({ deadline: new Date(Date.now() + 86400000), source: 'TERM' }) };

    const assessmentsService = new AssessmentsService(prisma, mockWorkflow, mockDeadlines);

    await assert.rejects(
      async () => {
        await assessmentsService.submitSelfAssessment('sv-1', 'term-old');
      },
      /chưa có tệp/
    );
  });

  test('Ca 13: Preflight không cảnh báo thiếu minh chứng nếu đã có điểm danh CONFIRMED hoặc căn cứ học vụ / CLB', async () => {
    const { prisma, data } = createMockPrisma();

    data.terms.set('term-1', { id: 'term-1', status: 'ACTIVE', workflowEnabled: true, evidenceBasisWorkflowEnabled: true });
    data.rubricVersions.set('ver-1', {
      id: 'ver-1', termId: 'term-1', status: 'PUBLISHED',
      categories: [{
        id: 'cat-2', name: 'Khung 2', maxScore: 25,
        criteria: [{ id: 'crit-8', code: '8', maxScore: 5, scoringConfig: { kind: 'activity_threshold', tiers: [{ min: 1, score: 5 }] } }],
      }],
      criteria: [{ id: 'crit-8', code: '8', maxScore: 5, scoringConfig: { kind: 'activity_threshold', tiers: [{ min: 1, score: 5 }] } }],
    });
    data.users.set('sv-1', { id: 'sv-1', studentCode: '102210001', role: 'STUDENT' });
    data.criterionAssessments.set('sv-1:term-1:crit-8', {
      id: 'ca-8', studentId: 'sv-1', termId: 'term-1', criterionId: 'crit-8', selfScore: 5,
    });

    // Sinh viên ĐÃ CÓ ĐIỂM DANH CONFIRMED cho hoạt động thuộc tiêu chí 8
    data.activities.set('act-1', { id: 'act-1', termId: 'term-1', criterionId: 'crit-8' });
    data.activityParticipants.set('ap-1', {
      id: 'ap-1', studentId: 'sv-1', activityId: 'act-1', status: 'CONFIRMED',
      activity: { id: 'act-1', termId: 'term-1', criterionId: 'crit-8' },
    });

    const mockWorkflow = { assertStudentEditable: async () => {}, studentEdit: async (_s, _t, action) => action(prisma) };
    const mockDeadlines = { resolve: async () => ({ deadline: new Date(Date.now() + 86400000), source: 'TERM' }) };
    const assessmentsService = new AssessmentsService(prisma, mockWorkflow, mockDeadlines);

    const preflight = await assessmentsService.preflight('sv-1', 'term-1');

    assert.equal(preflight.canSubmit, true);
    assert.equal(preflight.warnings.length, 0, 'Không được phát sinh cảnh báo thiếu minh chứng khi đã có điểm danh CONFIRMED');
  });

  test('Ca 13b: Preflight miễn minh chứng cho TC1,2,3,6,7,11 và cảnh báo rõ cho Nhóm 3 & 4 (kể cả TC14 leadership_duty)', async () => {
    const { prisma, data } = createMockPrisma();

    data.terms.set('term-1', { id: 'term-1', status: 'ACTIVE', workflowEnabled: true, evidenceBasisWorkflowEnabled: true });
    const criteria = [
      { id: 'c1', code: '1', maxScore: 6, scoringConfig: { kind: 'attendance_penalty' } },
      { id: 'c2', code: '2', maxScore: 3, scoringConfig: { kind: 'group_penalty' } },
      { id: 'c3', code: '3', maxScore: 5, scoringConfig: { kind: 'academic_effort' } },
      { id: 'c6', code: '6', maxScore: 5, scoringConfig: { kind: 'manual_verified' } },
      { id: 'c7', code: '7', maxScore: 15, scoringConfig: { kind: 'conduct_penalty' } },
      { id: 'c11', code: '11', maxScore: 10, scoringConfig: { kind: 'all_conditions' } },
      { id: 'c4', code: '4', maxScore: 3, scoringConfig: { kind: 'verified_boolean' } },
      { id: 'c5', code: '5', maxScore: 3, scoringConfig: { kind: 'award_tier' } },
      { id: 'c14', code: '14', maxScore: 4, scoringConfig: { kind: 'leadership_duty' } },
      { id: 'c15', code: '15', maxScore: 3, scoringConfig: { kind: 'verified_boolean' } },
    ];
    data.rubricVersions.set('ver-1', {
      id: 'ver-1', termId: 'term-1', status: 'PUBLISHED',
      categories: [{ id: 'cat-all', name: 'Tổng hợp', maxScore: 100, criteria }],
      criteria,
    });
    data.users.set('sv-1', { id: 'sv-1', studentCode: '102210001', role: 'STUDENT' });
    for (const c of criteria) {
      data.criterionAssessments.set(`sv-1:term-1:${c.id}`, {
        id: `ca-${c.code}`, studentId: 'sv-1', termId: 'term-1', criterionId: c.id, selfScore: c.maxScore,
      });
    }
    // TC15 đã có minh chứng APPROVED từ lần nộp trước -> không được cảnh báo lại
    data.evidences.set('ev-15', {
      id: 'ev-15', studentId: 'sv-1', termId: 'term-1', criterionAssessmentId: 'ca-15', status: 'APPROVED', files: [{ id: 'f-1' }],
    });

    const mockWorkflow = { assertStudentEditable: async () => {}, studentEdit: async (_s, _t, action) => action(prisma) };
    const mockDeadlines = { resolve: async () => ({ deadline: new Date(Date.now() + 86400000), source: 'TERM' }) };
    const assessmentsService = new AssessmentsService(prisma, mockWorkflow, mockDeadlines);

    const preflight = await assessmentsService.preflight('sv-1', 'term-1');

    assert.equal(preflight.canSubmit, true);
    assert.equal(preflight.warnings.length, 1);
    assert.match(preflight.warnings[0], /TC4, TC5, TC14/);
    assert.match(preflight.warnings[0], /bắt buộc phải nộp minh chứng hoặc có xác nhận hoạt động/i);
    assert.doesNotMatch(preflight.warnings[0], /TC1\b|TC2\b|TC3\b|TC6\b|TC7\b|TC11\b|TC15\b/);
  });

  // ==========================================================================
  // NHÓM 4: THU HỒI LÔ (BATCH REVOKE)
  // ==========================================================================

  test('Ca 14: Lô chưa có sinh viên nào bị chốt điểm -> Thu hồi thành công, tự động reset điểm đề xuất liên quan', async () => {
    const { prisma, data } = createMockPrisma();

    data.terms.set('term-1', { id: 'term-1', status: 'ACTIVE', workflowEnabled: true, evidenceBasisWorkflowEnabled: true });
    data.importBatches.set('batch-1', {
      id: 'batch-1', termId: 'term-1', facultyId: 'fac-cntt', type: ImportBatchType.ACADEMIC, status: ImportBatchStatus.ACTIVE,
    });
    data.academicGroundings.set('ag-1', {
      id: 'ag-1', batchId: 'batch-1', studentId: 'sv-1', termId: 'term-1', criterionCode: '1', status: GroundingStatus.ACTIVE,
    });
    data.criterionAssessments.set('sv-1:term-1:crit-1', {
      id: 'ca-1', studentId: 'sv-1', termId: 'term-1', criterionId: 'crit-1',
      status: CriterionAssessmentStatus.READY_FOR_REVIEW, suggestedScore: 5, verificationNote: 'Ghi chú tùy ý', academicGroundingId: 'ag-1',
    });
    data.handoffs.set('sv-1:term-1', { studentId: 'sv-1', termId: 'term-1', facultyId: 'fac-cntt', status: 'WORKING' });
    data.rubricVersions.set('ver-1', {
      id: 'ver-1', termId: 'term-1', status: 'PUBLISHED',
      criteria: [{ id: 'crit-1', code: '1', maxScore: 6 }],
    });

    const assessmentsService = new AssessmentsService(prisma, {}, {});
    const groundingImportService = new GroundingImportService(prisma, {}, {}, assessmentsService);

    const revokeRes = await groundingImportService.revokeBatch(
      { id: 'staff-1', role: Role.STAFF, facultyId: 'fac-cntt' },
      'batch-1',
      'Phát hiện nhầm file dữ liệu'
    );

    assert.equal(revokeRes.success, true);
    assert.equal(data.importBatches.get('batch-1').status, ImportBatchStatus.REVOKED);
    assert.equal(data.academicGroundings.get('ag-1').status, GroundingStatus.REVOKED);

    // Điểm đề xuất sinh ra từ lô này phải bị reset về null / NEEDS_VERIFICATION
    const ca = data.criterionAssessments.get('sv-1:term-1:crit-1');
    assert.equal(ca.status, CriterionAssessmentStatus.NEEDS_VERIFICATION);
    assert.equal(ca.suggestedScore, null);
  });

  test('Ca 15: Có ít nhất một dòng trong lô đã được dùng để chốt điểm (FINALIZED) -> Chặn toàn bộ lô', async () => {
    const { prisma, data } = createMockPrisma();

    data.terms.set('term-1', { id: 'term-1', status: 'ACTIVE', workflowEnabled: true, evidenceBasisWorkflowEnabled: true });
    data.importBatches.set('batch-1', {
      id: 'batch-1', termId: 'term-1', facultyId: 'fac-cntt', type: ImportBatchType.ACADEMIC, status: ImportBatchStatus.ACTIVE,
    });
    data.academicGroundings.set('ag-1', {
      id: 'ag-1', batchId: 'batch-1', studentId: 'sv-1', termId: 'term-1', criterionCode: '1', status: GroundingStatus.ACTIVE,
      student: { studentCode: '102210001', fullName: 'Nguyễn Văn A' },
    });
    data.rubricVersions.set('ver-1', {
      id: 'ver-1', termId: 'term-1', status: 'PUBLISHED',
      criteria: [{ id: 'crit-1', code: '1', maxScore: 6 }],
    });
    data.criteria.set('crit-1', { id: 'crit-1', code: '1', maxScore: 6 });

    // Tiêu chí 1 của sinh viên sv-1 ĐÃ BỊ CHỐT FINALIZED
    data.criterionAssessments.set('sv-1:term-1:crit-1', {
      id: 'ca-1', studentId: 'sv-1', termId: 'term-1', criterionId: 'crit-1',
      status: CriterionAssessmentStatus.FINALIZED, officialScore: 6,
    });
    data.handoffs.set('sv-1:term-1', { studentId: 'sv-1', termId: 'term-1', facultyId: 'fac-cntt', status: 'WORKING', student: { studentCode: '102210001', fullName: 'Nguyễn Văn A' } });

    const groundingImportService = new GroundingImportService(prisma, {}, {}, {});

    await assert.rejects(
      async () => {
        await groundingImportService.revokeBatch(
          { id: 'staff-1', role: Role.STAFF, facultyId: 'fac-cntt' },
          'batch-1',
          'Muốn thu hồi'
        );
      },
      (err) => {
        assert.match(err.message, /Không thể thu hồi lô/);
        assert.ok(err.response.blockers.some((b) => b.includes('FINALIZED')));
        return true;
      }
    );

    // Trạng thái lô vẫn phải là ACTIVE (không bị thu hồi nửa vời)
    assert.equal(data.importBatches.get('batch-1').status, ImportBatchStatus.ACTIVE);
  });

  test('Ca 16: Có ít nhất một sinh viên trong lô đã được gửi lên Admin (SENT) -> Chặn toàn bộ lô', async () => {
    const { prisma, data } = createMockPrisma();

    data.terms.set('term-1', { id: 'term-1', status: 'ACTIVE', workflowEnabled: true, evidenceBasisWorkflowEnabled: true });
    data.importBatches.set('batch-1', {
      id: 'batch-1', termId: 'term-1', facultyId: 'fac-cntt', type: ImportBatchType.ACADEMIC, status: ImportBatchStatus.ACTIVE,
    });
    data.academicGroundings.set('ag-1', {
      id: 'ag-1', batchId: 'batch-1', studentId: 'sv-1', termId: 'term-1', criterionCode: '1', status: GroundingStatus.ACTIVE,
      student: { studentCode: '102210001', fullName: 'Nguyễn Văn A' },
    });
    data.handoffs.set('sv-1:term-1', {
      studentId: 'sv-1', termId: 'term-1', facultyId: 'fac-cntt', status: 'SENT',
      student: { studentCode: '102210001', fullName: 'Nguyễn Văn A' },
    });

    const groundingImportService = new GroundingImportService(prisma, {}, {}, {});

    await assert.rejects(
      async () => {
        await groundingImportService.revokeBatch(
          { id: 'staff-1', role: Role.STAFF, facultyId: 'fac-cntt' },
          'batch-1',
          'Lý do thu hồi'
        );
      },
      (err) => {
        assert.match(err.message, /Không thể thu hồi lô/);
        assert.ok(err.response.blockers.some((b) => b.includes('SENT')));
        return true;
      }
    );
  });

  // ==========================================================================
  // NHÓM 5: CHỐT PHIẾU SINH VIÊN & CHỐT HÀNG LOẠT (POINT 3)
  // ==========================================================================

  test('Ca 17: Chốt một phiếu sinh viên: Chuyển toàn bộ tiêu chí READY_FOR_REVIEW thành FINALIZED với officialScore = suggestedScore', async () => {
    const { prisma, data } = createMockPrisma();

    data.terms.set('term-1', { id: 'term-1', status: 'ACTIVE', workflowEnabled: true, evidenceBasisWorkflowEnabled: true });
    data.rubricVersions.set('ver-1', {
      id: 'ver-1', termId: 'term-1', status: 'PUBLISHED',
      criteria: [
        { id: 'c-1', code: '1', maxScore: 6 },
        { id: 'c-2', code: '2', maxScore: 3 },
      ],
    });
    data.users.set('sv-1', { id: 'sv-1', studentCode: '102210001', role: 'STUDENT' });
    data.handoffs.set('sv-1:term-1', { studentId: 'sv-1', termId: 'term-1', facultyId: 'fac-cntt', status: 'WORKING' });
    data.submissions.set('sv-1:term-1:ver-1', { studentId: 'sv-1', termId: 'term-1', rubricVersionId: 'ver-1', status: 'SUBMITTED' });

    // Tiêu chí c-1 READY_FOR_REVIEW (suggested: 5)
    data.criterionAssessments.set('sv-1:term-1:c-1', {
      id: 'ca-1', studentId: 'sv-1', termId: 'term-1', criterionId: 'c-1',
      status: CriterionAssessmentStatus.READY_FOR_REVIEW, suggestedScore: 5,
    });
    // Tiêu chí c-2 ĐÃ FINALIZED trước đó (official: 3)
    data.criterionAssessments.set('sv-1:term-1:c-2', {
      id: 'ca-2', studentId: 'sv-1', termId: 'term-1', criterionId: 'c-2',
      status: CriterionAssessmentStatus.FINALIZED, officialScore: 3,
    });

    const mockWorkflow = {
      scope: async () => {},
      edit: async (staff, studentId, termId, fn) => fn(prisma),
    };

    const assessmentsService = new AssessmentsService(prisma, mockWorkflow, {});

    const finalizeRes = await assessmentsService.finalizeStudentAssessment(
      { id: 'staff-1', role: Role.STAFF, facultyId: 'fac-cntt' },
      'sv-1',
      'term-1'
    );

    assert.equal(finalizeRes.success, true);
    assert.equal(finalizeRes.finalizedCount, 1);

    const ca1 = data.criterionAssessments.get('sv-1:term-1:c-1');
    assert.equal(ca1.status, CriterionAssessmentStatus.FINALIZED);
    assert.equal(ca1.officialScore, 5, 'Điểm chính thức phải bằng điểm đề xuất');

    const ca2 = data.criterionAssessments.get('sv-1:term-1:c-2');
    assert.equal(ca2.officialScore, 3, 'Tiêu chí đã chốt trước đó phải giữ nguyên');
  });

  test('Ca 18: Chặn chốt phiếu khi còn minh chứng ở trạng thái NEEDS_HUMAN_REVIEW hoặc NEEDS_SUPPLEMENT (Point 3)', async () => {
    const { prisma, data } = createMockPrisma();

    data.terms.set('term-1', { id: 'term-1', status: 'ACTIVE', workflowEnabled: true, evidenceBasisWorkflowEnabled: true });
    data.rubricVersions.set('ver-1', {
      id: 'ver-1', termId: 'term-1', status: 'PUBLISHED',
      criteria: [{ id: 'c-1', code: '1', maxScore: 6 }],
    });
    data.users.set('sv-1', { id: 'sv-1', studentCode: '102210001', role: 'STUDENT' });
    data.handoffs.set('sv-1:term-1', { studentId: 'sv-1', termId: 'term-1', facultyId: 'fac-cntt', status: 'WORKING' });
    data.submissions.set('sv-1:term-1:ver-1', { studentId: 'sv-1', termId: 'term-1', rubricVersionId: 'ver-1', status: 'SUBMITTED' });
    data.criterionAssessments.set('sv-1:term-1:c-1', {
      id: 'ca-1', studentId: 'sv-1', termId: 'term-1', criterionId: 'c-1',
      status: CriterionAssessmentStatus.READY_FOR_REVIEW, suggestedScore: 6,
    });

    // Còn minh chứng NEEDS_SUPPLEMENT
    data.evidences.set('evi-supp', {
      id: 'evi-supp', studentId: 'sv-1', termId: 'term-1', status: EvidenceStatus.NEEDS_SUPPLEMENT,
    });

    const mockWorkflow = {
      scope: async () => {},
      edit: async (staff, studentId, termId, fn) => fn(prisma),
    };
    const assessmentsService = new AssessmentsService(prisma, mockWorkflow, {});

    await assert.rejects(
      async () => {
        await assessmentsService.finalizeStudentAssessment(
          { id: 'staff-1', role: Role.STAFF, facultyId: 'fac-cntt' },
          'sv-1',
          'term-1'
        );
      },
      /minh chứng đang chờ xử lý/
    );
  });

  test('Ca 19: Chốt hàng loạt tối đa 100 phiếu, transaction riêng từng phiếu: phiếu lỗi không ảnh hưởng phiếu hợp lệ', async () => {
    const { prisma, data } = createMockPrisma();

    data.terms.set('term-1', { id: 'term-1', status: 'ACTIVE', workflowEnabled: true, evidenceBasisWorkflowEnabled: true });
    data.rubricVersions.set('ver-1', {
      id: 'ver-1', termId: 'term-1', status: 'PUBLISHED',
      criteria: [{ id: 'c-1', code: '1', maxScore: 6 }, { id: 'c-2', code: '2', maxScore: 6 }],
    });

    // Sinh viên 1: Hợp lệ để chốt
    data.users.set('sv-1', { id: 'sv-1', studentCode: '102210001', fullName: 'Nguyễn Văn Hợp Lệ', role: 'STUDENT' });
    data.handoffs.set('sv-1:term-1', { studentId: 'sv-1', termId: 'term-1', facultyId: 'fac-cntt', status: 'WORKING' });
    data.submissions.set('sv-1:term-1:ver-1', { studentId: 'sv-1', termId: 'term-1', rubricVersionId: 'ver-1', status: 'SUBMITTED' });
    data.criterionAssessments.set('sv-1:term-1:c-1', {
      id: 'ca-1', studentId: 'sv-1', termId: 'term-1', criterionId: 'c-1',
      status: CriterionAssessmentStatus.READY_FOR_REVIEW, suggestedScore: 6,
    });
    data.criterionAssessments.set('sv-1:term-1:c-2', {
      id: 'ca-2', studentId: 'sv-1', termId: 'term-1', criterionId: 'c-2',
      status: CriterionAssessmentStatus.FINALIZED, suggestedScore: 3, officialScore: 0,
    });

    // Sinh viên 2: CHƯA NỘP PHIẾU (sẽ bị lỗi riêng)
    data.users.set('sv-2', { id: 'sv-2', studentCode: '102210002', fullName: 'Lê Văn Lỗi', role: 'STUDENT' });
    data.handoffs.set('sv-2:term-1', { studentId: 'sv-2', termId: 'term-1', facultyId: 'fac-cntt', status: 'WORKING' });
    // Chưa có submission

    const assessmentsService = new AssessmentsService(prisma, new WorkflowService(prisma, {}), {});
    const actor = { id: 'staff-1', role: Role.STAFF, facultyId: 'fac-cntt' };
    const preview = await assessmentsService.previewFinalizeStudent(actor, 'sv-1', 'term-1');
    assert.deepEqual(preview.criteria.map(c => [c.status, c.projectedScore]), [
      ['READY_TO_FINALIZE', 6], ['ALREADY_FINALIZED', 0],
    ]);

    const batchRes = await assessmentsService.batchFinalizeAssessments(
      actor,
      'term-1',
      ['sv-1', 'sv-2']
    );

    assert.equal(batchRes.totalRequested, 2);
    assert.equal(batchRes.successCount, 1, 'sv-1 phải thành công');
    assert.equal(batchRes.failureCount, 1, 'sv-2 phải thất bại');

    const res1 = batchRes.results.find(r => r.studentId === 'sv-1');
    assert.equal(res1.success, true);
    assert.equal(res1.finalizedCount, 1);

    const res2 = batchRes.results.find(r => r.studentId === 'sv-2');
    assert.equal(res2.success, false);
    assert.equal(res2.finalizedCount, 0);
    assert.match(res2.blockers[0], /chưa nộp phiếu/);

    // Kiểm tra trạng thái trong DB: sv-1 đã được chốt FINALIZED
    const ca1 = data.criterionAssessments.get('sv-1:term-1:c-1');
    assert.equal(ca1.status, CriterionAssessmentStatus.FINALIZED);
    assert.equal(data.criterionAssessments.get('sv-1:term-1:c-2').officialScore, 0);
  });

  test('Ca 20: Chốt hàng loạt từ chối khi danh sách vượt quá 100 phiếu', async () => {
    const { prisma } = createMockPrisma();
    const assessmentsService = new AssessmentsService(prisma, {}, {});

    const studentIds = Array.from({ length: 105 }, (_, i) => `sv-${i}`);

    await assert.rejects(
      async () => {
        await assessmentsService.batchFinalizeAssessments(
          { id: 'staff-1', role: Role.STAFF, facultyId: 'fac-cntt' },
          'term-1',
          studentIds
        );
      },
      /tối đa 100 phiếu/
    );
  });

  // ==========================================================================
  // NHÓM 5: KIỂM CHỨNG CÁC ĐIỂM SỬA CHỮA THEO REVIEW ĐỘC LẬP
  // ==========================================================================

  test('Ca 21: Confirm import re-validation độc lập: loại bỏ sinh viên sai Khoa và dữ liệu vi phạm schema', async () => {
    const { prisma, data } = createMockPrisma();

    data.terms.set('term-1', { id: 'term-1', status: 'ACTIVE', evidenceBasisWorkflowEnabled: true });
    data.rubricVersions.set('ver-1', {
      id: 'ver-1', termId: 'term-1', status: 'PUBLISHED',
      criteria: [{ id: 'crit-1', code: '1', maxScore: 6, scoringConfig: { kind: 'attendance_penalty', requiredData: ['examBans', 'classWarnings'], baseScore: 6, examBanPenalty: 3, warningPenalty: 1 } }],
    });

    // sv-1: thuộc Khoa CNTT theo snapshot handoff của kỳ 1
    data.users.set('sv-1', { id: 'sv-1', studentCode: '102210001', fullName: 'Nguyễn Văn CNTT', role: 'STUDENT', class: { facultyId: 'fac-cntt' } });
    data.handoffs.set('sv-1:term-1', { id: 'h-1', studentId: 'sv-1', termId: 'term-1', facultyId: 'fac-cntt', status: 'WORKING' });

    // sv-2: sinh viên Khoa Cơ khí (handoff snapshot kỳ 1 là fac-cokhi, dù hiện tại đã chuyển lớp)
    data.users.set('sv-2', { id: 'sv-2', studentCode: '102210002', fullName: 'Trần Văn Cơ khí', role: 'STUDENT', class: { facultyId: 'fac-cntt' } });
    data.handoffs.set('sv-2:term-1', { id: 'h-2', studentId: 'sv-2', termId: 'term-1', facultyId: 'fac-cokhi', status: 'WORKING' });

    // sv-3: thuộc Khoa CNTT nhưng dữ liệu bị sửa thành số âm sau preview
    data.users.set('sv-3', { id: 'sv-3', studentCode: '102210003', fullName: 'Lê Thị CNTT', role: 'STUDENT', class: { facultyId: 'fac-cntt' } });
    data.handoffs.set('sv-3:term-1', { id: 'h-3', studentId: 'sv-3', termId: 'term-1', facultyId: 'fac-cntt', status: 'WORKING' });

    const mockWorkflow = {
      lock: async () => data.terms.get('term-1'),
    };
    const mockAssessments = {
      syncStudentGrounding: async () => {},
    };
    const groundingService = new GroundingImportService(prisma, mockWorkflow, {}, mockAssessments);

    const actorStaff = { id: 'staff-cntt', role: Role.STAFF, facultyId: 'fac-cntt' };

    // Confirm gửi 3 dòng: dòng 1 hợp lệ, dòng 2 sai Khoa theo snapshot kỳ, dòng 3 sai schema
    const result = await groundingService.confirm(actorStaff, {
      termId: 'term-1',
      previewTermId: 'term-1',
      type: ImportBatchType.ACADEMIC,
      source: 'Test_Import.xlsx',
      validRows: [
        { studentCode: '102210001', criterionCode: '1', data: { examBans: 0, classWarnings: 0 } },
        { studentCode: '102210002', criterionCode: '1', data: { examBans: 0, classWarnings: 0 } }, // Sai Khoa
        { studentCode: '102210003', criterionCode: '1', data: { examBans: -5, classWarnings: 0 } }, // Sai schema
      ],
    });

    assert.equal(result.success, true);
    assert.equal(result.validRows, 1, 'Chỉ có 1 dòng duy nhất thỏa mãn kiểm tra độc lập trong transaction');
    assert.equal(result.affectedStudentsCount, 1);
  });

  test('Ca 22: batchAddParticipants với externalTx không tạo transaction lồng hay lock term lặp lại', async () => {
    const { prisma, data } = createMockPrisma();

    data.terms.set('term-1', { id: 'term-1', status: 'ACTIVE', workflowEnabled: false, evidenceBasisWorkflowEnabled: true });
    data.activities.set('act-1', {
      id: 'act-1',
      termId: 'term-1',
      facultyId: 'fac-cntt',
      name: 'Hội thảo khoa học CNTT',
      type: 'ACADEMIC',
    });
    data.users.set('sv-1', { id: 'sv-1', studentCode: '102210001', role: 'STUDENT', class: { facultyId: 'fac-cntt' } });

    let mutateCalled = false;
    const mockWorkflow = {
      lock: async () => {
        throw new Error('Không được gọi workflow.lock lặp lại khi đã có externalTx');
      },
    };

    const activitiesService = new ActivitiesService(prisma, mockWorkflow);
    // Ghi đè mutate để phát hiện nếu bị gọi
    activitiesService.mutate = async () => {
      mutateCalled = true;
      throw new Error('mutate không được gọi khi truyền externalTx');
    };

    const actor = { id: 'staff-cntt', role: Role.STAFF, facultyId: 'fac-cntt' };

    // Gọi với externalTx (ở đây truyền prisma làm transaction double)
    const result = await activitiesService.batchAddParticipants(
      'act-1',
      { studentCodes: ['102210001'], formRole: 'THAM_GIA_CHINH' },
      actor,
      prisma
    );

    assert.equal(mutateCalled, false, 'mutate không được gọi');
    assert.equal(result.success, true);
    assert.equal(result.addedCount, 1);
  });

  test('Ca 23: Thu hồi lô hoạt động giữ lịch sử bản ghi CONFIRMED và tính lại điểm gợi ý', async () => {
    const { prisma, data } = createMockPrisma();

    data.terms.set('term-1', { id: 'term-1', status: 'ACTIVE', evidenceBasisWorkflowEnabled: true });
    data.activities.set('act-1', {
      id: 'act-1',
      termId: 'term-1',
      criterionId: 'crit-8',
      facultyId: 'fac-cntt',
      name: 'Chiến dịch Mùa hè xanh',
    });
    data.users.set('sv-1', { id: 'sv-1', studentCode: '102210001', fullName: 'SV 1', role: 'STUDENT' });

    data.importBatches.set('batch-act-1', {
      id: 'batch-act-1',
      termId: 'term-1',
      facultyId: 'fac-cntt',
      type: ImportBatchType.ACTIVITY,
      status: ImportBatchStatus.ACTIVE,
    });

    // Sinh viên có bản ghi điểm danh đã CONFIRMED từ lô này
    data.activityParticipants.set('ap-1', {
      id: 'ap-1',
      activityId: 'act-1',
      studentId: 'sv-1',
      batchId: 'batch-act-1',
      status: 'CONFIRMED',
    });

    const groundingService = new GroundingImportService(prisma, {}, {}, {});
    const actor = { id: 'staff-cntt', role: Role.STAFF, facultyId: 'fac-cntt' };

    const revokeRes = await groundingService.revokeBatch(actor, 'batch-act-1', {
      reason: 'Nhầm lẫn danh sách điểm danh lớp khác',
    });

    assert.equal(revokeRes.success, true);
    assert.equal(data.activityParticipants.get('ap-1').status, 'REVOKED');
    assert.equal(data.activityParticipants.get('ap-1').revokeReason, 'Nhầm lẫn danh sách điểm danh lớp khác');
    const batch = data.importBatches.get('batch-act-1');
    assert.equal(batch.status, ImportBatchStatus.REVOKED);
  });

  test('Ca 24: Sửa tay qua verifyCriterion không bị syncStudentGrounding ghi đè (bảo vệ căn cứ thủ công của cán bộ)', async () => {
    const { prisma, data } = createMockPrisma();

    data.terms.set('term-1', { id: 'term-1', status: 'ACTIVE', evidenceBasisWorkflowEnabled: true });
    data.rubricVersions.set('ver-1', {
      id: 'ver-1', termId: 'term-1', status: 'PUBLISHED',
      criteria: [{ id: 'crit-1', code: '1', maxScore: 6, scoringConfig: { kind: 'attendance_penalty', requiredData: ['examBans', 'classWarnings'], baseScore: 6, examBanPenalty: 3, warningPenalty: 1 } }],
    });
    data.users.set('sv-1', { id: 'sv-1', studentCode: '102210001', role: 'STUDENT' });

    // Cán bộ Khoa đã xác minh thủ công tiêu chí 1
    data.criterionAssessments.set('sv-1:term-1:crit-1', {
      id: 'ca-1',
      studentId: 'sv-1',
      termId: 'term-1',
      criterionId: 'crit-1',
      verifiedData: { examBans: 0, classWarnings: 1 },
      verificationNote: 'Cán bộ trực tiếp kiểm tra sổ đầu bài tại lớp',
      suggestedScore: 5,
      status: CriterionAssessmentStatus.READY_FOR_REVIEW,
    });

    // Hệ thống có bản ghi AcademicGrounding khác
    data.academicGroundings.set('ag-1', {
      id: 'ag-1',
      studentId: 'sv-1',
      termId: 'term-1',
      criterionCode: '1',
      data: { examBans: 0, classWarnings: 0 },
      source: 'Phòng Đào tạo',
      status: 'ACTIVE',
    });

    const assessmentsService = new AssessmentsService(prisma, {}, {});

    // Chạy syncStudentGrounding
    await assessmentsService.syncStudentGrounding(prisma, 'sv-1', 'term-1', 'ver-1');

    const ca = data.criterionAssessments.get('sv-1:term-1:crit-1');
    // Phải bảo toàn dữ liệu thủ công của cán bộ, không bị ghi đè thành 6 điểm
    assert.equal(ca.verificationNote, 'Cán bộ trực tiếp kiểm tra sổ đầu bài tại lớp');
    assert.equal(ca.suggestedScore, 5);
    assert.deepEqual(ca.verifiedData, { examBans: 0, classWarnings: 1 });
  });

  test('Ca 25: CriteriaService.updateTerm chặn đổi evidenceBasisWorkflowEnabled khi kỳ đã có publication hoặc handoff SENT', async () => {
    const { prisma, data } = createMockPrisma();

    const now = Date.now();
    data.terms.set('term-pub', {
      id: 'term-pub',
      name: 'Học kỳ 1 2026-2027',
      status: 'ACTIVE',
      evidenceBasisWorkflowEnabled: true,
      startDate: new Date(now - 10 * 86400000),
      endDate: new Date(now + 100 * 86400000),
      submissionDeadline: new Date(now + 30 * 86400000),
      reviewDeadline: new Date(now + 60 * 86400000),
      appealDeadline: new Date(now + 80 * 86400000),
    });

    // Đã có publication trong kỳ
    data.assessmentPublications.set('pub-1', { id: 'pub-1', termId: 'term-pub' });

    const criteriaService = new CriteriaService(prisma, {});
    criteriaService.auditMaster = async (actorId, entityType, id, action, write) => write(prisma);

    await assert.rejects(
      async () => {
        await criteriaService.updateTerm('term-pub', { evidenceBasisWorkflowEnabled: false }, 'admin-1');
      },
      /đã có kết quả bàn giao hoặc công bố/
    );
  });
});
