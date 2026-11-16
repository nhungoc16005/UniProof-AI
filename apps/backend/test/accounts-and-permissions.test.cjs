const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require(path.join(__dirname, '../node_modules/ts-node')).register({
  project: path.join(__dirname, '../tsconfig.json'),
});

const { Role } = require('@prisma/client');

// ============================================================================
// TEST SUITE: ĐỢT 7 — BL-016, BL-025, BL-011, BL-012
// ============================================================================

describe('BL-016: Guard chặn API nghiệp vụ khi isFirstLogin = true', () => {
  const { JwtAuthGuard } = require('../src/common/guards/jwt-auth.guard');
  const { ALLOW_FIRST_LOGIN_KEY } = require('../src/common/decorators/allow-first-login.decorator');
  const { ForbiddenException } = require('@nestjs/common');

  function createMockExecutionContext({ user, allowFirstLogin = false }) {
    const handler = () => {};
    const controllerClass = class {};

    const reflector = {
      getAllAndOverride: (key, targets) => {
        if (key === ALLOW_FIRST_LOGIN_KEY) {
          return allowFirstLogin;
        }
        return false;
      },
    };

    const context = {
      getHandler: () => handler,
      getClass: () => controllerClass,
      switchToHttp: () => ({
        getRequest: () => ({
          user,
        }),
      }),
    };

    return { context, reflector };
  }

  const SuperGuard = Object.getPrototypeOf(JwtAuthGuard.prototype);
  SuperGuard.canActivate = async function () {
    return true;
  };

  test('Ca 1: user.isFirstLogin === true gọi endpoint nghiệp vụ thông thường -> Ném ForbiddenException FIRST_LOGIN_PASSWORD_CHANGE_REQUIRED', async () => {
    const { context, reflector } = createMockExecutionContext({
      user: { id: 'user-1', email: 'firstlogin@dut.udn.vn', role: 'STUDENT', isFirstLogin: true },
      allowFirstLogin: false,
    });

    const guard = new JwtAuthGuard(reflector);
    await assert.rejects(
      async () => guard.canActivate(context),
      (err) => {
        assert(err instanceof ForbiddenException);
        const res = err.getResponse();
        assert.equal(res.code, 'FIRST_LOGIN_PASSWORD_CHANGE_REQUIRED');
        return true;
      }
    );
  });

  test('Ca 2: user.isFirstLogin === true gọi endpoint có @AllowFirstLogin() (/auth/me, /auth/change-password, /auth/logout) -> Cho phép truy cập', async () => {
    const { context, reflector } = createMockExecutionContext({
      user: { id: 'user-1', email: 'firstlogin@dut.udn.vn', role: 'STUDENT', isFirstLogin: true },
      allowFirstLogin: true, // @AllowFirstLogin()
    });

    const guard = new JwtAuthGuard(reflector);
    const result = await guard.canActivate(context);
    assert.equal(result, true);
  });

  test('Ca 3: user.isFirstLogin === false gọi endpoint nghiệp vụ -> Cho phép truy cập bình thường', async () => {
    const { context, reflector } = createMockExecutionContext({
      user: { id: 'user-2', email: 'normal@dut.udn.vn', role: 'STUDENT', isFirstLogin: false },
      allowFirstLogin: false,
    });

    const guard = new JwtAuthGuard(reflector);
    const result = await guard.canActivate(context);
    assert.equal(result, true);
  });

  test('Ca 4: Guard không inject reflector (khởi tạo thủ công) -> vẫn chặn an toàn khi isFirstLogin = true', async () => {
    const { context } = createMockExecutionContext({
      user: { id: 'user-3', email: 'firstlogin2@dut.udn.vn', role: 'STUDENT', isFirstLogin: true },
      allowFirstLogin: false,
    });

    const guard = new JwtAuthGuard(); // Không truyền reflector
    await assert.rejects(
      async () => guard.canActivate(context),
      (err) => {
        assert(err instanceof ForbiddenException);
        const res = err.getResponse();
        assert.equal(res.code, 'FIRST_LOGIN_PASSWORD_CHANGE_REQUIRED');
        return true;
      }
    );
  });
});

