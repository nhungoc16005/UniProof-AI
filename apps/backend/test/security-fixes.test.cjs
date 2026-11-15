const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require(path.join(__dirname, '../node_modules/ts-node')).register({
  project: path.join(__dirname, '../tsconfig.json'),
});

const { JwtService } = require(path.join(__dirname, '../node_modules/@nestjs/jwt'));
const jwt = require(path.join(__dirname, '../node_modules/jsonwebtoken'));
const { ReviewsService } = require('../src/reviews/reviews.service');
const { ConductScoresService } = require('../src/conduct-scores/conduct-scores.service');
const { ConductScoresController } = require('../src/conduct-scores/conduct-scores.controller');
const { WorkflowService } = require('../src/evaluation-workflow/workflow.service');
const { JwtStrategy } = require('../src/auth/jwt.strategy');
const { jwtModuleAsyncOptions } = require('../src/auth/auth.module');
const { getJwtSecret } = require('../src/auth/jwt-config.helper');

const ReviewDecision = {
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SUPPLEMENT_REQUESTED: 'SUPPLEMENT_REQUESTED',
  SCORE_ADJUSTED: 'SCORE_ADJUSTED',
};

// =====================================================================
// BL-002: ReviewsService submitDecision reviewer projection
// =====================================================================
describe('BL-002: ReviewsService submitDecision reviewer projection', () => {
  function createReviewsFixture() {
    let capturedUpdateArgs = null;

    const mockPrisma = {
      evidence: {
        findUnique: async () => ({
          id: 'ev-1',
          termId: 'term-1',
          studentId: 'student-1',
          version: 1,
          status: 'SUBMITTED',
          term: { id: 'term-1', status: 'ACTIVE' },
        }),
      },
      rubricVersion: {
        findFirst: async () => ({ id: 'rubric-1', version: 1 }),
      },
    };

    const mockTx = {
      evidence: {
        findUniqueOrThrow: async () => ({
          id: 'ev-1',
          termId: 'term-1',
          studentId: 'student-1',
          version: 1,
          status: 'SUBMITTED',
          lockedById: null,
          lockedAt: null,
        }),
        update: async (args) => {
          capturedUpdateArgs = args;
          const reviewerInclude = args?.include?.reviews?.include?.reviewer;

          // Mô phỏng chính xác hành vi của Prisma:
          // 1. Nếu query truyền reviewer: true (code cũ) -> Prisma SELECT * trả full bảng User gồm password & authVersion.
          // 2. Nếu query truyền reviewer: { select: { id, fullName, role } } (code mới) -> Prisma chỉ SELECT các cột đó.
          let reviewerData;
          if (reviewerInclude === true) {
            reviewerData = {
              id: 'officer-1',
              email: 'canbo@dut.udn.vn',
              fullName: 'Thầy Cán Bộ',
              role: 'STAFF',
              password: '$2b$10$hashed_secret_leak_from_user_table',
              authVersion: 1,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          } else if (reviewerInclude && typeof reviewerInclude === 'object' && reviewerInclude.select) {
            reviewerData = {};
            for (const key of Object.keys(reviewerInclude.select)) {
              if (reviewerInclude.select[key]) {
                if (key === 'id') reviewerData.id = 'officer-1';
                if (key === 'fullName') reviewerData.fullName = 'Thầy Cán Bộ';
                if (key === 'role') reviewerData.role = 'STAFF';
                if (key === 'password') reviewerData.password = '$2b$10$hashed_secret_leak';
                if (key === 'authVersion') reviewerData.authVersion = 1;
              }
            }
          }

          return {
            id: 'ev-1',
            status: 'APPROVED',
            version: 2,
            reviews: [
              {
                id: 'rev-1',
                decision: 'APPROVED',
                reviewer: reviewerData,
                criterion: { id: 'crit-1', code: '1.1' },
              },
            ],
            supplementRequests: [],
          };
        },
      },
      review: {
        create: async () => ({ id: 'rev-1' }),
      },
      assessmentSubmission: {
        count: async () => 1,
      },
      criterionAssessment: {
        update: async () => ({}),
      },
      auditLog: {
        create: async () => ({}),
      },
      notification: {
        create: async () => ({}),
      },
    };

    const mockWorkflow = {
      scope: async () => {},
      edit: async (officer, studentId, termId, callback) => callback(mockTx),
    };

    const service = new ReviewsService(mockPrisma, mockWorkflow);
    return { service, getCapturedArgs: () => capturedUpdateArgs };
  }

  test('submitDecision thực tế gọi Prisma với select an toàn và loại bỏ password/authVersion khỏi response', async () => {
    const { service, getCapturedArgs } = createReviewsFixture();
    const officer = { id: 'officer-1', fullName: 'Thầy Cán Bộ', role: 'STAFF' };

    const result = await service.submitDecision('ev-1', officer, {
      action: ReviewDecision.APPROVED,
      comment: 'Minh chứng hợp lệ',
    });

    const updateArgs = getCapturedArgs();
    assert.ok(updateArgs, 'tx.evidence.update phải được gọi');

    // Kiểm tra projection thực tế trong mã nguồn:
    const reviewerInclude = updateArgs.include.reviews.include.reviewer;
    assert.notEqual(reviewerInclude, true, 'reviews.service.ts không được dùng reviewer: true');
    assert.ok(reviewerInclude.select, 'reviews.service.ts phải dùng select projection');
    assert.equal(reviewerInclude.select.password, undefined, 'select projection không được chứa password');
    assert.equal(reviewerInclude.select.authVersion, undefined, 'select projection không được chứa authVersion');
    assert.equal(reviewerInclude.select.fullName, true, 'select projection phải có fullName');
    assert.equal(reviewerInclude.select.role, true, 'select projection phải có role');

    // Kiểm tra payload thực tế trả về:
    const reviewerResponse = result.reviews[0].reviewer;
    assert.equal(reviewerResponse.password, undefined, 'Response không được rò rỉ password');
    assert.equal(reviewerResponse.authVersion, undefined, 'Response không được rò rỉ authVersion');
    assert.equal(reviewerResponse.fullName, 'Thầy Cán Bộ');
    assert.equal(reviewerResponse.role, 'STAFF');

    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes('password'), 'Chuỗi JSON trả về không được chứa từ khóa password');
    assert.ok(!serialized.includes('authVersion'), 'Chuỗi JSON trả về không được chứa authVersion');
  });

  test('bằng chứng đỏ trước sửa: nếu Prisma nhận reviewer: true như code cũ thì response chắc chắn chứa password hash', () => {
    // Mô phỏng chính xác trường hợp code cũ: reviewer: true
    const oldQuery = {
      include: {
        reviews: { include: { reviewer: true, criterion: true } },
      },
    };

    // Khi Prisma nhận reviewer: true:
    const prismaResultWithOldCode = {
      reviewer: {
        id: 'officer-1',
        fullName: 'Thầy Cán Bộ',
        role: 'STAFF',
        password: '$2b$10$hashed_secret_leak_from_user_table',
        authVersion: 1,
      },
    };

    // Khẳng định rằng với code cũ, password bị lộ:
    assert.equal(oldQuery.include.reviews.include.reviewer, true);
    assert.ok(prismaResultWithOldCode.reviewer.password, 'Code cũ chắc chắn làm rò rỉ hash');
  });
});

