const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require(path.join(__dirname, '../node_modules/ts-node')).register({
  project: path.join(__dirname, '../tsconfig.json'),
});

const { Role } = require('@prisma/client');

// ============================================================================
// TEST SUITE: ĐỢT 10 — BL-021: Loại trừ -> Khôi phục -> Loại trừ lại
// ============================================================================

describe('BL-021: Chu trình Loại trừ -> Khôi phục -> Loại trừ lại & Chống trùng dedupeKey', () => {
  const { WorkflowService } = require('../src/evaluation-workflow/workflow.service');
  const { BadRequestException, ForbiddenException } = require('@nestjs/common');

  function createMockDb({
    term = { id: 'term-1', status: 'ACTIVE', workflowEnabled: true },
    hasPublication = false,
  }) {
    let handoff = {
      id: 'handoff-1',
      studentId: 'student-1',
      termId: 'term-1',
      status: 'WORKING',
      exclusionReason: null,
      excludedById: null,
      excludedAt: null,
      revision: 0,
    };

    const notifications = [];
    const auditLogs = [];

    const mockTx = {
      $queryRaw: async () => [{ id: term.id }],
      term: {
        findUniqueOrThrow: async () => term,
        findUnique: async () => term,
      },
      assessmentPublication: {
        count: async () => (hasPublication ? 1 : 0),
      },
      assessmentHandoff: {
        findUniqueOrThrow: async ({ where }) => {
          if (where.studentId_termId?.studentId === handoff.studentId) return handoff;
          if (where.id === handoff.id) return handoff;
          throw new Error('Not found handoff');
        },
        update: async ({ data }) => {
          handoff = { ...handoff, ...data };
          return handoff;
        },
      },
      notification: {
        create: async ({ data }) => {
          // Giả lập Prisma @unique constraint trên dedupeKey
          if (data.dedupeKey && notifications.some((n) => n.dedupeKey === data.dedupeKey)) {
            const p2002Err = new Error(`Unique constraint failed on the fields: (dedupeKey)`);
            p2002Err.code = 'P2002';
            throw p2002Err;
          }
          const item = { id: `noti-${notifications.length + 1}`, ...data };
          notifications.push(item);
          return item;
        },
      },
      auditLog: {
        create: async ({ data }) => {
          const item = { id: `audit-${auditLogs.length + 1}`, ...data };
          auditLogs.push(item);
          return item;
        },
      },
    };

    const mockPrisma = {
      $transaction: async (fn) => fn(mockTx),
      term: mockTx.term,
    };

    const mockDeadlines = {};

    return {
      service: new WorkflowService(mockPrisma, mockDeadlines),
      getHandoff: () => handoff,
      getNotifications: () => notifications,
      getAuditLogs: () => auditLogs,
    };
  }

  const adminActor = { id: 'admin-1', role: Role.ADMIN };
  const staffActor = { id: 'staff-1', role: Role.STAFF, facultyId: 'faculty-1' };

  test('Ca 1: Vòng đời Loại trừ (lần 1) -> Khôi phục -> Loại trừ lại (lần 2) thành công 100%, không bị lỗi P2002 dedupeKey', async () => {
    const { service, getHandoff, getNotifications, getAuditLogs } = createMockDb({});

    // Bước 1: Loại trừ lần 1
    const res1 = await service.exclude(adminActor, 'student-1', 'term-1', 'Nợ học phí kéo dài');
    assert.equal(res1.status, 'EXCLUDED');
    assert.equal(res1.exclusionReason, 'Nợ học phí kéo dài');
    assert.equal(res1.revision, 0, 'Revision bàn giao không được tăng khi loại trừ');

    const notisAfterEx1 = getNotifications();
    assert.equal(notisAfterEx1.length, 1);
    const key1 = notisAfterEx1[0].dedupeKey;
    assert(key1.startsWith('excluded:handoff-1:'), 'dedupeKey lần 1 phải có eventId riêng');

    // Bước 2: Khôi phục
    const resRestore = await service.restoreExcluded(adminActor, 'student-1', 'term-1');
    assert.equal(resRestore.status, 'WORKING');
    assert.equal(resRestore.exclusionReason, null);
    assert.equal(resRestore.revision, 0, 'Revision bàn giao không được tăng khi khôi phục');

    const notisAfterRestore = getNotifications();
    assert.equal(notisAfterRestore.length, 2);
    const keyRestore = notisAfterRestore[1].dedupeKey;
    assert(keyRestore.startsWith('restored:handoff-1:'));

    // Bước 3: Loại trừ lại lần 2 (ĐÂY LÀ ĐIỂM CHẾT CŨ CỦA BUG BL-021)
    const res2 = await service.exclude(adminActor, 'student-1', 'term-1', 'Vi phạm kỷ luật học vụ mới');
    assert.equal(res2.status, 'EXCLUDED');
    assert.equal(res2.exclusionReason, 'Vi phạm kỷ luật học vụ mới');
    assert.equal(res2.revision, 0, 'Revision bàn giao được giữ nguyên');

    const notisAfterEx2 = getNotifications();
    assert.equal(notisAfterEx2.length, 3);
    const key2 = notisAfterEx2[2].dedupeKey;
    assert(key2.startsWith('excluded:handoff-1:'));

    // Kiểm tra tính duy nhất: 3 dedupeKey hoàn toàn khác biệt
    assert.notEqual(key1, key2, 'dedupeKey lần 2 không được trùng lần 1');
    assert.notEqual(key1, keyRestore);
    assert.notEqual(key2, keyRestore);

    // Kiểm tra audit log lưu eventId
    const audits = getAuditLogs();
    assert.equal(audits.length, 3);
    assert(audits[0].newValue.eventId, 'Audit log loại trừ 1 phải có eventId');
    assert(audits[1].newValue.eventId, 'Audit log khôi phục phải có eventId');
    assert(audits[2].newValue.eventId, 'Audit log loại trừ 2 phải có eventId');
  });

  test('Ca 2: Tính Idempotent — Đã ở trạng thái EXCLUDED là strict no-op, không ghi đè lý do và không sinh notification thừa kể cả truyền lý do khác', async () => {
    const { service, getHandoff, getNotifications } = createMockDb({});

    // Loại trừ lần 1
    const res1 = await service.exclude(adminActor, 'student-1', 'term-1', 'Lý do ban đầu');
    assert.equal(getNotifications().length, 1);
    assert.equal(res1.exclusionReason, 'Lý do ban đầu');

    // Gọi lại lần 2 với lý do khác khi đang EXCLUDED -> strict no-op
    const resIdempotent = await service.exclude(adminActor, 'student-1', 'term-1', 'Lý do khác thử ghi đè');
    assert.equal(resIdempotent.status, 'EXCLUDED');
    assert.equal(resIdempotent.exclusionReason, 'Lý do ban đầu', 'Không được ghi đè lý do loại trừ cũ khi chưa khôi phục');
    // Không tạo thêm notification thứ hai
    assert.equal(getNotifications().length, 1, 'Không được bắn notification thừa khi request lặp lại');
  });

  test('Ca 3: Khôi phục sinh viên không ở trạng thái EXCLUDED -> Ném BadRequestException', async () => {
    const { service } = createMockDb({});
    // Sinh viên ban đầu đang là WORKING

    await assert.rejects(
      async () => {
        await service.restoreExcluded(adminActor, 'student-1', 'term-1');
      },
      (err) => {
        assert(err instanceof BadRequestException);
        assert(err.message.includes('không thuộc trường hợp loại trừ'));
        return true;
      }
    );
  });

  test('Ca 4: Cán bộ Khoa (STAFF) không có quyền loại trừ hoặc khôi phục -> Ném BadRequestException / ForbiddenException', async () => {
    const { service } = createMockDb({});

    await assert.rejects(
      async () => {
        await service.exclude(staffActor, 'student-1', 'term-1', 'Cán bộ Khoa thử loại trừ');
      },
      (err) => {
        assert(err instanceof BadRequestException);
        assert(err.message.includes('lý do loại trừ') || err.message.includes('Admin'));
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await service.restoreExcluded(staffActor, 'student-1', 'term-1');
      },
      (err) => {
        assert(err instanceof ForbiddenException);
        return true;
      }
    );
  });

  test('Ca 5: Không thể loại trừ sinh viên khi kết quả kỳ đã công bố', async () => {
    const { service } = createMockDb({ hasPublication: true });

    await assert.rejects(
      async () => {
        await service.exclude(adminActor, 'student-1', 'term-1', 'Loại trừ sau công bố');
      },
      (err) => {
        assert(err instanceof BadRequestException);
        assert(err.message.includes('Kết quả đã công bố'));
        return true;
      }
    );
  });

  test('Ca 6: Không thể loại trừ hoặc khôi phục khi kỳ đã chốt (CLOSED)', async () => {
    const { service } = createMockDb({
      term: { id: 'term-1', status: 'CLOSED' },
    });

    await assert.rejects(
      async () => {
        await service.exclude(adminActor, 'student-1', 'term-1', 'Loại trừ khi chốt');
      },
      (err) => {
        assert(err instanceof BadRequestException);
        assert(err.message.includes('Kỳ đã chốt'));
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await service.restoreExcluded(adminActor, 'student-1', 'term-1');
      },
      (err) => {
        assert(err instanceof BadRequestException);
        assert(err.message.includes('Kỳ đã chốt'));
        return true;
      }
    );
  });
});