describe('BL-025: Ràng buộc dữ liệu người dùng theo Role & Legacy handling', () => {
  const { UsersService } = require('../src/users/users.service');
  const { BadRequestException } = require('@nestjs/common');

  const adminActor = { id: 'admin-id', role: Role.ADMIN };

  function createMockPrisma() {
    return {
      user: {
        findUnique: async ({ where }) => {
          if (where.email === 'existing@dut.udn.vn') {
            return { id: 'u-exist', email: 'existing@dut.udn.vn' };
          }
          if (where.id === 'legacy-user-id') {
            return {
              id: 'legacy-user-id',
              email: 'legacy@dut.udn.vn',
              fullName: 'Legacy User',
              role: Role.STUDENT,
              studentCode: null, // Legacy thiếu MSSV
              classId: null,      // Legacy thiếu Lớp
              facultyId: null,
              isActive: true,
            };
          }
          return null;
        },
        findFirst: async () => null,
        create: async ({ data }) => ({ id: 'new-id', ...data }),
        update: async ({ where, data }) => ({ id: where.id, ...data }),
      },
      class: {
        findUnique: async ({ where }) => {
          if (where.id === 'class-it-1') {
            return { id: 'class-it-1', facultyId: 'faculty-it' };
          }
          if (where.id === 'class-ee-1') {
            return { id: 'class-ee-1', facultyId: 'faculty-ee' };
          }
          return null;
        },
      },
      faculty: {
        findUnique: async ({ where }) => {
          if (where.id === 'faculty-it' || where.id === 'faculty-ee') {
            return { id: where.id };
          }
          return null;
        },
      },
      $transaction: async (fn) => fn({
        user: {
          create: async ({ data }) => ({ id: 'new-id', ...data }),
          update: async ({ where, data }) => ({ id: where.id, ...data }),
        },
        auditLog: {
          create: async () => ({ id: 'audit-id' }),
        },
      }),
    };
  }

  test('Ca 1: Tạo STUDENT thiếu studentCode hoặc chứa toàn khoảng trắng -> Từ chối với BadRequestException', async () => {
    const service = new UsersService(createMockPrisma(), null);
    await assert.rejects(
      async () => {
        await service.create(
          {
            email: 'student1@dut.udn.vn',
            fullName: 'Nguyễn Văn A',
            role: Role.STUDENT,
            studentCode: '   ',
            classId: 'class-it-1',
          },
          'admin-id'
        );
      },
      (err) => {
        assert(err instanceof BadRequestException);
        assert(err.message.includes('Mã sinh viên'));
        return true;
      }
    );
  });

  test('Ca 2: Tạo STUDENT có classId nhưng lớp không thuộc facultyId được chọn -> Từ chối với BadRequestException', async () => {
    const service = new UsersService(createMockPrisma(), null);
    await assert.rejects(
      async () => {
        await service.create(
          {
            email: 'student2@dut.udn.vn',
            fullName: 'Nguyễn Văn B',
            role: Role.STUDENT,
            studentCode: '102210002',
            classId: 'class-it-1', // Thuộc Khoa IT
            facultyId: 'faculty-ee', // Cố tình chọn Khoa EE
          },
          'admin-id'
        );
      },
      (err) => {
        assert(err instanceof BadRequestException);
        assert(err.message.includes('không thuộc Khoa'));
        return true;
      }
    );
  });

  test('Ca 3: Tạo STAFF có studentCode hoặc classId -> Từ chối với BadRequestException', async () => {
    const service = new UsersService(createMockPrisma(), null);
    await assert.rejects(
      async () => {
        await service.create(
          {
            email: 'staff1@dut.udn.vn',
            fullName: 'Cán bộ Khoa',
            role: Role.STAFF,
            facultyId: 'faculty-it',
            studentCode: '102210003', // Cấm
          },
          'admin-id'
        );
      },
      (err) => {
        assert(err instanceof BadRequestException);
        assert(err.message.includes('Mã sinh viên') || err.message.includes('lớp sinh viên'));
        return true;
      }
    );
  });

  test('Ca 4: Tạo ADMIN cố tình gán facultyId hoặc classId -> Từ chối với BadRequestException', async () => {
    const service = new UsersService(createMockPrisma(), null);
    await assert.rejects(
      async () => {
        await service.create(
          {
            email: 'admin1@dut.udn.vn',
            fullName: 'Quản trị viên',
            role: Role.ADMIN,
            facultyId: 'faculty-it', // Cấm
          },
          'admin-id'
        );
      },
      (err) => {
        assert(err instanceof BadRequestException);
        assert(err.message.includes('Khoa riêng') || err.message.includes('lớp sinh viên'));
        return true;
      }
    );
  });

  test('Ca 5: Cập nhật STUDENT cố tình xóa studentCode bằng chuỗi rỗng -> Từ chối với BadRequestException', async () => {
    const service = new UsersService(createMockPrisma(), null);
    await assert.rejects(
      async () => {
        await service.update(
          'legacy-user-id',
          {
            studentCode: '   ',
          },
          adminActor
        );
      },
      (err) => {
        assert(err instanceof BadRequestException);
        assert(err.message.includes('Mã sinh viên'));
        return true;
      }
    );
  });

  test('Ca 6: Khóa tài khoản legacy (isActive: false) mà không thay đổi định danh -> Cho phép thành công', async () => {
    const service = new UsersService(createMockPrisma(), null);
    const updated = await service.update(
      'legacy-user-id',
      {
        isActive: false, // Chỉ khóa tài khoản, không sửa field khác
      },
      adminActor
    );
    assert.equal(updated.id, 'legacy-user-id');
    assert.equal(updated.isActive, false);
  });

  test('Ca 7: Cập nhật tài khoản legacy STUDENT thiếu studentCode nhưng chỉ sửa fullName -> Cho phép thành công', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.user.findUnique = async ({ where }) => {
      if (where.id === 'legacy-student-without-code') {
        return {
          id: 'legacy-student-without-code',
          email: 'legacy_nocode@dut.udn.vn',
          fullName: 'Tên Cũ',
          role: Role.STUDENT,
          studentCode: null, // Thiếu studentCode trong DB
          classId: 'class-it-1',
          isActive: true,
        };
      }
      return null;
    };
    const service = new UsersService(mockPrisma, null);
    const updated = await service.update(
      'legacy-student-without-code',
      {
        fullName: 'Tên Mới Được Cập Nhật',
      },
      adminActor
    );
    assert.equal(updated.fullName, 'Tên Mới Được Cập Nhật');
  });

  test('Ca 8: Sửa thông tin không liên quan của tài khoản legacy STUDENT thiếu cả lớp và MSSV mà KHÔNG truy vấn ID null', async () => {
    let queriedNullClassId = false;
    const mockPrisma = createMockPrisma();
    mockPrisma.user.findUnique = async ({ where }) => {
      if (where.id === 'legacy-student-noclass-nocode') {
        return {
          id: 'legacy-student-noclass-nocode',
          email: 'legacy_noclass@dut.udn.vn',
          fullName: 'Tên Cũ Không Lớp',
          role: Role.STUDENT,
          studentCode: null, // Legacy thiếu MSSV
          classId: null,      // Legacy thiếu Lớp
          facultyId: null,
          isActive: true,
        };
      }
      return null;
    };
    mockPrisma.class.findUnique = async ({ where }) => {
      if (where.id === null || where.id === undefined) {
        queriedNullClassId = true;
        throw new Error('Prisma Error: Argument id for where.id must not be null');
      }
      return null;
    };

    const service = new UsersService(mockPrisma, null);
    const updated = await service.update(
      'legacy-student-noclass-nocode',
      {
        fullName: 'Tên Mới Được Phép Cập Nhật',
      },
      adminActor
    );

    assert.equal(queriedNullClassId, false, 'Tuyệt đối không được truy vấn class với ID null');
    assert.equal(updated.fullName, 'Tên Mới Được Phép Cập Nhật');
  });

  test('Ca 9: Sửa thông tin không liên quan của tài khoản legacy STAFF thiếu Khoa mà KHÔNG truy vấn ID null', async () => {
    let queriedNullFacultyId = false;
    const mockPrisma = createMockPrisma();
    mockPrisma.user.findUnique = async ({ where }) => {
      if (where.id === 'legacy-staff-nofaculty') {
        return {
          id: 'legacy-staff-nofaculty',
          email: 'legacy_staff@dut.udn.vn',
          fullName: 'Cán Bộ Cũ Không Khoa',
          role: Role.STAFF,
          studentCode: null,
          classId: null,
          facultyId: null, // Legacy thiếu Khoa
          isActive: true,
        };
      }
      return null;
    };
    mockPrisma.faculty.findUnique = async ({ where }) => {
      if (where.id === null || where.id === undefined) {
        queriedNullFacultyId = true;
        throw new Error('Prisma Error: Argument id for where.id must not be null');
      }
      return null;
    };

    const service = new UsersService(mockPrisma, null);
    const updated = await service.update(
      'legacy-staff-nofaculty',
      {
        fullName: 'Cán Bộ Đã Đổi Tên',
      },
      adminActor
    );

    assert.equal(queriedNullFacultyId, false, 'Tuyệt đối không được truy vấn faculty với ID null');
    assert.equal(updated.fullName, 'Cán Bộ Đã Đổi Tên');
  });

  test('Ca 10: Bổ sung định danh (studentCode) cho tài khoản legacy STUDENT thiếu lớp -> Bắt buộc kiểm tra dữ liệu đầy đủ và từ chối vì thiếu classId', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.user.findUnique = async ({ where }) => {
      if (where.id === 'legacy-student-noclass') {
        return {
          id: 'legacy-student-noclass',
          email: 'legacy_noclass@dut.udn.vn',
          fullName: 'Sinh Viên Thiếu Lớp',
          role: Role.STUDENT,
          studentCode: null,
          classId: null, // Thiếu lớp
          isActive: true,
        };
      }
      return null;
    };

    const service = new UsersService(mockPrisma, null);
    await assert.rejects(
      async () => {
        await service.update(
          'legacy-student-noclass',
          {
            studentCode: '102210099', // Bổ sung MSSV
          },
          adminActor
        );
      },
      (err) => {
        assert(err instanceof BadRequestException);
        assert(err.message.includes('Lớp'), 'Khi bổ sung định danh, bắt buộc phải có đủ Lớp');
        return true;
      }
    );
  });

  test('Ca 11: Kích hoạt tài khoản legacy STUDENT (isActive: true) khi còn thiếu studentCode hoặc classId -> Bắt buộc kiểm tra dữ liệu đầy đủ và từ chối', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.user.findUnique = async ({ where }) => {
      if (where.id === 'legacy-student-inactive') {
        return {
          id: 'legacy-student-inactive',
          email: 'legacy_inactive@dut.udn.vn',
          fullName: 'Sinh Viên Đang Bị Khóa',
          role: Role.STUDENT,
          studentCode: null, // Thiếu MSSV
          classId: 'class-it-1',
          isActive: false,   // Đang bị khóa
        };
      }
      return null;
    };

    const service = new UsersService(mockPrisma, null);
    await assert.rejects(
      async () => {
        await service.update(
          'legacy-student-inactive',
          {
            isActive: true, // Kích hoạt tài khoản
          },
          adminActor
        );
      },
      (err) => {
        assert(err instanceof BadRequestException);
        assert(err.message.includes('Mã sinh viên'), 'Khi kích hoạt tài khoản, bắt buộc phải có đầy đủ định danh MSSV');
        return true;
      }
    );
  });

  test('Ca 12: Kích hoạt tài khoản legacy STAFF (isActive: true) khi còn thiếu facultyId -> Bắt buộc kiểm tra dữ liệu đầy đủ và từ chối', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.user.findUnique = async ({ where }) => {
      if (where.id === 'legacy-staff-inactive') {
        return {
          id: 'legacy-staff-inactive',
          email: 'legacy_staff_inactive@dut.udn.vn',
          fullName: 'Cán Bộ Đang Bị Khóa',
          role: Role.STAFF,
          studentCode: null,
          classId: null,
          facultyId: null, // Thiếu Khoa
          isActive: false,  // Đang bị khóa
        };
      }
      return null;
    };

    const service = new UsersService(mockPrisma, null);
    await assert.rejects(
      async () => {
        await service.update(
          'legacy-staff-inactive',
          {
            isActive: true, // Kích hoạt tài khoản
          },
          adminActor
        );
      },
      (err) => {
        assert(err instanceof BadRequestException);
        assert(err.message.includes('Khoa'), 'Khi kích hoạt tài khoản cán bộ, bắt buộc phải có đầy đủ Khoa');
        return true;
      }
    );
  });
});

