const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require(path.join(__dirname, '../node_modules/ts-node')).register({
  project: path.join(__dirname, '../tsconfig.json'),
});

const { WorkflowService } = require('../src/evaluation-workflow/workflow.service');
const { DeadlineExtensionsService } = require('../src/deadline-extensions/deadline-extensions.service');
const { DeadlineExtensionTargetsQueryDto } = require('../src/deadline-extensions/deadline-extensions.controller');
const { Role, DeadlineExtensionTarget, DeadlineExtensionType } = require('@prisma/client');
const { validate } = require('class-validator');
const { plainToInstance } = require('class-transformer');

// =====================================================================
// Mutex mô phỏng cơ chế khóa hàng PostgreSQL (SELECT FOR UPDATE)
// =====================================================================
class TermLockSimulator {
  constructor() {
    this.locks = new Map();
  }

  async acquire(termId) {
    if (!this.locks.has(termId)) {
      this.locks.set(termId, { locked: false, queue: [] });
    }
    const state = this.locks.get(termId);
    if (!state.locked) {
      state.locked = true;
      return;
    }
    return new Promise((resolve) => state.queue.push(resolve));
  }

  release(termId) {
    const state = this.locks.get(termId);
    if (!state) return;
    if (state.queue.length > 0) {
      const next = state.queue.shift();
      next();
    } else {
      state.locked = false;
    }
  }

  isLocked(termId) {
    return Boolean(this.locks.get(termId)?.locked);
  }

  getQueueLength(termId) {
    return this.locks.get(termId)?.queue?.length || 0;
  }
}

