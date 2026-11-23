const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require(path.join(__dirname, '../node_modules/ts-node')).register({
  project: path.join(__dirname, '../tsconfig.json'),
});

const { ProfileDataIssueStatus, EvidenceStatus, Role } = require('@prisma/client');
const { lastValueFrom, of } = require('rxjs');
const { ResponseInterceptor } = require('../src/common/interceptors/response.interceptor');

const toEnvelope = data => lastValueFrom(new ResponseInterceptor().intercept({}, { handle: () => of(data) }));

// ============================================================================
// TEST SUITE: ĐỢT 9 — BL-018, BL-019
// ============================================================================

describe('BL-018: Phân trang yêu cầu sửa thông tin hồ sơ (ProfileDataIssues)', () => {
  const { ProfileDataIssuesService } = require('../src/profile-data-issues/profile-data-issues.service');

  function createMockPrisma(totalCount = 35) {
    const mockIssues = Array.from({ length: totalCount }, (_, i) => ({
      id: `issue-${i + 1}`,
      reporterId: `student-${(i % 5) + 1}`,
      category: 'Thông tin cá nhân',
      content: `Nội dung sai thông tin thứ ${i + 1}`,
      status: i % 2 === 0 ? ProfileDataIssueStatus.OPEN : ProfileDataIssueStatus.RESOLVED,
      createdAt: new Date(Date.now() - i * 3600 * 1000),
      reporter: {
        id: `student-${(i % 5) + 1}`,
        fullName: `Sinh viên ${i + 1}`,
        email: `sv${i + 1}@dut.udn.vn`,
        studentCode: `1022100${i + 1}`,
        class: { code: '21TCLC_DT1', faculty: { name: 'CNTT' } },
      },
      resolver: null,
    }));

    return {
      profileDataIssue: {
        findMany: async ({ where, skip = 0, take = 25 }) => {
          let filtered = mockIssues;
          if (where?.status) {
            filtered = filtered.filter((item) => item.status === where.status);
          }
          return filtered.slice(skip, skip + take);
        },
        count: async ({ where }) => {
          let filtered = mockIssues;
          if (where?.status) {
            filtered = filtered.filter((item) => item.status === where.status);
          }
          return filtered.length;
        },
      },
      $transaction: async (queries) => Promise.all(queries),
    };
  }

  test('Ca 1: list(OPEN, 1, 10) trả về đúng envelope { items, total, page: 1, pageSize: 10 }', async () => {
    const service = new ProfileDataIssuesService(createMockPrisma(35));
    const res = await service.list(ProfileDataIssueStatus.OPEN, 1, 10);

    assert.equal(res.page, 1);
    assert.equal(res.pageSize, 10);
    assert.equal(res.items.length, 10);
    // 35 bản ghi thì i%2 === 0 có 18 bản ghi OPEN
    assert.equal(res.total, 18);
    assert.equal(res.items[0].id, 'issue-1');
  });

  test('Ca 2: list(OPEN, 2, 10) chuyển sang trang 2 trả về 8 bản ghi còn lại (skip 10)', async () => {
    const service = new ProfileDataIssuesService(createMockPrisma(35));
    const res = await service.list(ProfileDataIssueStatus.OPEN, 2, 10);

    assert.equal(res.page, 2);
    assert.equal(res.pageSize, 10);
    assert.equal(res.items.length, 8); // 18 - 10 = 8 bản ghi ở trang 2
    assert.equal(res.total, 18);
  });

  test('Ca 3: pageSize được chuẩn hóa an toàn (min 1, max 100, fallback khi không truyền)', async () => {
    const service = new ProfileDataIssuesService(createMockPrisma(150));
    // Yêu cầu 500 bản ghi -> tự động clamp về tối đa 100
    const resOversize = await service.list(undefined, 1, 500);
    assert.equal(resOversize.pageSize, 100);

    // Truyền pageSize âm -> tự động clamp về mặc định 25
    const resNegative = await service.list(undefined, 1, -5);
    assert.equal(resNegative.pageSize, 25);
  });
});