describe('BL-011: Bàn giao mật khẩu tạm thời & An toàn bảo mật', () => {
  const { UsersService } = require('../src/users/users.service');

  function createMockPrisma() {
    return {
      user: {
        findUnique: async ({ where }) => {
          if (where.id === 'user-to-reset') {
            return {
              id: 'user-to-reset',
              email: 'resetme@dut.udn.vn',
              fullName: 'User Reset',
              role: Role.STUDENT,
              studentCode: '102210999',
              classId: 'class-it-1',
              facultyId: 'faculty-it',
            };
          }
          return null;
        },
        findFirst: async () => null,
        create: async ({ data }) => ({
          id: 'new-created-id',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        update: async ({ where, data }) => ({
          id: where.id,
          ...data,
          updatedAt: new Date(),
        }),
      },
      class: {
        findUnique: async () => ({ id: 'class-it-1', facultyId: 'faculty-it' }),
      },
      faculty: {
        findUnique: async () => ({ id: 'faculty-it' }),
      },
      auditLog: {
        create: async () => ({ id: 'audit-log-1' }),
      },
      $transaction: async (fn) => {
        const tx = {
          user: {
            create: async ({ data }) => ({
              id: 'new-created-id',
              ...data,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
            update: async ({ where, data }) => ({
              id: where.id,
              ...data,
              updatedAt: new Date(),
            }),
          },
          auditLog: {
            create: async () => ({ id: 'audit-log-1' }),
          },
        };
        return fn(tx);
      },
    };
  }

  test('Ca 1: Tạo user mới không truyền password -> Sinh temporaryPassword ngẫu nhiên, không lộ hash/authVersion trong user', async () => {
    const service = new UsersService(createMockPrisma(), null);
    const res = await service.create(
      {
        email: 'newstudent@dut.udn.vn',
        fullName: 'Sinh viên mới',
        role: Role.STUDENT,
        studentCode: '102210100',
        classId: 'class-it-1',
      },
      'admin-id'
    );

    assert(res.temporaryPassword, 'Phải sinh temporaryPassword');
    assert(res.temporaryPassword.length >= 10, 'Mật khẩu tạm thời phải đủ độ dài an toàn');
    assert.equal(res.user.email, 'newstudent@dut.udn.vn');
    assert.equal(res.user.password, undefined, 'Không được trả về password hash');
    assert.equal(res.user.authVersion, undefined, 'Không được trả về authVersion');
    assert.equal(res.user.isFirstLogin, true, 'isFirstLogin phải là true');
  });

  test('Ca 2: Tạo user mới có truyền password -> Không echo lại password, temporaryPassword là null', async () => {
    const service = new UsersService(createMockPrisma(), null);
    const res = await service.create(
      {
        email: 'custompass@dut.udn.vn',
        fullName: 'Sinh viên pass tự đặt',
        role: Role.STUDENT,
        studentCode: '102210101',
        classId: 'class-it-1',
        password: 'MySecretPassword123!',
      },
      'admin-id'
    );

    assert.equal(res.temporaryPassword, null, 'Không được sinh temporaryPassword khi người dùng tự đặt');
    assert.equal(res.user.password, undefined, 'Không được trả về password');
  });

  test('Ca 3: Reset password cho user -> Sinh temporaryPassword và set isFirstLogin = true', async () => {
    const service = new UsersService(createMockPrisma(), null);
    const res = await service.resetPassword('user-to-reset', 'admin-id');

    assert(res.temporaryPassword, 'Phải có temporaryPassword');
    assert.equal(res.user.email, 'resetme@dut.udn.vn');
    assert.equal(res.user.password, undefined);
  });

  test('Ca 4: Import tài khoản nếu transaction gặp lỗi (rollback) -> errorCount tăng, importedCount = 0 và không trả temporaryCredentials', async () => {
    const mockPrisma = createMockPrisma();
    mockPrisma.faculty = {
      findMany: async () => [{ id: 'faculty-it', code: 'CNTT', name: 'Khoa CNTT' }],
      findUnique: async () => ({ id: 'faculty-it', code: 'CNTT', name: 'Khoa CNTT' }),
    };
    mockPrisma.class = {
      findMany: async () => [{ id: 'class-it-1', code: '21TCLC_DT1', facultyId: 'faculty-it' }],
      findUnique: async () => ({ id: 'class-it-1', facultyId: 'faculty-it' }),
    };
    mockPrisma.$transaction = async () => {
      throw new Error('Database disk error / transaction aborted');
    };

    const service = new UsersService(mockPrisma, null);
    const result = await service.bulkImport(
      {
        users: [
          {
            email: 'failimport@dut.udn.vn',
            fullName: 'Thất bại Import',
            role: Role.STUDENT,
            studentCode: '102210888',
            classId: 'class-it-1',
          },
        ],
      },
      'admin-id'
    );

    assert.equal(result.importedCount, 0, 'importedCount phải bằng 0 khi rollback');
    assert.equal(result.errorCount, 1, 'errorCount phải bằng 1');
    assert.equal(result.temporaryCredentials.length, 0, 'temporaryCredentials phải rỗng');
    assert(result.errors[0].includes('Database disk error'));
  });
});

describe('BL-012: Chuẩn hóa quan hệ & Scope đơn vị Khoa trong findAll', () => {
  const { UsersService } = require('../src/users/users.service');

  const allUsers = [
    {
      id: 'u-1',
      email: 'sv_it@dut.udn.vn',
      fullName: 'SV Khoa CNTT',
      role: Role.STUDENT,
      studentCode: '102210001',
      classId: 'class-it-1',
      facultyId: null, // Chưa có scalar facultyId nhưng có relation
      class: { id: 'class-it-1', code: '21TCLC_DT1', facultyId: 'faculty-it', faculty: { id: 'faculty-it', name: 'CNTT' } },
      faculty: null,
      assessmentHandoffs: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'u-2',
      email: 'sv_ee@dut.udn.vn',
      fullName: 'SV Khoa Điện',
      role: Role.STUDENT,
      studentCode: '105210001',
      classId: 'class-ee-1',
      facultyId: 'faculty-ee',
      class: { id: 'class-ee-1', code: '21D1', facultyId: 'faculty-ee', faculty: { id: 'faculty-ee', name: 'Điện' } },
      faculty: { id: 'faculty-ee', name: 'Điện' },
      assessmentHandoffs: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'u-3',
      email: 'staff_it@dut.udn.vn',
      fullName: 'Cán bộ Khoa CNTT',
      role: Role.STAFF,
      studentCode: null,
      classId: null,
      facultyId: 'faculty-it',
      class: null,
      faculty: { id: 'faculty-it', name: 'CNTT' },
      assessmentHandoffs: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  function createMockPrisma() {
    return {
      user: {
        findMany: async ({ where }) => {
          return allUsers.filter((u) => {
            if (where?.role && u.role !== where.role) return false;
            if (where?.class?.facultyId && u.class?.facultyId !== where.class.facultyId) return false;
            return true;
          });
        },
        count: async ({ where }) => {
          return allUsers.filter((u) => {
            if (where?.role && u.role !== where.role) return false;
            if (where?.class?.facultyId && u.class?.facultyId !== where.class.facultyId) return false;
            return true;
          }).length;
        },
      },
    };
  }

  test('Ca 1: findAll trả về danh sách có đầy đủ classId, facultyId trực tiếp và quan hệ class với facultyId', async () => {
    const service = new UsersService(createMockPrisma(), null);
    const res = await service.findAll(
      { page: 1, pageSize: 10 },
      { id: 'admin-id', role: Role.ADMIN }
    );

    assert.equal(res.items.length, 3);
    const svIt = res.items.find((u) => u.id === 'u-1');
    assert.equal(svIt.facultyId, null, 'facultyId của sinh viên giữ nguyên giá trị gán trực tiếp trên User');
    assert.equal(svIt.classId, 'class-it-1');
    assert.equal(svIt.class.facultyId, 'faculty-it', 'Khoa của sinh viên được truy xuất qua class.facultyId');
  });

  test('Ca 2: Cán bộ Khoa CNTT (STAFF) chỉ xem được sinh viên thuộc Khoa CNTT', async () => {
    const service = new UsersService(createMockPrisma(), null);
    const res = await service.findAll(
      { page: 1, pageSize: 10 },
      { id: 'staff-it-id', role: Role.STAFF, facultyId: 'faculty-it' }
    );

    // STAFF bị ép where.role = STUDENT và where.class = { facultyId: 'faculty-it' }
    assert.equal(res.items.length, 1);
    assert.equal(res.items[0].id, 'u-1');
  });
});