// =====================================================================
// In-memory Database Fixture cho Workflow & DeadlineExtensions
// =====================================================================
function createWorkflowFixture(initialData = {}) {
  let terms = initialData.terms ? [...initialData.terms] : [];
  let users = initialData.users ? [...initialData.users] : [];
  let classes = initialData.classes ? [...initialData.classes] : [];
  let handoffs = initialData.handoffs ? [...initialData.handoffs] : [];
  let extensions = initialData.extensions ? [...initialData.extensions] : [];
  let assessments = initialData.assessments ? [...initialData.assessments] : [];
  let publications = initialData.publications ? [...initialData.publications] : [];
  let auditLogs = [];
  let autoId = 100;
  let onLockHook = null;

  const lockSimulator = new TermLockSimulator();

  const mockPrisma = {
    term: {
      findUnique: async ({ where }) => {
        return terms.find((t) => t.id === where.id) || null;
      },
      findUniqueOrThrow: async ({ where }) => {
        const t = terms.find((t) => t.id === where.id);
        if (!t) throw new Error(`Term ${where.id} not found`);
        return t;
      },
      update: async ({ where, data }) => {
        const index = terms.findIndex((t) => t.id === where.id);
        if (index === -1) throw new Error('Term not found');
        terms[index] = { ...terms[index], ...data };
        return terms[index];
      },
    },
    user: {
      findUnique: async ({ where }) => {
        return users.find((u) => u.id === where.id) || null;
      },
      findMany: async ({ where = {} }) => {
        return users.filter((u) => {
          if (where.role && u.role !== where.role) return false;
          return true;
        });
      },
    },
    class: {
      findUnique: async ({ where }) => {
        return classes.find((c) => c.id === where.id) || null;
      },
      findMany: async ({ where = {}, skip = 0, take } = {}) => {
        let results = classes.filter((c) => {
          if (where.id && where.id.in && !where.id.in.includes(c.id)) return false;
          if (where.OR) {
            const matchesOr = where.OR.some((cond) => {
              if (cond.code && cond.code.contains) {
                return c.code.toLowerCase().includes(cond.code.contains.toLowerCase());
              }
              if (cond.name && cond.name.contains) {
                return c.name.toLowerCase().includes(cond.name.contains.toLowerCase());
              }
              return false;
            });
            if (!matchesOr) return false;
          }
          return true;
        });

        results.sort((a, b) => a.code.localeCompare(b.code));
        if (take !== undefined) {
          return results.slice(skip, skip + take);
        }
        return results;
      },
      count: async ({ where = {} } = {}) => {
        const list = await mockPrisma.class.findMany({ where });
        return list.length;
      },
    },
    assessmentHandoff: {
      findMany: async ({ where = {}, select, include, skip = 0, take, distinct } = {}) => {
        let results = handoffs.filter((h) => {
          if (where.termId && h.termId !== where.termId) return false;
          if (where.classId && h.classId !== where.classId) return false;
          if (where.student) {
            const student = users.find((u) => u.id === h.studentId);
            if (!student) return false;
            if (where.student.OR) {
              const matchesOr = where.student.OR.some((cond) => {
                if (cond.studentCode && cond.studentCode.contains) {
                  return student.studentCode.toLowerCase().includes(cond.studentCode.contains.toLowerCase());
                }
                if (cond.fullName && cond.fullName.contains) {
                  return student.fullName.toLowerCase().includes(cond.fullName.contains.toLowerCase());
                }
                return false;
              });
              if (!matchesOr) return false;
            }
          }
          return true;
        });

        if (distinct && distinct.includes('classId')) {
          const seen = new Set();
          results = results.filter((h) => {
            if (seen.has(h.classId)) return false;
            seen.add(h.classId);
            return true;
          });
        }

        results.sort((a, b) => {
          const sA = users.find((u) => u.id === a.studentId)?.studentCode || '';
          const sB = users.find((u) => u.id === b.studentId)?.studentCode || '';
          return sA.localeCompare(sB);
        });

        if (take !== undefined) {
          results = results.slice(skip, skip + take);
        }

        if (include) {
          return results.map((h) => {
            const student = users.find((u) => u.id === h.studentId);
            const snapshotClass = classes.find((c) => c.id === h.classId);
            return {
              ...h,
              student: student
                ? {
                    id: student.id,
                    studentCode: student.studentCode,
                    fullName: student.fullName,
                  }
                : null,
              class: snapshotClass
                ? {
                    id: snapshotClass.id,
                    code: snapshotClass.code,
                    name: snapshotClass.name,
                  }
                : null,
            };
          });
        }

        if (select) {
          return results.map((h) => {
            const out = {};
            if (select.id) out.id = h.id;
            if (select.studentId) out.studentId = h.studentId;
            if (select.classId) out.classId = h.classId;
            if (select.facultyId) out.facultyId = h.facultyId;
            if (select.status) out.status = h.status;
            if (select.revision !== undefined) out.revision = h.revision;
            if (select.snapshot !== undefined) out.snapshot = h.snapshot;
            return out;
          });
        }
        return results;
      },
      count: async ({ where = {} } = {}) => {
        let results = handoffs.filter((h) => {
          if (where.termId && h.termId !== where.termId) return false;
          if (where.classId && h.classId !== where.classId) return false;
          if (where.studentId && h.studentId !== where.studentId) return false;
          if (where.student) {
            const student = users.find((u) => u.id === h.studentId);
            if (!student) return false;
            if (where.student.OR) {
              const matchesOr = where.student.OR.some((cond) => {
                if (cond.studentCode && cond.studentCode.contains) {
                  return student.studentCode.toLowerCase().includes(cond.studentCode.contains.toLowerCase());
                }
                if (cond.fullName && cond.fullName.contains) {
                  return student.fullName.toLowerCase().includes(cond.fullName.contains.toLowerCase());
                }
                return false;
              });
              if (!matchesOr) return false;
            }
          }
          return true;
        });
        return results.length;
      },
      findFirst: async ({ where = {} }) => {
        return (
          handoffs.find((h) => {
            if (where.termId && h.termId !== where.termId) return false;
            if (where.studentId && h.studentId !== where.studentId) return false;
            if (where.classId && h.classId !== where.classId) return false;
            return true;
          }) || null
        );
      },
      findUnique: async ({ where = {} }) => {
        if (where.id) return handoffs.find((h) => h.id === where.id) || null;
        if (where.studentId_termId) {
          return (
            handoffs.find(
              (h) => h.studentId === where.studentId_termId.studentId && h.termId === where.studentId_termId.termId
            ) || null
          );
        }
        return null;
      },
    },
    assessmentPublication: {
      findMany: async ({ where = {} } = {}) => {
        return publications.filter((p) => {
          if (where.termId && p.termId !== where.termId) return false;
          return true;
        });
      },
      findUnique: async ({ where = {} }) => {
        if (where.studentId_termId_revision) {
          const { studentId, termId, revision } = where.studentId_termId_revision;
          return (
            publications.find(
              (p) => p.studentId === studentId && p.termId === termId && p.revision === revision
            ) || null
          );
        }
        return null;
      },
    },
    appeal: {
      count: async () => 0,
    },
    auditLog: {
      create: async ({ data }) => {
        const item = { id: `audit-${++autoId}`, createdAt: new Date(), ...data };
        auditLogs.push(item);
        return item;
      },
    },
    notification: {
      create: async () => ({ id: `notif-${++autoId}` }),
      createMany: async () => ({ count: 0 }),
    },
    assessment: {
      findMany: async ({ where = {} }) => {
        return assessments.filter((a) => {
          if (where.termId && a.termId !== where.termId) return false;
          return true;
        });
      },
    },
    assessmentDeadlineExtension: {
      findMany: async ({ where = {}, orderBy }) => {
        let results = extensions.filter((e) => {
          if (where.termId && e.termId !== where.termId) return false;
          if (where.type && e.type !== where.type) return false;
          if (where.revokedAt === null && e.revokedAt !== null) return false;
          if (where.OR) {
            const matchesOr = where.OR.some((cond) => {
              if (cond.targetType && cond.targetId) {
                return e.targetType === cond.targetType && e.targetId === cond.targetId;
              }
              return false;
            });
            if (!matchesOr) return false;
          }
          return true;
        });

        // Sắp xếp mô phỏng: [{ createdAt: 'desc' }, { id: 'desc' }]
        if (Array.isArray(orderBy)) {
          results.sort((a, b) => {
            for (const order of orderBy) {
              const field = Object.keys(order)[0];
              const dir = order[field];
              let valA = a[field];
              let valB = b[field];
              if (valA instanceof Date) valA = valA.getTime();
              if (valB instanceof Date) valB = valB.getTime();
              if (valA !== valB) {
                return dir === 'desc' ? (valA < valB ? 1 : -1) : (valA > valB ? 1 : -1);
              }
            }
            return 0;
          });
        }
        return results;
      },
      findUnique: async ({ where }) => {
        return extensions.find((e) => e.id === where.id) || null;
      },
      findUniqueOrThrow: async ({ where }) => {
        const item = extensions.find((e) => e.id === where.id);
        if (!item) throw new Error(`Extension ${where.id} not found`);
        return item;
      },
      create: async ({ data }) => {
        const item = {
          id: `ext-${++autoId}`,
          createdAt: new Date(),
          revokedAt: null,
          ...data,
        };
        extensions.push(item);
        return item;
      },
      update: async ({ where, data }) => {
        const index = extensions.findIndex((e) => e.id === where.id);
        if (index === -1) throw new Error('Extension not found');
        extensions[index] = { ...extensions[index], ...data };
        return extensions[index];
      },
    },
    $queryRaw: async (strings, ...values) => {
      // Mô phỏng lệnh SELECT 1 FROM "Term" WHERE id = $1 FOR UPDATE
      let termId = values[0];
      if (!termId && Array.isArray(strings)) {
        const text = strings.join('');
        const match = text.match(/id\s*=\s*'([^']+)'/);
        if (match) termId = match[1];
      }
      if (termId) {
        await lockSimulator.acquire(termId);
        if (typeof onLockHook === 'function') {
          await onLockHook(termId);
        }
      }
      return [{ '?column?': 1 }];
    },
    $transaction: async (callback) => {
      let lockedTermId = null;
      // Hook interceptor để giải phóng lock khi callback hoàn tất
      const txPrisma = {
        ...mockPrisma,
        $queryRaw: async (strings, ...values) => {
          let termId = values[0];
          if (!termId && Array.isArray(strings)) {
            const text = strings.join('');
            const match = text.match(/id\s*=\s*'([^']+)'/);
            if (match) termId = match[1];
          }
          if (termId) {
            lockedTermId = termId;
            await lockSimulator.acquire(termId);
            if (typeof onLockHook === 'function') {
              await onLockHook(termId);
            }
          }
          return [{ '?column?': 1 }];
        },
      };

      try {
        return await callback(txPrisma);
      } finally {
        if (lockedTermId) {
          lockSimulator.release(lockedTermId);
        }
      }
    },
  };

  const deadlineService = new DeadlineExtensionsService(mockPrisma);
  const workflowService = new WorkflowService(mockPrisma, deadlineService);

  return {
    mockPrisma,
    deadlineService,
    workflowService,
    lockSimulator,
    setOnLockHook: (fn) => {
      onLockHook = fn;
    },
    getData: () => ({ terms, users, classes, handoffs, extensions, assessments, publications, auditLogs }),
  };
}