describe('BL-019: Phân trang và bộ lọc danh sách minh chứng (EvidenceList)', () => {
  const { EvidenceService } = require('../src/evidence/evidence.service');

  function createMockEvidenceDb(allEvidences = [
      { id: 'evi-1', studentId: 'stu-1', termId: 'term-1', declaredActivityName: 'Mùa hè xanh 2024', status: EvidenceStatus.APPROVED, submittedAt: new Date(1000) },
      { id: 'evi-2', studentId: 'stu-1', termId: 'term-1', declaredActivityName: 'Hiến máu nhân đạo', status: EvidenceStatus.APPROVED, submittedAt: new Date(2000) },
      { id: 'evi-3', studentId: 'stu-1', termId: 'term-1', declaredActivityName: 'Tiếp sức mùa thi', status: EvidenceStatus.NEEDS_SUPPLEMENT, submittedAt: new Date(3000) },
      { id: 'evi-4', studentId: 'stu-1', termId: 'term-1', declaredActivityName: 'Hội thảo khoa học', status: EvidenceStatus.NEEDS_HUMAN_REVIEW, submittedAt: new Date(4000) },
      { id: 'evi-5', studentId: 'stu-1', termId: 'term-1', declaredActivityName: 'Giải bóng đá sinh viên', status: EvidenceStatus.PROCESSING, submittedAt: new Date(5000) },
      { id: 'evi-6', studentId: 'stu-1', termId: 'term-1', declaredActivityName: 'Văn nghệ chào K24', status: EvidenceStatus.PLAUSIBLE, submittedAt: new Date(6000) },
      { id: 'evi-7', studentId: 'stu-1', termId: 'term-1', declaredActivityName: 'Học tập chính trị đầu khóa', status: EvidenceStatus.REJECTED, submittedAt: new Date(7000) },
    ]) {
    const mockWorkflow = {
      evidenceScope: async () => ({}),
    };

    const mockPrisma = {
      evidence: {
        findMany: async ({ where, skip = 0, take = 20 }) => {
          let list = allEvidences;
          if (where?.status) {
            if (typeof where.status === 'object' && where.status.in) {
              list = list.filter((e) => where.status.in.includes(e.status));
            } else {
              list = list.filter((e) => e.status === where.status);
            }
          }
          if (where?.OR) {
            const nameCond = where.OR.find((c) => c.declaredActivityName);
            const idCond = where.OR.find((c) => c.id);
            const searchStr = (nameCond?.declaredActivityName?.contains || idCond?.id?.contains || '').toLowerCase();
            list = list.filter((e) =>
              (e.declaredActivityName && e.declaredActivityName.toLowerCase().includes(searchStr)) ||
              (e.id && e.id.toLowerCase().includes(searchStr))
            );
          }
          return list.slice(skip, skip + take).map((e) => ({
            ...e,
            files: [],
            verificationResults: [],
            aiSuggestions: [],
            reviews: [],
            supplementRequests: [],
          }));
        },
        count: async ({ where }) => {
          let list = allEvidences;
          if (where?.status) {
            if (typeof where.status === 'object' && where.status.in) {
              list = list.filter((e) => where.status.in.includes(e.status));
            } else {
              list = list.filter((e) => e.status === where.status);
            }
          }
          if (where?.OR) {
            const nameCond = where.OR.find((c) => c.declaredActivityName);
            const idCond = where.OR.find((c) => c.id);
            const searchStr = (nameCond?.declaredActivityName?.contains || idCond?.id?.contains || '').toLowerCase();
            list = list.filter((e) =>
              (e.declaredActivityName && e.declaredActivityName.toLowerCase().includes(searchStr)) ||
              (e.id && e.id.toLowerCase().includes(searchStr))
            );
          }
          return list.length;
        },
      },
    };

    return { mockPrisma, mockWorkflow };
  }

  const studentUser = { id: 'stu-1', role: Role.STUDENT };

  test('Ca 1: findAll phân trang server-side với page và pageSize', async () => {
    const { mockPrisma, mockWorkflow } = createMockEvidenceDb();
    const service = new EvidenceService(mockPrisma, mockWorkflow, null, null, null);

    const res = await service.findAll(studentUser, {
      termId: 'term-1',
      page: 1,
      pageSize: 3,
    });

    assert.equal(res.items.length, 3);
    assert.equal(res.total, 7);
    assert.equal(res.page, 1);
    assert.equal(res.pageSize, 3);
  });

  test('Ca 2: Lọc theo statusGroup: "APPROVED" chỉ lấy các minh chứng đã duyệt', async () => {
    const { mockPrisma, mockWorkflow } = createMockEvidenceDb();
    const service = new EvidenceService(mockPrisma, mockWorkflow, null, null, null);

    const res = await service.findAll(studentUser, {
      termId: 'term-1',
      statusGroup: 'APPROVED',
      page: 1,
      pageSize: 10,
    });

    assert.equal(res.items.length, 2);
    assert.equal(res.total, 2);
    assert(res.items.every((item) => item.status === EvidenceStatus.APPROVED));
  });

  test('Ca 3: Trả về counts chuẩn cho 4 nhóm trạng thái (all, approved, supplement, reviewing)', async () => {
    const { mockPrisma, mockWorkflow } = createMockEvidenceDb();
    const service = new EvidenceService(mockPrisma, mockWorkflow, null, null, null);

    const res = await service.findAll(studentUser, {
      termId: 'term-1',
      statusGroup: 'APPROVED', // Dù đang xem tab APPROVED
      page: 1,
      pageSize: 10,
    });

    // Counts phải phản ánh toàn bộ trạng thái trong kỳ của sinh viên
    assert.equal(res.counts.all, 7, 'Tổng số minh chứng là 7');
    assert.equal(res.counts.approved, 2, 'Số đã duyệt là 2');
    assert.equal(res.counts.supplement, 1, 'Số cần bổ sung là 1');
    assert.equal(res.counts.reviewing, 3, 'Số đang xử lý (NEEDS_HUMAN_REVIEW, PROCESSING, PLAUSIBLE) là 3');
  });

  test('Ca 4: Tìm kiếm theo từ khóa search "Hiến máu"', async () => {
    const { mockPrisma, mockWorkflow } = createMockEvidenceDb();
    const service = new EvidenceService(mockPrisma, mockWorkflow, null, null, null);

    const res = await service.findAll(studentUser, {
      termId: 'term-1',
      search: 'Hiến máu',
      page: 1,
      pageSize: 10,
    });

    assert.equal(res.items.length, 1);
    assert.equal(res.items[0].declaredActivityName, 'Hiến máu nhân đạo');
    // BL-018: counts không xóa search filter -> counts phản ánh đúng kết quả tìm kiếm
    assert.equal(res.counts.all, 1);
    assert.equal(res.counts.approved, 1);
    assert.equal(res.counts.supplement, 0);
  });

  test('Ca 5: Tìm kiếm theo ID minh chứng (ví dụ "evi-3")', async () => {
    const { mockPrisma, mockWorkflow } = createMockEvidenceDb();
    const service = new EvidenceService(mockPrisma, mockWorkflow, null, null, null);

    const res = await service.findAll(studentUser, {
      termId: 'term-1',
      search: 'evi-3',
      page: 1,
      pageSize: 10,
    });

    assert.equal(res.items.length, 1);
    assert.equal(res.items[0].id, 'evi-3');
    assert.equal(res.items[0].status, EvidenceStatus.NEEDS_SUPPLEMENT);
    assert.equal(res.counts.all, 1);
    assert.equal(res.counts.supplement, 1);
    assert.equal(res.counts.approved, 0);
  });

  test('BL-035: count includes supplement outside the first page and status filter retrieves it', async () => {
    const rows = Array.from({ length: 21 }, (_, index) => ({
      id: 'ev-' + (index + 1),
      studentId: 'stu-1',
      termId: 'term-1',
      status: index === 20 ? EvidenceStatus.NEEDS_SUPPLEMENT : EvidenceStatus.APPROVED,
    }));
    const { mockPrisma, mockWorkflow } = createMockEvidenceDb(rows);
    const service = new EvidenceService(mockPrisma, mockWorkflow);
    const page = await toEnvelope(await service.findAll(studentUser, { termId: 'term-1' }));
    assert.equal(page.data.length, 20);
    assert.deepEqual(page.meta.counts, { all: 21, approved: 20, reviewing: 0, supplement: 1 });
    assert.equal(page.meta.total, 21);
    const second = await service.findAll(studentUser, { termId: 'term-1', page: 2 });
    const filtered = await service.findAll(studentUser, { termId: 'term-1', status: EvidenceStatus.NEEDS_SUPPLEMENT, pageSize: 8 });
    assert.equal(second.items[0].id, 'ev-21');
    assert.deepEqual(filtered.items.map(e => e.id), ['ev-21']);
    assert.equal(filtered.total, 1);
    assert.equal(filtered.counts.all, 21);
  });
});

test('BL-037: unread total covers all notifications for the owner even with a 50-row limit', async () => {
  const { NotificationsService } = require('../src/notifications/notifications.service');
  const rows = [
    ...Array.from({ length: 51 }, (_, index) => ({ id: 'n-' + index, userId: 'owner', isRead: index < 50 })),
    { id: 'other-user', userId: 'other', isRead: false },
  ];
  const notifications = new NotificationsService({ notification: {
    findMany: async ({ where, take }) => rows.filter(n => n.userId === where.userId).slice(0, take),
    count: async ({ where }) => rows.filter(n => n.userId === where.userId && n.isRead === where.isRead).length,
  } });
  const response = await toEnvelope(await notifications.findAll('owner'));
  assert.equal(response.data.items.length, 50);
  assert.ok(response.data.items.every(n => n.isRead));
  assert.equal(response.data.unreadCount, 1);
});
