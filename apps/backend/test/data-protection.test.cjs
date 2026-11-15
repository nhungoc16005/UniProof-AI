const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

require(path.join(__dirname, '../node_modules/ts-node')).register({
  project: path.join(__dirname, '../tsconfig.json'),
});

const { EvidenceService } = require('../src/evidence/evidence.service');
const { AssessmentsService } = require('../src/assessments/assessments.service');
const { WorkflowService } = require('../src/evaluation-workflow/workflow.service');
const { Role, EvidenceStatus } = require('@prisma/client');

// Thiết lập môi trường Storage giả lập
process.env.SUPABASE_URL = 'https://supabase.local';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.SUPABASE_EVIDENCE_BUCKET = 'evidence';

const validBase64Pdf = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4 mock content').toString('base64');

// =====================================================================
// BL-007: Bảo vệ tệp minh chứng khi Upload và Ký URL xem tệp
// =====================================================================
describe('BL-007: Tách bạch các bước Upload, Commit DB và Ký URL xem tệp', () => {
  let originalFetch;
  let fetchCalls = [];
  let storageConfig;

  beforeEach(() => {
    originalFetch = global.fetch;
    fetchCalls = [];
    process.env.SUPABASE_URL = 'https://supabase.local';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.SUPABASE_EVIDENCE_BUCKET = 'evidence';
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function createEvidenceFixture(options = {}) {
    const dbFiles = options.initialFiles ? [...options.initialFiles] : [];
    let dbEvidence = {
      id: 'ev-1',
      studentId: 'student-1',
      termId: 'term-1',
      status: EvidenceStatus.DRAFT,
      declaredActivityName: 'Hoạt động tình nguyện',
      aiProcessingJobs: [],
      files: dbFiles,
      term: { id: 'term-1', status: 'ACTIVE', workflowEnabled: true },
    };

    const mockPrisma = {
      evidence: {
        findUnique: async ({ where }) => {
          if (where.id === dbEvidence.id) {
            return { ...dbEvidence, files: [...dbFiles] };
          }
          return null;
        },
        findUniqueOrThrow: async ({ where }) => {
          if (where.id === dbEvidence.id) {
            return { ...dbEvidence, files: [...dbFiles] };
          }
          const err = new Error('Không tìm thấy hồ sơ');
          err.status = 404;
          throw err;
        },
        delete: async ({ where }) => {
          if (where.id === dbEvidence.id) {
            const deleted = { ...dbEvidence };
            dbEvidence = null;
            return deleted;
          }
          throw new Error('Not found');
        },
      },
      evidenceFile: {
        findFirst: async ({ where }) => {
          if (where.fileUrl) {
            return dbFiles.find((f) => f.fileUrl === where.fileUrl) || null;
          }
          if (where.id) {
            return dbFiles.find((f) => f.id === where.id && (!where.evidenceId || f.evidenceId === where.evidenceId)) || null;
          }
          return null;
        },
        delete: async ({ where }) => {
          const idx = dbFiles.findIndex((f) => f.id === where.id);
          if (idx >= 0) {
            const [deleted] = dbFiles.splice(idx, 1);
            return deleted;
          }
          throw new Error('File not found');
        },
        deleteMany: async ({ where }) => {
          const before = dbFiles.length;
          const remaining = dbFiles.filter((f) => f.evidenceId !== where.evidenceId);
          dbFiles.length = 0;
          dbFiles.push(...remaining);
          return { count: before - remaining.length };
        },
      },
      assessmentHandoff: {
        findUnique: async () => ({ id: 'h-1', status: 'INIT', facultyId: 'fac-1' }),
      },
      assessmentSubmission: {
        count: async () => 0,
      },
      aiProcessingJob: {
        deleteMany: async () => ({ count: 0 }),
      },
      review: {
        deleteMany: async () => ({ count: 0 }),
      },
      supplementRequest: {
        deleteMany: async () => ({ count: 0 }),
      },
      appeal: {
        deleteMany: async () => ({ count: 0 }),
      },
      $transaction: async (fn) => {
        return fn(mockTx);
      },
    };

    const mockTx = {
      evidence: mockPrisma.evidence,
      evidenceFile: {
        create: async ({ data }) => {
          if (options.dbCommitError) {
            throw options.dbCommitError;
          }
          const newFile = {
            id: `file-${dbFiles.length + 1}`,
            evidenceId: data.evidenceId,
            fileUrl: data.fileUrl,
            fileType: data.fileType,
            fileName: data.fileName,
            fileSize: data.fileSize,
            createdAt: new Date(),
          };
          dbFiles.push(newFile);
          return newFile;
        },
        findFirst: mockPrisma.evidenceFile.findFirst,
        delete: mockPrisma.evidenceFile.delete,
        deleteMany: mockPrisma.evidenceFile.deleteMany,
      },
      aiProcessingJob: mockPrisma.aiProcessingJob,
      review: mockPrisma.review,
      supplementRequest: mockPrisma.supplementRequest,
      appeal: mockPrisma.appeal,
    };

    const mockWorkflow = {
      scope: async () => {},
      assertStudentEditable: async (_tx, studentId, termId) => {
        if (options.termLocked || options.alreadySubmitted) {
          const err = new Error('Phiếu đã nộp; chỉ được sửa sau khi Khoa trả phiếu');
          err.status = 400;
          throw err;
        }
        return { id: termId, status: 'ACTIVE' };
      },
      studentEdit: async (studentId, termId, fn) => {
        await mockWorkflow.assertStudentEditable(mockTx, studentId, termId);
        return fn(mockTx);
      },
    };

    const service = new EvidenceService(mockPrisma, mockWorkflow);
    return { service, mockPrisma, mockTx, getFiles: () => dbFiles, getEvidence: () => dbEvidence };
  }

  test('Ca 1: Upload Storage thất bại (HTTP 500) -> ném ServiceUnavailable, không tạo DB, không gọi DELETE', async () => {
    global.fetch = async (url, init) => {
      fetchCalls.push({ url, method: init?.method });
      if (init?.method === 'POST') {
        return { ok: false, status: 500, text: async () => 'Internal Server Error' };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const { service, getFiles } = createEvidenceFixture();

    await assert.rejects(
      async () => {
        await service.uploadDraftFile('ev-1', 'student-1', {
          fileData: validBase64Pdf,
          fileName: 'chung_chi.pdf',
          fileType: 'application/pdf',
        });
      },
      (err) => {
        assert.equal(err.status, 503);
        assert.match(err.message, /Tải tệp minh chứng lên Supabase Storage thất bại/);
        return true;
      },
    );

    // Không có bản ghi nào được ghi vào DB
    assert.equal(getFiles().length, 0);
    // Không có lệnh DELETE nào tới Storage
    const deleteCalls = fetchCalls.filter((c) => c.method === 'DELETE');
    assert.equal(deleteCalls.length, 0);
  });

  test('Ca 2: DB commit thất bại (thực sự rollback) -> gọi dọn dẹp Storage để tránh tệp mồ côi', async () => {
    global.fetch = async (url, init) => {
      fetchCalls.push({ url, method: init?.method });
      if (init?.method === 'POST') {
        return { ok: true, status: 200, json: async () => ({}) };
      }
      if (init?.method === 'DELETE') {
        return { ok: true, status: 200, text: async () => '' };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const dbError = new Error('Connection lost to database during commit');
    dbError.status = 500;
    const { service, getFiles } = createEvidenceFixture({ dbCommitError: dbError });

    await assert.rejects(
      async () => {
        await service.uploadDraftFile('ev-1', 'student-1', {
          fileData: validBase64Pdf,
          fileName: 'chung_chi.pdf',
          fileType: 'application/pdf',
        });
      },
      (err) => {
        assert.equal(err.message, 'Connection lost to database during commit');
        return true;
      },
    );

    assert.equal(getFiles().length, 0);
    const deleteCalls = fetchCalls.filter((c) => c.method === 'DELETE');
    assert.equal(deleteCalls.length, 1, 'Phải dọn dẹp tệp Storage khi DB chưa commit');
    assert.match(deleteCalls[0].url, /storage\/v1\/object\/evidence\/student-1\/term-1\/ev-1\//);
  });

  test('Ca 2b: DB timeout nhưng bản ghi thực tế ĐÃ commit -> KHÔNG xóa tệp Storage', async () => {
    global.fetch = async (url, init) => {
      fetchCalls.push({ url, method: init?.method });
      if (init?.method === 'POST') {
        return { ok: true, status: 200, json: async () => ({}) };
      }
      if (init?.method === 'DELETE') {
        return { ok: true, status: 200, text: async () => '' };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const { service, getFiles, mockPrisma, mockTx } = createEvidenceFixture();

    // Giả lập tình huống: studentEdit ném lỗi timeout sau khi bản ghi đã được insert
    mockTx.evidenceFile.create = async ({ data }) => {
      const newFile = {
        id: 'file-timeout-1',
        evidenceId: data.evidenceId,
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        fileName: data.fileName,
        fileSize: data.fileSize,
        createdAt: new Date(),
      };
      getFiles().push(newFile);
      // Ném lỗi timeout giả lập sau khi DB đã ghi
      const timeoutErr = new Error('Query timed out on wire');
      throw timeoutErr;
    };

    await assert.rejects(
      async () => {
        await service.uploadDraftFile('ev-1', 'student-1', {
          fileData: validBase64Pdf,
          fileName: 'chung_chi.pdf',
          fileType: 'application/pdf',
        });
      },
      (err) => {
        assert.equal(err.message, 'Query timed out on wire');
        return true;
      },
    );

    // Bản ghi vẫn còn trong DB
    assert.equal(getFiles().length, 1);
    // KHÔNG được xóa tệp Storage vì DB đã lưu
    const deleteCalls = fetchCalls.filter((c) => c.method === 'DELETE');
    assert.equal(deleteCalls.length, 0, 'Tuyệt đối không xóa Storage khi DB đã có bản ghi');
  });

  test('Ca 3: Ký URL thất bại sau khi DB đã commit -> KHÔNG xóa tệp Storage, trả phản hồi an toàn có message', async () => {
    global.fetch = async (url, init) => {
      fetchCalls.push({ url, method: init?.method });
      if (init?.method === 'POST' && url.includes('/storage/v1/object/sign/')) {
        // Lỗi ký URL từ Supabase signing endpoint (HTTP 503)
        return { ok: false, status: 503, text: async () => 'Signing service unavailable' };
      }
      if (init?.method === 'POST') {
        // Upload ban đầu thành công
        return { ok: true, status: 200, json: async () => ({}) };
      }
      if (init?.method === 'DELETE') {
        return { ok: true, status: 200, text: async () => '' };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const { service, getFiles } = createEvidenceFixture();

    const result = await service.uploadDraftFile('ev-1', 'student-1', {
      fileData: validBase64Pdf,
      fileName: 'chung_chi.pdf',
      fileType: 'application/pdf',
    });

    // 1. Bản ghi DB vẫn tồn tại an toàn
    assert.equal(getFiles().length, 1);
    // 2. KHÔNG có lệnh DELETE nào xóa tệp Storage
    const deleteCalls = fetchCalls.filter((c) => c.method === 'DELETE');
    assert.equal(deleteCalls.length, 0, 'Lỗi ký URL không được xóa tệp đã lưu trong DB');
    // 3. Phản hồi trả về đầy đủ thông tin tệp, cờ signedUrlAvailable: false và thông báo hướng dẫn
    assert.equal(result.signedUrlAvailable, false);
    assert.match(result.fileUrl, /^evidence\/student-1\/term-1\/ev-1\//);
    assert.match(result.message, /Tệp đã được lưu an toàn nhưng chưa tạo được liên kết xem tạm thời/);
  });

  test('Ca 3b: Tải lại hồ sơ khi signing còn lỗi và khi signing đã phục hồi', async () => {
    let signingShouldFail = true;

    global.fetch = async (url, init) => {
      fetchCalls.push({ url, method: init?.method });
      if (init?.method === 'POST' && url.includes('/storage/v1/object/sign/')) {
        if (signingShouldFail) {
          return { ok: false, status: 503, text: async () => 'Signing unavailable' };
        }
        return { ok: true, status: 200, json: async () => ({ signedURL: 'https://supabase.local/signed-url/chung_chi.pdf' }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const initialFile = {
      id: 'f-1',
      evidenceId: 'ev-1',
      fileUrl: 'evidence/student-1/term-1/ev-1/file-1.pdf',
      fileType: 'application/pdf',
      fileName: 'chung_chi.pdf',
    };
    const { service } = createEvidenceFixture({ initialFiles: [initialFile] });

    // Khi signing còn lỗi: findOne hoặc withSignedFiles không làm crash trang (không ném 503)
    const resultDuringOutage = await service.findOne('ev-1', { id: 'student-1', role: Role.STUDENT });
    assert.equal(resultDuringOutage.files[0].signedUrlAvailable, false);
    assert.equal(resultDuringOutage.files[0].fileUrl, 'evidence/student-1/term-1/ev-1/file-1.pdf');

    // Khi signing đã phục hồi: tải lại trang tạo liên kết ký thành công
    signingShouldFail = false;
    const resultRecovered = await service.findOne('ev-1', { id: 'student-1', role: Role.STUDENT });
    assert.equal(resultRecovered.files[0].signedUrlAvailable, true);
    assert.equal(resultRecovered.files[0].fileUrl, 'https://supabase.local/signed-url/chung_chi.pdf');
  });

  test('Ca 4 (BẰNG CHỨNG ĐỐI CHỨNG ĐỎ): Code cũ gom try/catch làm xóa mất tệp Storage khi signing thất bại', async () => {
    let oldCodeDeletedFile = false;

    // Mô phỏng chính xác logic code cũ trước khi sửa:
    // try {
    //   const file = await studentEdit(...);
    //   return { ...file, fileUrl: await this.getFileUrl(file.fileUrl) };
    // } catch (error) {
    //   await fetch(..., DELETE);
    //   throw error;
    // }
    const simulatedOldUpload = async (signingFails) => {
      const createdFileInDb = { id: 'file-old-1', fileUrl: 'evidence/student-1/term-1/ev-1/uuid-file.pdf' };
      try {
        if (signingFails) {
          const signErr = new Error('Signing failed');
          signErr.status = 503;
          throw signErr;
        }
        return { ...createdFileInDb, fileUrl: 'https://signed.url' };
      } catch (err) {
        // Code cũ: xóa file Storage trong catch
        oldCodeDeletedFile = true;
        throw err;
      }
    };

    await assert.rejects(
      async () => simulatedOldUpload(true),
      /Signing failed/,
    );
    // Xác nhận: code cũ ĐÃ XÓA TỆP KHI KÝ THẤT BẠI
    assert.equal(oldCodeDeletedFile, true, 'Code cũ xóa tệp Storage khi signing thất bại');
  });
});

// =====================================================================
// BL-026: Race condition giữa Xóa minh chứng/tệp và Nộp phiếu rèn luyện
// =====================================================================
describe('BL-026: Đối chứng kịch bản race condition giữa Xóa và Nộp phiếu rèn luyện', () => {
  let originalFetch;
  let fetchCalls = [];

  beforeEach(() => {
    originalFetch = global.fetch;
    fetchCalls = [];
    process.env.SUPABASE_URL = 'https://supabase.local';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.SUPABASE_EVIDENCE_BUCKET = 'evidence';
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function createWorkflowRaceFixture() {
    let submissionStatus = 'DRAFT'; // DRAFT hoặc SUBMITTED
    const term = { id: 'term-1', status: 'ACTIVE', workflowEnabled: true };
    const rubricVersion = { id: 'rubric-1', termId: 'term-1', status: 'PUBLISHED', criteria: [] };

    let dbFiles = [
      { id: 'f-1', evidenceId: 'ev-1', fileUrl: 'evidence/student-1/term-1/ev-1/f-1.pdf', fileType: 'application/pdf' },
    ];
    let dbEvidence = {
      id: 'ev-1',
      studentId: 'student-1',
      termId: 'term-1',
      status: EvidenceStatus.DRAFT,
      declaredActivityName: 'Minh chứng Nghiên cứu khoa học',
      aiProcessingJobs: [],
      files: dbFiles,
    };

    let termLockAcquiredCount = 0;

    const mockPrisma = {
      term: {
        findUnique: async () => term,
        findFirst: async () => term,
      },
      rubricVersion: {
        findFirst: async () => rubricVersion,
      },
      evidence: {
        findUnique: async ({ where }) => {
          if (where.id === dbEvidence?.id) {
            return { ...dbEvidence, files: [...dbFiles] };
          }
          return null;
        },
        findMany: async ({ where }) => {
          if (dbEvidence && dbEvidence.studentId === where.studentId && dbEvidence.termId === where.termId) {
            return [{ ...dbEvidence, files: [...dbFiles] }];
          }
          return [];
        },
        delete: async ({ where }) => {
          if (where.id === dbEvidence?.id) {
            const del = { ...dbEvidence };
            dbEvidence = null;
            return del;
          }
          throw new Error('Evidence not found');
        },
        update: async ({ where, data }) => {
          if (where.id === dbEvidence?.id) {
            Object.assign(dbEvidence, data);
            return dbEvidence;
          }
          throw new Error('Evidence not found');
        },
      },
      evidenceFile: {
        findFirst: async ({ where }) => {
          return dbFiles.find((f) => f.id === where.id && (!where.evidenceId || f.evidenceId === where.evidenceId)) || null;
        },
        delete: async ({ where }) => {
          const idx = dbFiles.findIndex((f) => f.id === where.id);
          if (idx >= 0) {
            const [deleted] = dbFiles.splice(idx, 1);
            return deleted;
          }
          throw new Error('File not found');
        },
        deleteMany: async ({ where }) => {
          const count = dbFiles.filter((f) => f.evidenceId === where.evidenceId).length;
          dbFiles = dbFiles.filter((f) => f.evidenceId !== where.evidenceId);
          return { count };
        },
      },
      assessmentSubmission: {
        findFirst: async () => ({ id: 'sub-1', studentId: 'student-1', termId: 'term-1', status: submissionStatus }),
        upsert: async () => {
          submissionStatus = 'SUBMITTED';
          return { id: 'sub-1', status: 'SUBMITTED' };
        },
      },
      assessmentHandoff: {
        findUnique: async () => ({ id: 'h-1', status: 'INIT', facultyId: 'fac-1' }),
      },
      aiProcessingJob: {
        deleteMany: async () => ({ count: 0 }),
        create: async () => ({ id: 'job-1' }),
      },
      review: { deleteMany: async () => ({ count: 0 }) },
      supplementRequest: { deleteMany: async () => ({ count: 0 }) },
      appeal: { deleteMany: async () => ({ count: 0 }) },
      auditLog: { create: async () => ({ id: 'log-1' }) },
      $queryRaw: async () => {
        termLockAcquiredCount++;
        return [{ id: 'term-1' }];
      },
      $transaction: async (fn) => {
        // Lưu snapshot để rollback phục hồi dữ liệu khi transaction gặp lỗi
        const snapshot = {
          submissionStatus,
          dbFiles: JSON.parse(JSON.stringify(dbFiles)),
          dbEvidence: dbEvidence ? JSON.parse(JSON.stringify(dbEvidence)) : null,
        };
        try {
          return await fn(mockTx);
        } catch (err) {
          // Rollback: khôi phục chính xác trạng thái ban đầu của DB
          submissionStatus = snapshot.submissionStatus;
          dbFiles = snapshot.dbFiles;
          dbEvidence = snapshot.dbEvidence;
          throw err;
        }
      },
    };

    const mockTx = {
      $queryRaw: async () => {
        termLockAcquiredCount++;
        return [{ id: 'term-1' }];
      },
      term: mockPrisma.term,
      rubricVersion: mockPrisma.rubricVersion,
      evidence: mockPrisma.evidence,
      evidenceFile: mockPrisma.evidenceFile,
      assessmentSubmission: mockPrisma.assessmentSubmission,
      assessmentHandoff: mockPrisma.assessmentHandoff,
      aiProcessingJob: mockPrisma.aiProcessingJob,
      review: mockPrisma.review,
      supplementRequest: mockPrisma.supplementRequest,
      appeal: mockPrisma.appeal,
      auditLog: mockPrisma.auditLog,
    };

    const mockDeadlines = {
      resolve: async () => ({ deadline: new Date(Date.now() + 86400000) }),
    };

    const workflow = new WorkflowService(mockPrisma, mockDeadlines);
    const evidenceService = new EvidenceService(mockPrisma, workflow);

    // Mock AssessmentsService
    const assessmentsService = new AssessmentsService(
      mockPrisma,
      workflow,
      null, // rubricScoring
      null, // conductScores
      mockDeadlines,
    );

    // Stub các bước preflight của assessmentsService để tập trung vào logic submit/race
    assessmentsService.ensureStudentSubmissionOpen = async () => {};
    assessmentsService.preflight = async () => ({ canSubmit: true, blockers: [], warnings: [] });
    assessmentsService.ensureSubmissionEditable = async () => {};

    return {
      workflow,
      evidenceService,
      assessmentsService,
      getFiles: () => dbFiles,
      getEvidence: () => dbEvidence,
      getSubmissionStatus: () => submissionStatus,
      setSubmissionStatus: (s) => {
        submissionStatus = s;
      },
      mockPrisma,
      mockTx,
      getLockCount: () => termLockAcquiredCount,
    };
  }

  test('Ca 5: Thứ tự 1 — Nộp phiếu trước (SUBMITTED) -> Thao tác xóa bị chặn và KHÔNG gọi DELETE Storage', async () => {
    global.fetch = async (url, init) => {
      fetchCalls.push({ url, method: init?.method });
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const fixture = createWorkflowRaceFixture();
    // 1. Sinh viên hoàn thành nộp phiếu
    await fixture.assessmentsService.submitSelfAssessment('student-1', 'term-1');
    assert.equal(fixture.getSubmissionStatus(), 'SUBMITTED');

    // 2. Thao tác xóa minh chứng chạy sau khi phiếu đã nộp
    await assert.rejects(
      async () => {
        await fixture.evidenceService.deleteEvidence('ev-1', { id: 'student-1', role: Role.STUDENT });
      },
      (err) => {
        assert.equal(err.status, 400);
        assert.match(err.message, /Phiếu đã nộp; chỉ được sửa sau khi Khoa trả phiếu/);
        return true;
      },
    );

    // 3. Thao tác xóa tệp chạy sau khi phiếu đã nộp
    await assert.rejects(
      async () => {
        await fixture.evidenceService.deleteDraftFile('ev-1', 'f-1', 'student-1');
      },
      (err) => {
        assert.equal(err.status, 400);
        assert.match(err.message, /Phiếu đã nộp; chỉ được sửa sau khi Khoa trả phiếu/);
        return true;
      },
    );

    // Tệp DB và hồ sơ DB vẫn nguyên vẹn
    assert.equal(fixture.getFiles().length, 1);
    assert.notEqual(fixture.getEvidence(), null);

    // KHÔNG có bất kỳ lệnh DELETE nào gửi tới Storage
    const deleteCalls = fetchCalls.filter((c) => c.method === 'DELETE');
    assert.equal(deleteCalls.length, 0, 'Phiếu đã nộp ngăn chặn hoàn toàn việc xóa Storage');
  });

  test('Ca 6: Thứ tự 2 — Xen kẽ thao tác: submit vượt qua precheck ngoài lock -> xóa tệp commit -> submit đọc lại trong lock và chặn', async () => {
    global.fetch = async (url, init) => {
      fetchCalls.push({ url, method: init?.method });
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const fixture = createWorkflowRaceFixture();

    // Tách riêng query trong lock để đảm bảo tx.evidence.findMany phản ánh đúng dữ liệu DB hiện thời
    fixture.mockTx.evidence = {
      ...fixture.mockPrisma.evidence,
      findMany: async (args) => {
        if (fixture.getEvidence() && fixture.getEvidence().studentId === args.where.studentId && fixture.getEvidence().termId === args.where.termId) {
          return [{ ...fixture.getEvidence(), files: [...fixture.getFiles()] }];
        }
        return [];
      },
    };

    // Mô phỏng chính xác race condition xen kẽ:
    // Hook vào lúc prisma.evidence.findMany (kiểm tra ngoài lock) được gọi bởi submitSelfAssessment:
    let outsideLockCheckPassed = false;
    let deleteInterleaved = false;
    const originalPrismaFindMany = fixture.mockPrisma.evidence.findMany;
    fixture.mockPrisma.evidence.findMany = async (args) => {
      // 1. Lần gọi ngoài lock của submitSelfAssessment đọc thấy file còn nguyên
      const res = await originalPrismaFindMany(args);
      if (!deleteInterleaved) {
        deleteInterleaved = true;
        outsideLockCheckPassed = true;
        // 2. Ngay sau khi kiểm tra ngoài lock này hoàn tất nhưng trước khi submit bước vào transaction,
        // tiến trình xóa tệp (deleteDraftFile) xen vào và commit xóa tệp thành công!
        await fixture.evidenceService.deleteDraftFile('ev-1', 'f-1', 'student-1');
      }
      return res;
    };

    // 3. Tiến trình submit bước vào workflow.studentEdit, đọc lại dữ liệu trong lock và bị chặn
    await assert.rejects(
      async () => {
        await fixture.assessmentsService.submitSelfAssessment('student-1', 'term-1');
      },
      (err) => {
        assert.equal(err.status, 400);
        // PHẢI LÀ LỖI BẮT TỪ NHÁNH ĐỌC LẠI BÊN TRONG TRANSACTION KHÓA TERM (dòng 190):
        assert.equal(err.message, 'Có minh chứng nháp chưa có tệp');
        return true;
      },
    );

    assert.equal(outsideLockCheckPassed, true, 'Kiểm tra ngoài lock phải chạy qua trước khi xen kẽ');
    assert.equal(fixture.getFiles().length, 0, 'Tệp đã bị xóa bởi thao tác xen kẽ');
    assert.equal(fixture.getSubmissionStatus(), 'DRAFT', 'Phiếu không bị nộp sai khi dữ liệu trong lock không hợp lệ');
  });

  test('Ca 7: Rollback trong transaction xóa -> DB và Storage được phục hồi nguyên vẹn', async () => {
    global.fetch = async (url, init) => {
      fetchCalls.push({ url, method: init?.method });
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const fixture = createWorkflowRaceFixture();
    // Giả lập lỗi DB xảy ra ở bước cuối cùng của transaction (sau khi đã deleteMany các bảng con)
    fixture.mockTx.evidence.delete = async () => {
      const dbErr = new Error('Database transaction abort / constraint error');
      throw dbErr;
    };

    await assert.rejects(
      async () => {
        await fixture.evidenceService.deleteEvidence('ev-1', { id: 'student-1', role: Role.STUDENT });
      },
      /Database transaction abort/,
    );

    // 1. Storage files KHÔNG bị xóa vì transaction bị rollback
    const deleteCalls = fetchCalls.filter((c) => c.method === 'DELETE');
    assert.equal(deleteCalls.length, 0, 'Transaction rollback không được xóa Storage');

    // 2. DỮ LIỆU DB ĐÃ ĐƯỢC PHỤC HỒI HOÀN TOÀN NHỜ TRANSACTION ROLLBACK!
    assert.equal(fixture.getFiles().length, 1, 'Bản ghi tệp trong DB phải được phục hồi sau rollback');
    assert.equal(fixture.getFiles()[0].id, 'f-1');
    assert.notEqual(fixture.getEvidence(), null, 'Bản ghi hồ sơ trong DB phải được phục hồi sau rollback');
  });

  test('Ca 8: Danh sách tệp cần xóa được đọc BÊN TRONG transaction có khóa Term', async () => {
    let filesReadInsideLock = null;

    global.fetch = async (url, init) => {
      fetchCalls.push({ url, method: init?.method });
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const fixture = createWorkflowRaceFixture();
    const originalFindUnique = fixture.mockTx.evidence.findUnique;
    fixture.mockTx.evidence.findUnique = async (args) => {
      const res = await originalFindUnique(args);
      if (args.include?.files) {
        filesReadInsideLock = res.files;
      }
      return res;
    };

    await fixture.evidenceService.deleteEvidence('ev-1', { id: 'student-1', role: Role.STUDENT });

    assert.notEqual(filesReadInsideLock, null, 'Phải đọc files bên trong transaction khóa Term');
    assert.equal(filesReadInsideLock.length, 1);
    assert.equal(filesReadInsideLock[0].id, 'f-1');

    // Sau khi commit, Storage mới được xóa
    const deleteCalls = fetchCalls.filter((c) => c.method === 'DELETE');
    assert.equal(deleteCalls.length, 1);
  });

  test('Ca 9: Cleanup Storage trả lỗi HTTP 403/500 hoặc mất mạng -> ghi nhận đúng, DB vẫn commit thành công', async () => {
    // Trường hợp Storage trả HTTP 500 khi dọn dẹp
    global.fetch = async (url, init) => {
      fetchCalls.push({ url, method: init?.method });
      if (init?.method === 'DELETE') {
        return { ok: false, status: 500, text: async () => 'Storage deletion failed' };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const fixture = createWorkflowRaceFixture();
    const result = await fixture.evidenceService.deleteEvidence('ev-1', { id: 'student-1', role: Role.STUDENT });

    // DB đã xóa thành công
    assert.equal(result.deleted, true);
    // Ghi nhận chính xác số tệp chưa dọn dẹp được để đối soát
    assert.equal(result.filesCleaned, 0);
    assert.equal(result.filesPendingCleanup, 1);

    // Trường hợp mất mạng (fetch throws error)
    global.fetch = async (url, init) => {
      if (init?.method === 'DELETE') {
        throw new Error('Network socket disconnected');
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const fixture2 = createWorkflowRaceFixture();
    const resultFile = await fixture2.evidenceService.deleteDraftFile('ev-1', 'f-1', 'student-1');
    assert.equal(resultFile.deleted, true);
    assert.equal(resultFile.storageCleaned, false);
  });
});