// =====================================================================
// BL-006: Khóa chốt kỳ theo thời hạn hiệu lực & Concurrency Lock
// =====================================================================
describe('BL-006: Khóa chốt kỳ theo thời hạn hiệu lực (bao gồm gia hạn APPEAL)', () => {
  const actor = { id: 'admin-1', role: Role.ADMIN };

  test('Ca 1: Chốt kỳ thành công khi now > term.appealDeadline và không có gia hạn APPEAL nào', async () => {
    const fixture = createWorkflowFixture({
      terms: [
        {
          id: 'term-1',
          name: 'Học kỳ 1 2026-2027',
          status: 'REVIEWING',
          workflowEnabled: true,
          appealDeadline: new Date('2026-10-01T00:00:00Z'),
          closureNotes: null,
          closedAt: null,
          closedById: null,
        },
      ],
      handoffs: [
        {
          id: 'h-1',
          termId: 'term-1',
          studentId: 'student-1',
          classId: 'class-1',
          status: 'SENT',
          revision: 1,
          snapshot: { complete: true },
        },
      ],
      publications: [{ studentId: 'student-1', termId: 'term-1', revision: 1 }],
    });

    const checkNow = new Date('2026-10-01T00:00:01Z'); // Hơn hạn gốc 1 giây
    const conditions = await fixture.workflowService.conditions(actor, 'term-1', fixture.mockPrisma, checkNow);
    assert.equal(conditions.canClose, true);
    assert.deepEqual(conditions.closeBlockers, []);

    const closed = await fixture.workflowService.close(actor, 'term-1', checkNow);
    assert.equal(closed.status, 'CLOSED');
  });

  test('Ca 2: Chặn chốt kỳ tại đúng thời điểm biên (now === appealDeadline)', async () => {
    const fixture = createWorkflowFixture({
      terms: [
        {
          id: 'term-1',
          name: 'Học kỳ 1 2026-2027',
          status: 'REVIEWING',
          workflowEnabled: true,
          appealDeadline: new Date('2026-10-01T00:00:00Z'),
        },
      ],
      handoffs: [
        {
          id: 'h-1',
          termId: 'term-1',
          studentId: 'student-1',
          classId: 'class-1',
          status: 'SENT',
          revision: 1,
          snapshot: { complete: true },
        },
      ],
      publications: [{ studentId: 'student-1', termId: 'term-1', revision: 1 }],
    });

    const checkNow = new Date('2026-10-01T00:00:00Z'); // Đúng bằng hạn
    const conditions = await fixture.workflowService.conditions(actor, 'term-1', fixture.mockPrisma, checkNow);
    assert.equal(conditions.canClose, false);
    assert.ok(conditions.closeBlockers.some((b) => b.includes('Chưa hết hạn phúc khảo')));

    await assert.rejects(
      async () => {
        await fixture.workflowService.close(actor, 'term-1', checkNow);
      },
      (err) => {
        const status = typeof err.getStatus === 'function' ? err.getStatus() : err.status;
        assert.equal(status, 400);
        return true;
      }
    );
  });

  test('Ca 3: Chặn chốt kỳ khi có 1 sinh viên trong roster có gia hạn APPEAL cá nhân hiệu lực', async () => {
    const fixture = createWorkflowFixture({
      terms: [
        {
          id: 'term-1',
          name: 'Học kỳ 1 2026-2027',
          status: 'REVIEWING',
          workflowEnabled: true,
          appealDeadline: new Date('2026-10-01T00:00:00Z'),
        },
      ],
      handoffs: [
        {
          id: 'h-1',
          termId: 'term-1',
          studentId: 'student-1',
          classId: 'class-1',
          status: 'SENT',
          revision: 1,
          snapshot: { complete: true },
        },
      ],
      publications: [{ studentId: 'student-1', termId: 'term-1', revision: 1 }],
      extensions: [
        {
          id: 'ext-1',
          termId: 'term-1',
          targetType: 'STUDENT',
          targetId: 'student-1',
          type: 'APPEAL',
          deadline: new Date('2026-10-10T00:00:00Z'), // Còn hiệu lực đến 10/10
          revokedAt: null,
          createdAt: new Date('2026-09-25T00:00:00Z'),
        },
      ],
    });

    const checkNow = new Date('2026-10-05T00:00:00Z'); // Đã quá hạn gốc 4 ngày, nhưng còn trong gia hạn
    const conditions = await fixture.workflowService.conditions(actor, 'term-1', fixture.mockPrisma, checkNow);
    assert.equal(conditions.canClose, false);
    assert.ok(
      conditions.closeBlockers.some((b) => b.includes('gia hạn phúc khảo đang có hiệu lực')),
      'Phải có blocker thông báo gia hạn hiệu lực'
    );

    await assert.rejects(
      async () => {
        await fixture.workflowService.close(actor, 'term-1', checkNow);
      },
      (err) => {
        const status = typeof err.getStatus === 'function' ? err.getStatus() : err.status;
        assert.equal(status, 400);
        return true;
      }
    );
  });

  test('Ca 4: Cho phép chốt kỳ nếu gia hạn APPEAL cá nhân đã bị thu hồi (revokedAt !== null)', async () => {
    const fixture = createWorkflowFixture({
      terms: [
        {
          id: 'term-1',
          name: 'Học kỳ 1 2026-2027',
          status: 'REVIEWING',
          workflowEnabled: true,
          appealDeadline: new Date('2026-10-01T00:00:00Z'),
        },
      ],
      handoffs: [
        {
          id: 'h-1',
          termId: 'term-1',
          studentId: 'student-1',
          classId: 'class-1',
          status: 'SENT',
          revision: 1,
          snapshot: { complete: true },
        },
      ],
      publications: [{ studentId: 'student-1', termId: 'term-1', revision: 1 }],
      extensions: [
        {
          id: 'ext-1',
          termId: 'term-1',
          targetType: 'STUDENT',
          targetId: 'student-1',
          type: 'APPEAL',
          deadline: new Date('2026-10-10T00:00:00Z'),
          revokedAt: new Date('2026-10-02T00:00:00Z'), // Đã thu hồi
          createdAt: new Date('2026-09-25T00:00:00Z'),
        },
      ],
    });

    const checkNow = new Date('2026-10-05T00:00:00Z');
    const conditions = await fixture.workflowService.conditions(actor, 'term-1', fixture.mockPrisma, checkNow);
    assert.equal(conditions.canClose, true);
    assert.deepEqual(conditions.closeBlockers, []);

    const closed = await fixture.workflowService.close(actor, 'term-1', checkNow);
    assert.equal(closed.status, 'CLOSED');
  });

  test('Ca 5: Chặn chốt kỳ khi có gia hạn APPEAL cấp LỚP (CLASS) còn hiệu lực', async () => {
    const fixture = createWorkflowFixture({
      terms: [
        {
          id: 'term-1',
          name: 'Học kỳ 1 2026-2027',
          status: 'REVIEWING',
          workflowEnabled: true,
          appealDeadline: new Date('2026-10-01T00:00:00Z'),
        },
      ],
      handoffs: [
        {
          id: 'h-1',
          termId: 'term-1',
          studentId: 'student-1',
          classId: 'class-1',
          status: 'SENT',
          revision: 1,
          snapshot: { complete: true },
        },
      ],
      publications: [{ studentId: 'student-1', termId: 'term-1', revision: 1 }],
      extensions: [
        {
          id: 'ext-class-1',
          termId: 'term-1',
          targetType: 'CLASS',
          targetId: 'class-1',
          type: 'APPEAL',
          deadline: new Date('2026-10-12T00:00:00Z'),
          revokedAt: null,
          createdAt: new Date('2026-09-25T00:00:00Z'),
        },
      ],
    });

    const checkNow = new Date('2026-10-05T00:00:00Z');
    const conditions = await fixture.workflowService.conditions(actor, 'term-1', fixture.mockPrisma, checkNow);
    assert.equal(conditions.canClose, false);
    assert.ok(conditions.closeBlockers.some((b) => b.includes('gia hạn phúc khảo đang có hiệu lực')));
  });

  test('Ca 6: Ưu tiên cá nhân -> lớp: sinh viên có hạn cá nhân đã hết hạn, nhưng sinh viên cùng lớp hưởng hạn lớp', async () => {
    const fixture = createWorkflowFixture({
      terms: [
        {
          id: 'term-1',
          name: 'Học kỳ 1 2026-2027',
          status: 'REVIEWING',
          workflowEnabled: true,
          appealDeadline: new Date('2026-10-01T00:00:00Z'),
        },
      ],
      handoffs: [
        {
          id: 'h-1',
          termId: 'term-1',
          studentId: 'student-1',
          classId: 'class-1',
          status: 'SENT',
          revision: 1,
          snapshot: { complete: true },
        },
        {
          id: 'h-2',
          termId: 'term-1',
          studentId: 'student-2',
          classId: 'class-1',
          status: 'SENT',
          revision: 1,
          snapshot: { complete: true },
        },
      ],
      publications: [
        { studentId: 'student-1', termId: 'term-1', revision: 1 },
        { studentId: 'student-2', termId: 'term-1', revision: 1 },
      ],
      extensions: [
        {
          id: 'ext-class-1',
          termId: 'term-1',
          targetType: 'CLASS',
          targetId: 'class-1',
          type: 'APPEAL',
          deadline: new Date('2026-10-12T00:00:00Z'), // Lớp được gia hạn đến 12/10
          revokedAt: null,
          createdAt: new Date('2026-09-20T00:00:00Z'),
        },
        {
          id: 'ext-student-1',
          termId: 'term-1',
          targetType: 'STUDENT',
          targetId: 'student-1',
          type: 'APPEAL',
          deadline: new Date('2026-10-03T00:00:00Z'), // student-1 có hạn cá nhân riêng hết hạn ngày 03/10
          revokedAt: null,
          createdAt: new Date('2026-09-25T00:00:00Z'),
        },
      ],
    });

    const checkNow = new Date('2026-10-05T00:00:00Z');
    // student-1 có hạn riêng 03/10 (đã hết), nhưng student-2 không có hạn riêng nên hưởng hạn lớp 12/10 (còn hiệu lực)
    const conditions = await fixture.workflowService.conditions(actor, 'term-1', fixture.mockPrisma, checkNow);
    assert.equal(conditions.canClose, false, 'Kỳ vẫn phải bị chặn vì student-2 còn hạn của lớp');

    // Cấp thêm hạn riêng cho student-2 hết hạn ngày 04/10
    const fixtureData = fixture.getData();
    fixtureData.extensions.push({
      id: 'ext-student-2',
      termId: 'term-1',
      targetType: 'STUDENT',
      targetId: 'student-2',
      type: 'APPEAL',
      deadline: new Date('2026-10-04T00:00:00Z'),
      revokedAt: null,
      createdAt: new Date('2026-09-26T00:00:00Z'),
    });

    // Cả 2 sinh viên trong lớp đều có hạn cá nhân đã hết hạn -> hạn lớp bị override hoàn toàn
    const conditionsAllExpired = await fixture.workflowService.conditions(actor, 'term-1', fixture.mockPrisma, checkNow);
    assert.equal(conditionsAllExpired.canClose, true, 'Khi mọi sinh viên đều có hạn cá nhân đã hết hạn, cho phép chốt kỳ');
  });

  test('Ca 7: Thứ tự phụ id: desc khi hai bản ghi cùng createdAt', async () => {
    const fixture = createWorkflowFixture({
      terms: [
        {
          id: 'term-1',
          name: 'Học kỳ 1 2026-2027',
          status: 'REVIEWING',
          workflowEnabled: true,
          appealDeadline: new Date('2026-10-01T00:00:00Z'),
        },
      ],
      handoffs: [
        {
          id: 'h-1',
          termId: 'term-1',
          studentId: 'student-1',
          classId: 'class-1',
          status: 'SENT',
          revision: 1,
          snapshot: { complete: true },
        },
      ],
      publications: [{ studentId: 'student-1', termId: 'term-1', revision: 1 }],
      extensions: [
        {
          id: 'ext-01',
          termId: 'term-1',
          targetType: 'STUDENT',
          targetId: 'student-1',
          type: 'APPEAL',
          deadline: new Date('2026-10-20T00:00:00Z'), // Bản ghi cũ id nhỏ hơn
          revokedAt: null,
          createdAt: new Date('2026-09-25T00:00:00Z'),
        },
        {
          id: 'ext-02',
          termId: 'term-1',
          targetType: 'STUDENT',
          targetId: 'student-1',
          type: 'APPEAL',
          deadline: new Date('2026-10-03T00:00:00Z'), // Bản ghi mới hơn cùng createdAt nhưng id lớn hơn
          revokedAt: null,
          createdAt: new Date('2026-09-25T00:00:00Z'),
        },
      ],
    });

    const checkNow = new Date('2026-10-05T00:00:00Z');
    // ext-02 được chọn vì id: desc -> deadline 03/10 đã qua -> canClose = true
    const conditions = await fixture.workflowService.conditions(actor, 'term-1', fixture.mockPrisma, checkNow);
    assert.equal(conditions.canClose, true);
  });

  test('Ca 8: Gia hạn của sinh viên ngoài roster không chặn chốt kỳ', async () => {
    const fixture = createWorkflowFixture({
      terms: [
        {
          id: 'term-1',
          name: 'Học kỳ 1 2026-2027',
          status: 'REVIEWING',
          workflowEnabled: true,
          appealDeadline: new Date('2026-10-01T00:00:00Z'),
        },
      ],
      handoffs: [
        {
          id: 'h-1',
          termId: 'term-1',
          studentId: 'student-1',
          classId: 'class-1',
          status: 'SENT',
          revision: 1,
          snapshot: { complete: true },
        },
      ],
      publications: [{ studentId: 'student-1', termId: 'term-1', revision: 1 }],
      extensions: [
        {
          id: 'ext-other',
          termId: 'term-1',
          targetType: 'STUDENT',
          targetId: 'student-99', // Không nằm trong handoffs của kỳ 1
          type: 'APPEAL',
          deadline: new Date('2026-10-25T00:00:00Z'),
          revokedAt: null,
          createdAt: new Date('2026-09-25T00:00:00Z'),
        },
      ],
    });

    const checkNow = new Date('2026-10-05T00:00:00Z');
    const conditions = await fixture.workflowService.conditions(actor, 'term-1', fixture.mockPrisma, checkNow);
    assert.equal(conditions.canClose, true, 'Gia hạn của người ngoài roster không được chặn kỳ');
  });

  test('Ca 9: Bằng chứng đối chứng đỏ - logic cũ chỉ check term.appealDeadline sẽ cho chốt sai', () => {
    const term = { appealDeadline: new Date('2026-10-01T00:00:00Z') };
    const now = new Date('2026-10-05T00:00:00Z');
    const studentHasExtension = true; // Sinh viên được gia hạn đến 10/10

    // Logic cũ:
    const oldCanClose = now > term.appealDeadline;
    assert.equal(oldCanClose, true, 'Logic cũ cho phép chốt sai vì không kiểm tra gia hạn của sinh viên');

    // Logic mới:
    const newCanClose = now > term.appealDeadline && !studentHasExtension;
    assert.equal(newCanClose, false, 'Logic mới chặn chốt kỳ chính xác');
  });

  test('Ca 10: Concurrency Lock — Hai yêu cầu revoke đồng thời: request 2 đọc lại sau khóa thấy đã thu hồi và bị từ chối', async () => {
    const fixture = createWorkflowFixture({
      terms: [{ id: 'term-1', name: 'Kỳ 1', status: 'ACTIVE' }],
      extensions: [
        {
          id: 'ext-target',
          termId: 'term-1',
          targetType: 'STUDENT',
          targetId: 'student-1',
          type: 'SUBMISSION',
          deadline: new Date('2026-10-10T00:00:00Z'),
          revokedAt: null,
          createdAt: new Date('2026-09-25T00:00:00Z'),
        },
      ],
    });

    // Chạy đồng thời 2 lời gọi revoke
    const p1 = fixture.deadlineService.revoke('admin-1', 'ext-target');
    const p2 = fixture.deadlineService.revoke('admin-2', 'ext-target');

    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.equal(fulfilled.length, 1, 'Chỉ 1 request thu hồi thành công');
    assert.equal(rejected.length, 1, 'Request thứ hai phải bị từ chối');
    assert.ok(
      rejected[0].reason.message.includes('đã được thu hồi trước đó'),
      'Request thứ hai bị từ chối do đọc lại bản ghi sau khóa thấy revokedAt !== null'
    );

    // Kiểm tra audit log chỉ được ghi đúng 1 lần
    const auditLogs = fixture.getData().auditLogs.filter((a) => a.action === 'DEADLINE_EXTENSION_REVOKED');
    assert.equal(auditLogs.length, 1, 'Audit log chỉ được tạo 1 lần');
  });

  test('Ca 11a: Concurrency Lock (Mô phỏng) — Thứ tự 1: Gia hạn giữ khóa trước -> Chốt kỳ bị hoãn chờ khóa và bị chặn do có gia hạn hiệu lực', async () => {
    const fixture = createWorkflowFixture({
      terms: [
        {
          id: 'term-1',
          name: 'Học kỳ 1 2026-2027',
          status: 'REVIEWING',
          workflowEnabled: true,
          appealDeadline: new Date('2026-10-01T00:00:00Z'),
          closureNotes: null,
          closedAt: null,
          closedById: null,
        },
      ],
      handoffs: [
        {
          id: 'h-1',
          termId: 'term-1',
          studentId: 'student-1',
          classId: 'class-1',
          status: 'SENT',
          revision: 1,
          snapshot: { complete: true },
        },
      ],
      publications: [{ studentId: 'student-1', termId: 'term-1', revision: 1 }],
    });

    // Barrier kiểm soát thứ tự đồng thời:
    // createHasLock: báo cho test biết create() đã lấy khóa Term thành công
    // holdCreateBarrier: giữ create() bên trong transaction để close() phải chờ khóa
    let createHasLockResolve;
    const createHasLock = new Promise((r) => {
      createHasLockResolve = r;
    });
    let releaseCreateBarrier;
    const holdCreateBarrier = new Promise((r) => {
      releaseCreateBarrier = r;
    });

    let hookCalled = false;
    fixture.setOnLockHook(async (termId) => {
      if (!hookCalled) {
        hookCalled = true;
        createHasLockResolve();
        // Giữ khóa Term, chờ test kích hoạt request close tranh chấp
        await holdCreateBarrier;
      }
    });

    // 1. Khởi động request create: Tạo gia hạn APPEAL đến tương lai (2026-10-15)
    const pCreate = fixture.deadlineService.create(actor.id, {
      termId: 'term-1',
      targetType: DeadlineExtensionTarget.STUDENT,
      targetId: 'student-1',
      type: DeadlineExtensionType.APPEAL,
      deadline: new Date('2026-10-15T00:00:00Z').toISOString(),
      reason: 'Gia hạn phúc khảo trong lúc tranh khóa',
    });

    // Chờ request create chắc chắn đã chiếm giữ khóa Term
    await createHasLock;
    assert.equal(fixture.lockSimulator.isLocked('term-1'), true, 'Gia hạn phải đang giữ khóa Term');

    // 2. Khởi động request close: Chốt kỳ chạy đồng thời khi create đang giữ khóa
    const checkNow = new Date('2026-10-02T00:00:00Z');
    const pClose = fixture.workflowService.close(actor, 'term-1', checkNow);

    // Cho microtask chạy để close thử lấy khóa và bị đưa vào hàng đợi
    await new Promise((r) => setTimeout(r, 15));

    // Chứng minh: close đang bị hoãn chờ khóa trong hàng đợi (chưa hoàn tất)
    assert.equal(fixture.lockSimulator.getQueueLength('term-1'), 1, 'Chốt kỳ phải đang bị hoãn chờ khóa trong queue');

    // 3. Mở barrier cho create commit và giải phóng khóa
    releaseCreateBarrier();

    // Request create hoàn tất thành công
    const createdExtension = await pCreate;
    assert.ok(createdExtension.id, 'Tạo gia hạn thành công');

    // Request close sau khi lấy được khóa, đọc lại dữ liệu trong lock thấy có gia hạn hiệu lực -> ném BadRequestException
    await assert.rejects(
      async () => {
        await pClose;
      },
      (err) => {
        const status = typeof err.getStatus === 'function' ? err.getStatus() : err.status;
        assert.equal(status, 400);
        assert.ok(
          err.message.includes('Còn gia hạn phúc khảo đang có hiệu lực'),
          'Chốt kỳ bị chặn bởi gia hạn hiệu lực vừa tạo bên trong khóa'
        );
        return true;
      }
    );

    // Trạng thái kỳ vẫn là REVIEWING, không bị chuyển sang CLOSED
    const term = fixture.getData().terms.find((t) => t.id === 'term-1');
    assert.equal(term.status, 'REVIEWING', 'Kỳ vẫn ở trạng thái REVIEWING');
  });

  test('Ca 11b: Concurrency Lock (Mô phỏng) — Thứ tự 2: Chốt kỳ giữ khóa trước -> Gia hạn bị hoãn chờ khóa và bị từ chối do kỳ đã chốt', async () => {
    const fixture = createWorkflowFixture({
      terms: [
        {
          id: 'term-1',
          name: 'Học kỳ 1 2026-2027',
          status: 'REVIEWING',
          workflowEnabled: true,
          appealDeadline: new Date('2026-10-01T00:00:00Z'),
          closureNotes: null,
          closedAt: null,
          closedById: null,
        },
      ],
      handoffs: [
        {
          id: 'h-1',
          termId: 'term-1',
          studentId: 'student-1',
          classId: 'class-1',
          status: 'SENT',
          revision: 1,
          snapshot: { complete: true },
        },
      ],
      publications: [{ studentId: 'student-1', termId: 'term-1', revision: 1 }],
    });

    // Barrier kiểm soát thứ tự đồng thời:
    // closeHasLock: báo cho test biết close() đã lấy khóa Term thành công
    // holdCloseBarrier: giữ close() bên trong transaction để create() phải chờ khóa
    let closeHasLockResolve;
    const closeHasLock = new Promise((r) => {
      closeHasLockResolve = r;
    });
    let releaseCloseBarrier;
    const holdCloseBarrier = new Promise((r) => {
      releaseCloseBarrier = r;
    });

    let hookCalled = false;
    fixture.setOnLockHook(async (termId) => {
      if (!hookCalled) {
        hookCalled = true;
        closeHasLockResolve();
        // Giữ khóa Term, chờ test kích hoạt request create tranh chấp
        await holdCloseBarrier;
      }
    });

    // 1. Khởi động request close: Chốt kỳ
    const checkNow = new Date('2026-10-02T00:00:00Z');
    const pClose = fixture.workflowService.close(actor, 'term-1', checkNow);

    // Chờ request close chắc chắn đã chiếm giữ khóa Term
    await closeHasLock;
    assert.equal(fixture.lockSimulator.isLocked('term-1'), true, 'Chốt kỳ phải đang giữ khóa Term');

    // 2. Khởi động request create: Tạo gia hạn chạy đồng thời khi close đang giữ khóa
    const pCreate = fixture.deadlineService.create(actor.id, {
      termId: 'term-1',
      targetType: DeadlineExtensionTarget.STUDENT,
      targetId: 'student-1',
      type: DeadlineExtensionType.APPEAL,
      deadline: new Date('2026-10-15T00:00:00Z').toISOString(),
      reason: 'Xin gia hạn khi đang tranh chấp với chốt kỳ',
    });

    // Cho microtask chạy để create thử lấy khóa và bị đưa vào hàng đợi
    await new Promise((r) => setTimeout(r, 15));

    // Chứng minh: create đang bị hoãn chờ khóa trong hàng đợi (chưa hoàn tất)
    assert.equal(fixture.lockSimulator.getQueueLength('term-1'), 1, 'Tạo gia hạn phải đang bị hoãn chờ khóa trong queue');

    // 3. Mở barrier cho close hoàn tất cập nhật status = CLOSED và giải phóng khóa
    releaseCloseBarrier();

    // Request close hoàn tất thành công
    const closedTerm = await pClose;
    assert.equal(closedTerm.status, 'CLOSED', 'Kỳ được chốt thành công');

    // Request create sau khi lấy được khóa, đọc lại term thấy status = CLOSED -> ném BadRequestException
    await assert.rejects(
      async () => {
        await pCreate;
      },
      (err) => {
        const status = typeof err.getStatus === 'function' ? err.getStatus() : err.status;
        assert.equal(status, 400);
        assert.ok(
          err.message.includes('Kỳ đã chốt, không thể gia hạn'),
          'Tạo gia hạn bị từ chối do kỳ đã chốt'
        );
        return true;
      }
    );

    // Không có bản ghi gia hạn nào được tạo
    const extensions = fixture.getData().extensions;
    assert.equal(extensions.length, 0, 'Không có gia hạn nào được ghi vào DB');
  });
});