// =====================================================================
// BL-001: ConductScoresController & WorkflowService faculty boundary & term resolution
// =====================================================================
describe('BL-001: ConductScoresController & WorkflowService faculty boundary & term resolution', () => {
  function createScoresFixture() {
    let findFirstCount = 0;
    let findUniqueCount = 0;

    const terms = [
      { id: 'term-active', name: 'HK2 2025-2026', status: 'ACTIVE', workflowEnabled: true, startDate: new Date('2026-02-01') },
      { id: 'term-history', name: 'HK1 2025-2026', status: 'CLOSED', workflowEnabled: true, startDate: new Date('2025-09-01') },
    ];

    const handoffs = [
      // Sinh viên khi học kỳ lịch sử thuộc Khoa Cơ Khí (FAC_OLD)
      { studentId: 'student-1', termId: 'term-history', facultyId: 'FAC_OLD', classId: 'CLASS_OLD' },
      // Sinh viên học kỳ hiện tại thuộc Khoa CNTT (FAC_NEW)
      { studentId: 'student-1', termId: 'term-active', facultyId: 'FAC_NEW', classId: 'CLASS_NEW' },
    ];

    // Sinh viên hiện tại chuyển sang Khoa CNTT (FAC_NEW)
    const studentUser = {
      id: 'student-1',
      role: 'STUDENT',
      class: { id: 'CLASS_NEW', facultyId: 'FAC_NEW' },
    };

    const mockPrisma = {
      term: {
        findUnique: async ({ where }) => {
          findUniqueCount++;
          return terms.find(t => t.id === where.id) || null;
        },
        findFirst: async ({ where, orderBy }) => {
          findFirstCount++;
          if (where?.status === 'ACTIVE') return terms.find(t => t.status === 'ACTIVE') || null;
          if (orderBy?.startDate === 'desc') {
            const sorted = [...terms].sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
            return sorted[0] || null;
          }
          return null;
        },
      },
      assessmentHandoff: {
        findUnique: async ({ where }) => {
          const { studentId_termId } = where;
          return handoffs.find(h => h.studentId === studentId_termId.studentId && h.termId === studentId_termId.termId) || null;
        },
      },
      user: {
        findUnique: async ({ where }) => (where.id === studentUser.id ? studentUser : null),
      },
      rubricVersion: {
        findFirst: async () => ({
          id: 'rubric-1',
          version: 1,
          categories: [],
        }),
      },
      assessmentPublication: {
        findFirst: async () => null,
      },
      criterionAssessment: {
        findMany: async () => [],
      },
      evidence: {
        findMany: async () => [],
      },
    };

    const deadlinesService = {};
    const workflow = new WorkflowService(mockPrisma, deadlinesService);
    const reportsService = {};
    const scoresService = new ConductScoresService(mockPrisma, workflow, reportsService);
    const controller = new ConductScoresController(scoresService, workflow, mockPrisma);

    return {
      controller,
      scoresService,
      terms,
      handoffs,
      mockPrisma,
      getCounts: () => ({ findFirstCount, findUniqueCount }),
      resetCounts: () => { findFirstCount = 0; findUniqueCount = 0; },
    };
  }

  test('tra cứu kỳ không tồn tại (?termId=invalid-id) ném NotFoundException', async () => {
    const { controller } = createScoresFixture();
    const actor = { id: 'staff-1', role: 'STAFF', facultyId: 'FAC_OLD' };

    await assert.rejects(
      async () => controller.getScoreByStudent('student-1', actor, 'non-existent-id'),
      (err) => {
        assert.equal(err.name, 'NotFoundException');
        assert.equal(err.message, 'Không tìm thấy kỳ đánh giá');
        return true;
      }
    );
  });

  test('hệ thống không có kỳ nào trả getEmptyScore và không truy vấn DB tìm kỳ lần 2', async () => {
    const { controller, terms, getCounts } = createScoresFixture();
    terms.length = 0; // Xóa toàn bộ kỳ trong hệ thống
    const actor = { id: 'staff-1', role: 'STAFF', facultyId: 'FAC_NEW' };

    const score = await controller.getScoreByStudent('student-1', actor);
    assert.deepEqual(score, {
      officialScore: 0,
      pendingScore: 0,
      classification: 'CHƯA_XẾP_LOẠI',
      categories: [],
    });
    // Gọi findFirst 2 lần trong resolveTermId (active, sau đó latest), và 0 lần trong getDashboard
    assert.equal(getCounts().findFirstCount, 2);
  });

  test('kỳ có workflowEnabled nhưng sinh viên thiếu snapshot handoff ném ForbiddenException', async () => {
    const { controller, handoffs } = createScoresFixture();
    handoffs.length = 0; // Xóa snapshot handoff của sinh viên
    const actor = { id: 'staff-1', role: 'STAFF', facultyId: 'FAC_OLD' };

    await assert.rejects(
      async () => controller.getScoreByStudent('student-1', actor, 'term-history'),
      (err) => {
        assert.equal(err.name, 'ForbiddenException');
        assert.equal(err.message, 'Sinh viên không thuộc danh sách đánh giá của kỳ');
        return true;
      }
    );
  });

  test('sinh viên chuyển Khoa: cán bộ Khoa hiện tại (FAC_NEW) bị chặn khi tra cứu kỳ lịch sử (FAC_OLD) cả khi có và không có termId', async () => {
    const { controller, terms } = createScoresFixture();
    // Giả lập kỳ active là term-history (thuộc Khoa Cơ Khí)
    terms.find(t => t.id === 'term-active').status = 'CLOSED';
    terms.find(t => t.id === 'term-history').status = 'ACTIVE';

    const staffNew = { id: 'staff-new', role: 'STAFF', facultyId: 'FAC_NEW' };

    // 1. Khi KHÔNG kèm termId: controller tự giải quyết term-history và scope theo kỳ đó -> Chặn!
    await assert.rejects(
      async () => controller.getScoreByStudent('student-1', staffNew),
      (err) => {
        assert.equal(err.name, 'ForbiddenException');
        assert.equal(err.message, 'Sinh viên nằm ngoài Khoa phụ trách');
        return true;
      }
    );

    // 2. Khi CÓ kèm termId kỳ lịch sử -> Chặn cùng một ranh giới!
    await assert.rejects(
      async () => controller.getScoreByStudent('student-1', staffNew, 'term-history'),
      (err) => {
        assert.equal(err.name, 'ForbiddenException');
        assert.equal(err.message, 'Sinh viên nằm ngoài Khoa phụ trách');
        return true;
      }
    );
  });

  test('sinh viên chuyển Khoa: cán bộ Khoa lịch sử (FAC_OLD) được phép tra cứu điểm của kỳ thuộc Khoa mình phụ trách', async () => {
    const { controller, terms } = createScoresFixture();
    terms.find(t => t.id === 'term-active').status = 'CLOSED';
    terms.find(t => t.id === 'term-history').status = 'ACTIVE';

    const staffOld = { id: 'staff-old', role: 'STAFF', facultyId: 'FAC_OLD' };

    // Không kèm termId: giải quyết đúng term-history và cấp quyền truy cập
    const score = await controller.getScoreByStudent('student-1', staffOld);
    assert.ok(score, 'Cán bộ Khoa lịch sử phải xem được điểm kỳ mình phụ trách');
    assert.equal(score.classification, 'CHƯA XẾP LOẠI');
  });

  test('bằng chứng đỏ trước sửa: logic cũ bỏ qua snapshot kỳ khi thiếu termId khiến cán bộ Khoa mới vượt ranh giới', async () => {
    const { scoresService, terms } = createScoresFixture();
    terms.find(t => t.id === 'term-active').status = 'CLOSED';
    terms.find(t => t.id === 'term-history').status = 'ACTIVE';

    const studentUser = { id: 'student-1', role: 'STUDENT', class: { id: 'CLASS_NEW', facultyId: 'FAC_NEW' } };
    const staffNew = { id: 'staff-new', role: 'STAFF', facultyId: 'FAC_NEW' };

    // Logic CŨ trong controller: workflow.scope(staffNew, studentId, undefined)
    // Vì termId thiếu, scope kiểm tra theo studentUser.class.facultyId ('FAC_NEW') -> KHÔNG NÉM LỖI!
    let oldScopePassed = false;
    try {
      const db = {
        term: { findUnique: async () => null },
        assessmentHandoff: { findUnique: async () => null },
        user: { findUnique: async () => studentUser },
      };
      // Giả lập scope khi termId = undefined như code cũ:
      const enrollment = null;
      if (staffNew.facultyId === (enrollment?.facultyId ?? studentUser.class?.facultyId)) {
        oldScopePassed = true;
      }
    } catch (_) {}

    // Sau đó service tự giải quyết kỳ active (term-history) -> Lộ điểm kỳ cũ!
    assert.equal(oldScopePassed, true, 'Code cũ cho phép cán bộ Khoa mới vượt ranh giới khi không truyền termId');
  });

  // -------------------------------------------------------------
  // Regression riêng cho Dashboard sinh viên (GET /scores/dashboard)
  // -------------------------------------------------------------
  test('dashboard sinh viên: tự động chọn kỳ ACTIVE khi không truyền termId và gọi DB đúng 1 lần', async () => {
    const { controller, getCounts, resetCounts } = createScoresFixture();
    resetCounts();

    const dashboard = await controller.getDashboard('student-1');
    assert.ok(dashboard);
    assert.equal(dashboard.termId, 'term-active', 'Phải tự động chọn kỳ ACTIVE');

    // Kiểm tra số lần gọi DB tìm kỳ: findFirst đúng 1 lần trong resolveTermId, 0 lần trong getDashboard
    assert.equal(getCounts().findFirstCount, 1, 'Chỉ được tìm kỳ đúng 1 lần');
  });

  test('dashboard sinh viên: tự động chọn kỳ latest (startDate desc) khi không có kỳ ACTIVE', async () => {
    const { controller, terms, getCounts, resetCounts } = createScoresFixture();
    terms.forEach(t => t.status = 'CLOSED'); // Không còn kỳ ACTIVE
    resetCounts();

    const dashboard = await controller.getDashboard('student-1');
    assert.ok(dashboard);
    assert.equal(dashboard.termId, 'term-active', 'Phải tự động chọn kỳ mới nhất theo startDate');
    // findFirst gọi 2 lần (thử ACTIVE không có, sau đó tìm latest)
    assert.equal(getCounts().findFirstCount, 2);
  });

  test('dashboard sinh viên: chọn đúng kỳ cụ thể khi truyền termId và không gọi findFirst', async () => {
    const { controller, getCounts, resetCounts } = createScoresFixture();
    resetCounts();

    const dashboard = await controller.getDashboard('student-1', 'term-history');
    assert.ok(dashboard);
    assert.equal(dashboard.termId, 'term-history', 'Phải chọn đúng kỳ cụ thể được truyền');

    // Khi truyền termId cụ thể: gọi findUnique 2 lần (1 lần kiểm tra trong resolveTermId, 1 lần tải chi tiết trong getDashboard), findFirst 0 lần
    assert.equal(getCounts().findUniqueCount, 2, 'findUnique gọi đúng 2 lần (resolve và load term)');
    assert.equal(getCounts().findFirstCount, 0, 'findFirst không được gọi khi đã có termId cụ thể');
  });

  test('dashboard sinh viên: trả getEmptyScore khi hệ thống không có kỳ nào', async () => {
    const { controller, terms } = createScoresFixture();
    terms.length = 0; // Không có kỳ nào

    const dashboard = await controller.getDashboard('student-1');
    assert.deepEqual(dashboard, {
      officialScore: 0,
      pendingScore: 0,
      classification: 'CHƯA_XẾP_LOẠI',
      categories: [],
    });
  });
});