// =====================================================================
// BL-020: Lọc đối tượng gia hạn theo Roster kỳ, DTO Validation & Pagination 100+
// =====================================================================
describe('BL-020: Lọc đối tượng gia hạn theo Roster kỳ, DTO Validation và hỗ trợ >100 sinh viên', () => {
  const actor = { id: 'admin-1', role: Role.ADMIN };

  test('Ca 1: DTO Validation — Kiểm tra các tham số đầu vào của targets', async () => {
    // 1. Thiếu termId
    const dto1 = plainToInstance(DeadlineExtensionTargetsQueryDto, {
      targetType: 'STUDENT',
    });
    const errors1 = await validate(dto1);
    assert.ok(errors1.some((e) => e.property === 'termId'), 'Phải báo lỗi thiếu termId');

    // 2. targetType sai enum
    const dto2 = plainToInstance(DeadlineExtensionTargetsQueryDto, {
      termId: 'term-1',
      targetType: 'INVALID_TYPE',
    });
    const errors2 = await validate(dto2);
    assert.ok(errors2.some((e) => e.property === 'targetType'), 'Phải báo lỗi targetType sai enum');

    // 3. page âm hoặc thập phân
    const dto3 = plainToInstance(DeadlineExtensionTargetsQueryDto, {
      termId: 'term-1',
      targetType: 'STUDENT',
      page: -2,
    });
    const errors3 = await validate(dto3);
    assert.ok(errors3.some((e) => e.property === 'page'), 'Phải báo lỗi page âm');

    // 4. pageSize vượt quá 100
    const dto4 = plainToInstance(DeadlineExtensionTargetsQueryDto, {
      termId: 'term-1',
      targetType: 'STUDENT',
      pageSize: 101,
    });
    const errors4 = await validate(dto4);
    assert.ok(errors4.some((e) => e.property === 'pageSize'), 'Phải báo lỗi pageSize vượt quá 100');

    // 5. Query hợp lệ
    const dto5 = plainToInstance(DeadlineExtensionTargetsQueryDto, {
      termId: 'term-1',
      targetType: 'STUDENT',
      q: '  nguyen van a  ',
      page: 2,
      pageSize: 50,
    });
    const errors5 = await validate(dto5);
    assert.equal(errors5.length, 0, 'Query hợp lệ không được có lỗi');
  });

  test('Ca 2: Danh sách > 100 sinh viên (105 sinh viên) — Phân trang pageSize 25, trang 5 hiển thị đầy đủ không bị cắt', async () => {
    // Sinh 105 sinh viên trong roster kỳ
    const users = [];
    const handoffs = [];
    for (let i = 1; i <= 105; i++) {
      const pad = String(i).padStart(3, '0');
      const sId = `s-${pad}`;
      const cId = `c-${((i % 5) + 1)}`;
      users.push({
        id: sId,
        studentCode: `SV${pad}`,
        fullName: `Sinh viên thứ ${pad}`,
        role: Role.STUDENT,
        classId: 'c-old-class', // Lớp hiện tại khác với snapshot
      });
      handoffs.push({
        id: `h-${pad}`,
        termId: 'term-100',
        studentId: sId,
        classId: cId, // Lớp snapshot kỳ
      });
    }

    const classes = [
      { id: 'c-1', code: '21T1', name: 'Lớp 21T1 Snapshot' },
      { id: 'c-2', code: '21T2', name: 'Lớp 21T2 Snapshot' },
      { id: 'c-3', code: '21T3', name: 'Lớp 21T3 Snapshot' },
      { id: 'c-4', code: '21T4', name: 'Lớp 21T4 Snapshot' },
      { id: 'c-5', code: '21T5', name: 'Lớp 21T5 Snapshot' },
    ];

    const fixture = createWorkflowFixture({
      terms: [{ id: 'term-100', name: 'Kỳ 100 sinh viên' }],
      users,
      classes,
      handoffs,
    });

    // Lấy trang 5 (sinh viên thứ 101 - 105)
    const resPage5 = await fixture.deadlineService.targets({
      termId: 'term-100',
      targetType: DeadlineExtensionTarget.STUDENT,
      page: 5,
      pageSize: 25,
    });

    assert.equal(resPage5.total, 105, 'Tổng số sinh viên phải là 105');
    assert.equal(resPage5.items.length, 5, 'Trang 5 phải có đúng 5 sinh viên cuối');
    assert.equal(resPage5.page, 5);
    assert.equal(resPage5.pageSize, 25);

    // Kiểm tra sinh viên 101 - 105 có đầy đủ contract và lớp snapshot
    const item105 = resPage5.items.find((item) => item.studentCode === 'SV105');
    assert.ok(item105, 'Phải tìm thấy sinh viên SV105 ở trang 5');
    assert.equal(item105.code, 'SV105');
    assert.equal(item105.name, 'Sinh viên thứ 105');
    assert.equal(item105.classCode, 'c-1' ? '21T1' : item105.classCode); // Mã lớp theo snapshot
    assert.notEqual(item105.classCode, 'c-old-class', 'Không được lấy lớp hiện tại của User');
  });

  test('Ca 3: targets CLASS chỉ lấy các lớp trong Roster của kỳ và loại trùng lặp', async () => {
    const fixture = createWorkflowFixture({
      terms: [{ id: 'term-1', name: 'Kỳ 1' }],
      users: [
        { id: 's-1', studentCode: 'SV001', fullName: 'Nguyễn Văn A', role: Role.STUDENT },
        { id: 's-2', studentCode: 'SV002', fullName: 'Trần Thị B', role: Role.STUDENT },
        { id: 's-3', studentCode: 'SV003', fullName: 'Lê Văn C', role: Role.STUDENT },
      ],
      classes: [
        { id: 'c-1', code: '21T1', name: 'Lớp 21T1' },
        { id: 'c-2', code: '21T2', name: 'Lớp 21T2' },
        { id: 'c-3', code: '21T3', name: 'Lớp 21T3 Không có ai trong kỳ 1' },
      ],
      handoffs: [
        { id: 'h-1', termId: 'term-1', studentId: 's-1', classId: 'c-1' },
        { id: 'h-2', termId: 'term-1', studentId: 's-2', classId: 'c-1' }, // Cùng lớp c-1
        { id: 'h-3', termId: 'term-1', studentId: 's-3', classId: 'c-2' },
      ],
    });

    const result = await fixture.deadlineService.targets({
      termId: 'term-1',
      targetType: DeadlineExtensionTarget.CLASS,
      page: 1,
      pageSize: 10,
    });

    assert.equal(result.total, 2, 'Chỉ lấy 2 lớp c-1 và c-2');
    const classCodes = result.items.map((i) => i.code);
    assert.deepEqual(classCodes.sort(), ['21T1', '21T2']);
    assert.ok(!classCodes.includes('21T3'), 'Lớp không có sinh viên trong kỳ không được xuất hiện');

    // Kiểm tra contract của CLASS item
    const item1 = result.items[0];
    assert.ok(item1.id);
    assert.ok(item1.code);
    assert.ok(item1.name);
    assert.equal(item1.targetType, DeadlineExtensionTarget.CLASS);
  });

  test('Ca 4: create từ chối khi đối tượng không thuộc Roster của kỳ', async () => {
    const fixture = createWorkflowFixture({
      terms: [{ id: 'term-1', name: 'Kỳ 1', status: 'ACTIVE' }],
      users: [
        { id: 's-1', studentCode: 'SV001', fullName: 'Nguyễn Văn A', role: Role.STUDENT },
        { id: 's-out', studentCode: 'SV999', fullName: 'Người Ngoài Roster', role: Role.STUDENT },
      ],
      classes: [
        { id: 'c-1', code: '21T1', name: 'Lớp 21T1' },
        { id: 'c-out', code: '99OUT', name: 'Lớp Ngoài Roster' },
      ],
      handoffs: [{ id: 'h-1', termId: 'term-1', studentId: 's-1', classId: 'c-1' }],
    });

    // 1. Thử tạo gia hạn cho sinh viên ngoài kỳ
    await assert.rejects(
      async () => {
        await fixture.deadlineService.create(actor.id, {
          termId: 'term-1',
          targetType: DeadlineExtensionTarget.STUDENT,
          targetId: 's-out',
          type: DeadlineExtensionType.SUBMISSION,
          deadline: new Date('2026-10-10T00:00:00Z').toISOString(),
          reason: 'Lý do kiểm thử',
        });
      },
      (err) => {
        const status = typeof err.getStatus === 'function' ? err.getStatus() : err.status;
        assert.equal(status, 400);
        assert.ok(err.message.includes('không thuộc danh sách kỳ'));
        return true;
      }
    );

    // 2. Thử tạo gia hạn cho lớp ngoài kỳ
    await assert.rejects(
      async () => {
        await fixture.deadlineService.create(actor.id, {
          termId: 'term-1',
          targetType: DeadlineExtensionTarget.CLASS,
          targetId: 'c-out',
          type: DeadlineExtensionType.SUBMISSION,
          deadline: new Date('2026-10-10T00:00:00Z').toISOString(),
          reason: 'Lý do kiểm thử lớp',
        });
      },
      (err) => {
        const status = typeof err.getStatus === 'function' ? err.getStatus() : err.status;
        assert.equal(status, 400);
        assert.ok(err.message.includes('không thuộc danh sách kỳ'));
        return true;
      }
    );

    // 3. Tạo hợp lệ cho s-1 thành công
    const created = await fixture.deadlineService.create(actor.id, {
      termId: 'term-1',
      targetType: DeadlineExtensionTarget.STUDENT,
      targetId: 's-1',
      type: DeadlineExtensionType.SUBMISSION,
      deadline: new Date('2026-10-10T00:00:00Z').toISOString(),
      reason: 'Lý do hợp lệ',
    });
    assert.ok(created.id);
    assert.equal(created.targetId, 's-1');
  });
});