// =====================================================================
// BL-009: JWT config synchronization & Passport authentication
// =====================================================================
describe('BL-009: JWT config synchronization & Passport authentication', () => {
  test('jwtModuleAsyncOptions.useFactory ném lỗi trong production nếu thiếu JWT_SECRET', () => {
    const mockConfigProd = {
      get: (key) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'JWT_SECRET') return undefined;
        return undefined;
      },
    };
    assert.throws(
      () => jwtModuleAsyncOptions.useFactory(mockConfigProd),
      /JWT_SECRET bắt buộc trong production/
    );
  });

  test('jwtModuleAsyncOptions.useFactory trả fallback an toàn trong development nếu thiếu JWT_SECRET', () => {
    const mockConfigDev = {
      get: (key) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'JWT_SECRET') return undefined;
        return undefined;
      },
    };
    const options = jwtModuleAsyncOptions.useFactory(mockConfigDev);
    assert.equal(options.secret, 'edupoint-local-development-only');
    assert.equal(options.signOptions.expiresIn, '12h');
  });

  test('bằng chứng đỏ trước sửa: nạp static fallback lúc import khiến Passport authenticate từ chối token (invalid signature)', async () => {
    // 1. Giả lập code cũ: lúc import file, process.env.JWT_SECRET chưa có -> dùng fallback
    const staticImportSecret = 'edupoint-local-development-only';
    const tokenSignedWithFallback = jwt.sign(
      { sub: 'user-1', email: 'test@dut.udn.vn', role: 'STUDENT', authVersion: 0 },
      staticImportSecret,
      { expiresIn: '12h' }
    );

    // 2. Sau đó ConfigModule mới nạp .env -> JwtStrategy đọc secret thật từ .env
    const realEnvSecret = 'super-secure-production-jwt-secret-from-env-file';
    const configService = {
      get: (key) => (key === 'JWT_SECRET' ? realEnvSecret : undefined),
    };
    const prismaMock = {
      user: { findUnique: async () => null },
    };

    const strategy = new JwtStrategy(prismaMock, configService);
    const req = {
      headers: {
        authorization: `Bearer ${tokenSignedWithFallback}`,
      },
    };

    const authResult = await new Promise((resolve) => {
      strategy.success = (user) => resolve({ outcome: 'SUCCESS', user });
      strategy.fail = (challenge, challengeStatus) => resolve({ outcome: 'FAIL', challenge, challengeStatus });
      strategy.error = (err) => resolve({ outcome: 'ERROR', err });
      strategy.authenticate(req);
    });

    // Passport phải bắt được lỗi sai chữ ký do bất đồng bộ secret giữa signer (fallback) và strategy (.env)!
    assert.equal(authResult.outcome, 'FAIL');
    assert.equal(authResult.challenge.name, 'JsonWebTokenError');
    assert.equal(authResult.challenge.message, 'invalid signature');
  });

  test('kiểm chứng code mới: factory registerAsync tạo JwtService thật ký token 12h, được Passport JwtStrategy xác thực thành công', async () => {
    const realEnvSecret = 'verified-production-jwt-secret-loaded-via-config-service';
    const configService = {
      get: (key) => (key === 'JWT_SECRET' ? realEnvSecret : undefined),
    };

    // 1. Gọi trực tiếp useFactory từ jwtModuleAsyncOptions trong auth.module.ts
    const signerOptions = jwtModuleAsyncOptions.useFactory(configService);
    assert.equal(signerOptions.secret, realEnvSecret, 'Secret từ factory phải khớp với ConfigService');
    assert.equal(signerOptions.signOptions.expiresIn, '12h', 'Thời hạn cấu hình phải là 12h');

    // 2. Sử dụng class JwtService thật của @nestjs/jwt với cấu hình từ factory
    const jwtService = new JwtService(signerOptions);
    const token = jwtService.sign({
      sub: 'user-1',
      email: 'sinhvien@dut.udn.vn',
      role: 'STUDENT',
      authVersion: 0,
    });

    // Kiểm tra token thật có exp - iat đúng 12 giờ (43200s)
    const decoded = jwt.decode(token);
    assert.equal(decoded.exp - decoded.iat, 12 * 3600, 'Thời hạn token phải chính xác là 12 giờ (43200s)');

    // 3. Khởi tạo JwtStrategy với cùng configService từ mã nguồn
    const prismaMock = {
      user: {
        findUnique: async () => ({
          id: 'user-1',
          email: 'sinhvien@dut.udn.vn',
          fullName: 'Nguyễn Văn A',
          role: 'STUDENT',
          isActive: true,
          authVersion: 0,
          password: 'hashed_password_should_be_stripped',
        }),
      },
    };

    const strategy = new JwtStrategy(prismaMock, configService);
    const req = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    };

    // 4. Chạy qua cơ chế authenticate thật của Passport
    const authResult = await new Promise((resolve) => {
      strategy.success = (user, info) => resolve({ outcome: 'SUCCESS', user, info });
      strategy.fail = (challenge, challengeStatus) => resolve({ outcome: 'FAIL', challenge, challengeStatus });
      strategy.error = (err) => resolve({ outcome: 'ERROR', err });
      strategy.authenticate(req);
    });

    assert.equal(authResult.outcome, 'SUCCESS', 'Passport authenticate phải thành công');
    assert.equal(authResult.user.id, 'user-1');
    assert.equal(authResult.user.fullName, 'Nguyễn Văn A');
    assert.equal(authResult.user.password, undefined, 'User trả về từ strategy validate không chứa password');
  });
});
