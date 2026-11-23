const { test } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node').register({ project: require('node:path').join(__dirname, '../tsconfig.json') });
const { EvidenceProcessingWorker } = require('../src/evidence/evidence-processing.worker');
process.env.AI_MODE = 'ASSIST';

// Unit doubles only: no API or database is contacted.
function fixture(change = {}) {
  const writes = [];
  const evidence = {
    version: 2, status: 'PROCESSING', term: { status: 'ACTIVE' },
    criterionAssessment: { criterion: { rubricVersionId: 'rubric' } },
    ...change.evidence,
  };
  const tx = {
    $queryRaw: async () => { writes.push('lock'); },
    evidence: { findUniqueOrThrow: async () => evidence },
    aiProcessingJob: {
      findUnique: async () => ({ status: change.jobStatus ?? 'PROCESSING' }),
      updateMany: async (args) => { writes.push(['job', args]); },
    },
    assessmentSubmission: { findUnique: async () => ({ status: change.submissionStatus ?? 'SUBMITTED' }) },
    assessmentHandoff: { findUnique: async () => ({ status: change.handoffStatus ?? 'WORKING' }) },
    aiPipelineRun: { update: async (args) => { writes.push(['run', args]); } },
    aiPipelineStep: { update: async (args) => { writes.push(['step', args]); } },
  };
  return {
    writes,
    check: () => new EvidenceProcessingWorker({}, {}).acceptResult(tx,
      { id: 'job', evidenceId: 'evidence', evidence: { studentId: 'student', termId: 'term' } },
      { id: 'run', inputVersion: 2, rubricVersionId: 'rubric' }, 'step'),
  };
}

test('current submitted evidence accepts AI while holding the term lock', async () => {
  const f = fixture();
  assert.equal(await f.check(), true);
  assert.deepEqual(f.writes, ['lock']);
});

test('a document with an OCR-detected student-code mismatch is automatically marked invalid', async () => {
  const writes = [];
  const evidence = {
    id: 'evidence',
    studentId: 'student',
    termId: 'term',
    version: 2,
    status: 'PROCESSING',
    declaredActivityName: 'DUT activity',
    description: null,
    declaredRole: 'PARTICIPANT',
    evidenceType: 'GIAY_XAC_NHAN',
    participationDate: new Date('2026-01-01'),
    files: [{ id: 'file', fileUrl: 'evidence/file.png', fileType: 'image/png' }],
    student: { id: 'student', fullName: 'Nguyen Van A', studentCode: '102210002' },
    term: { id: 'term', status: 'ACTIVE' },
    criterionAssessment: {
      criterion: { id: 'criterion', code: '1', name: 'Activity', maxScore: 4, scoringConfig: {}, rubricVersionId: 'rubric' },
    },
  };
  const run = { id: 'run', attempt: 1, inputVersion: 2, rubricVersionId: 'rubric', steps: [{ id: 'step' }] };
  const tx = {
    $queryRaw: async () => {},
    evidence: {
      findUniqueOrThrow: async () => evidence,
      update: async (args) => { writes.push(['evidence', args]); },
    },
    aiProcessingJob: {
      findUnique: async () => ({ status: 'PROCESSING', attempts: 1 }),
      update: async (args) => { writes.push(['job', args]); },
    },
    assessmentSubmission: { findUnique: async () => ({ status: 'SUBMITTED' }) },
    assessmentHandoff: { findUnique: async () => ({ status: 'WORKING' }) },
    ocrResult: { create: async (args) => { writes.push(['ocr', args]); } },
    verificationResult: { create: async (args) => { writes.push(['verification', args]); } },
    anomalyFlag: { create: async (args) => { writes.push(['anomaly', args]); } },
    notification: { create: async (args) => { writes.push(['notification', args]); } },
    aiSuggestion: { create: async (args) => { writes.push(['suggestion', args]); } },
    aiPipelineRun: { update: async (args) => { writes.push(['run', args]); } },
    aiPipelineStep: { update: async (args) => { writes.push(['step', args]); } },
  };
  const prisma = {
    aiProcessingJob: {
      findUnique: async (args) => args.include ? {
        id: 'job', attempts: 1, evidenceId: 'evidence', evidence,
      } : { status: 'PROCESSING' },
    },
    aiPipelineRun: { create: async () => run, findMany: async () => [] },
    assessmentSubmission: { findUnique: async () => ({ status: 'SUBMITTED' }) },
    criterion: { findMany: async () => [{ id: 'criterion', maxScore: 4 }] },
    $transaction: async (callback) => callback(tx),
  };
  const originalFetch = global.fetch;
  const originalPipelineUrl = process.env.AI_PIPELINE_URL;
  process.env.AI_PIPELINE_URL = 'http://ai-service.test';
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      suggestions: [{ criterionId: 'criterion', suggestedScore: 0, reasoning: 'MSSV mismatch', confidenceScore: 1 }],
      analysis: {
        schemaVersion: '1.0',
        aiConfidenceScore: 0,
        tier: 'RED',
        pipelineMode: 'DOCUMENT_PIPELINE',
        recommendation: 'MSSV không khớp hồ sơ',
        qualityCheck: { passed: true },
        faceVerification: {
          status: 'NOT_CHECKED', facesDetected: 0, matchedFaceBoundingBox: null,
          statusMessage: 'Đã tắt xử lý khuôn mặt theo cấu hình.',
        },
        documentChecks: [{ key: 'identity', status: 'FAIL', details: 'MSSV đọc được không khớp hồ sơ.', message_vi: 'MSSV đọc được không khớp hồ sơ.', score_delta: 0, evidence: {} }],
        scoreBreakdown: [],
        ocrExtraction: {
          available: true,
          studentCodeExtracted: '102210001',
          codeMatched: false,
          codeMismatch: true,
        },
      },
    }),
    text: async () => '',
  });

  try {
    const worker = new EvidenceProcessingWorker(prisma, { getFileUrl: async () => 'https://storage.test/file.png' });
    await worker.processClaimed('job');

    assert.equal(writes.find(([kind]) => kind === 'evidence')[1].data.status, 'INVALID');
    assert.equal(writes.find(([kind]) => kind === 'verification')[1].data.status, 'INVALID');
    assert.equal(writes.find(([kind]) => kind === 'verification')[1].data.evidenceGap.systemInvalidated, true);
    assert.equal(writes.find(([kind]) => kind === 'anomaly')[1].data.severity, 'HIGH');
    assert.equal(writes.find(([kind]) => kind === 'notification')[1].data.type, 'EVIDENCE_INVALID');
    assert.notEqual(writes.find(([kind]) => kind === 'evidence')[1].data.status, 'REJECTED');
    const runOutput = writes.find(([kind]) => kind === 'run')[1].data.output;
    assert.equal(runOutput.actorType, 'AI');
    assert.equal(runOutput.aiDecision, 'INVALID');
    assert.ok(runOutput.configVersion);
    assert.ok(runOutput.decisionReason);
    assert.deepEqual(runOutput.checkerResults, [{
      checker: 'identity', status: 'FAIL', score_delta: 0, evidence: {}, message_vi: 'MSSV đọc được không khớp hồ sơ.',
    }]);
    assert.equal(runOutput.faceVerification, null);
    assert.equal(JSON.stringify(writes).includes('embedding'), false);
    assert.equal(JSON.stringify(writes).includes('matchedFaceBoundingBox'), false);
    assert.equal(JSON.stringify(runOutput).includes('102210002'), false);
  } finally {
    global.fetch = originalFetch;
    if (originalPipelineUrl === undefined) delete process.env.AI_PIPELINE_URL;
    else process.env.AI_PIPELINE_URL = originalPipelineUrl;
  }
});

for (const [name, change] of [
  ['changed evidence version', { evidence: { version: 3 } }],
  ['changed rubric', { evidence: { criterionAssessment: { criterion: { rubricVersionId: 'other' } } } }],
  ['closed term', { evidence: { term: { status: 'CLOSED' } } }],
  ['upcoming term', { evidence: { term: { status: 'UPCOMING' } } }],
  ...['APPROVED', 'REJECTED', 'WITHDRAWN', 'NEEDS_SUPPLEMENT', 'APPEALING', 'DRAFT'].map(status => [status, { evidence: { status } }]),
  ...['SENT', 'EXCLUDED'].map(handoffStatus => [handoffStatus, { handoffStatus }]),
  ['returned submission', { submissionStatus: 'RETURNED' }],
  ['cancelled job', { jobStatus: 'CANCELLED' }],
]) {
  test(`late AI result is cancelled for ${name}`, async () => {
    const f = fixture(change);
    assert.equal(await f.check(), false);
    assert.equal(f.writes[0], 'lock');
    assert.deepEqual(f.writes.slice(1).map(([entity, args]) => [entity, args.data.status]),
      [['job', 'CANCELLED'], ['run', 'CANCELLED'], ['step', 'CANCELLED']]);
    assert.equal(f.writes[1][1].where.status, 'PROCESSING');
  });
}

// Drives one claimed job to its terminal outcome with in-memory doubles only (no DB, no AI service).
async function runClaimed({ attempts = 1, pipelineUrl = 'http://ai-service.test', fetchImpl, aiMode = 'ASSIST' } = {}) {
  const writes = [];
  const evidence = {
    id: 'evidence', studentId: 'student', termId: 'term', version: 2, status: 'PROCESSING',
    declaredActivityName: 'DUT activity', description: null, declaredRole: 'PARTICIPANT',
    evidenceType: 'GIAY_XAC_NHAN', participationDate: new Date('2026-01-01'),
    files: [{ id: 'file', fileUrl: 'evidence/file.png', fileType: 'image/png' }],
    student: { id: 'student', fullName: 'Nguyen Van A', studentCode: '102210001' },
    term: { id: 'term', status: 'ACTIVE' },
    criterionAssessment: {
      criterion: { id: 'criterion', code: '1', name: 'Activity', maxScore: 4, scoringConfig: {}, rubricVersionId: 'rubric' },
    },
  };
  const run = { id: 'run', attempt: attempts, inputVersion: 2, rubricVersionId: 'rubric', steps: [{ id: 'step' }] };
  const tx = {
    $queryRaw: async () => {},
    evidence: { findUniqueOrThrow: async () => evidence, update: async (args) => { writes.push(['evidence', args]); } },
    aiProcessingJob: {
      findUnique: async () => ({ status: 'PROCESSING', attempts }),
      update: async (args) => { writes.push(['job', args]); },
    },
    assessmentSubmission: { findUnique: async () => ({ status: 'SUBMITTED' }) },
    assessmentHandoff: { findUnique: async () => ({ status: 'WORKING' }) },
    ocrResult: { create: async (args) => { writes.push(['ocr', args]); } },
    verificationResult: { create: async (args) => { writes.push(['verification', args]); } },
    anomalyFlag: { create: async (args) => { writes.push(['anomaly', args]); } },
    notification: { create: async (args) => { writes.push(['notification', args]); } },
    aiSuggestion: { create: async (args) => { writes.push(['suggestion', args]); } },
    aiPipelineRun: { update: async (args) => { writes.push(['run', args]); } },
    aiPipelineStep: { update: async (args) => { writes.push(['step', args]); } },
  };
  const prisma = {
    aiProcessingJob: {
      findUnique: async (args) => args.include
        ? { id: 'job', attempts, evidenceId: 'evidence', evidence }
        : { status: 'PROCESSING', attempts },
    },
    aiPipelineRun: { create: async () => run, findMany: async () => [] },
    assessmentSubmission: { findUnique: async () => ({ status: 'SUBMITTED' }) },
    criterion: { findMany: async () => [{ id: 'criterion', maxScore: 4 }] },
    $transaction: async (callback) => callback(tx),
  };
  const worker = new EvidenceProcessingWorker(prisma, { getFileUrl: async () => 'https://storage.test/file.png' });
  const originalFetch = global.fetch;
  const originalPipelineUrl = process.env.AI_PIPELINE_URL;
  const originalAiMode = process.env.AI_MODE;
  process.env.AI_MODE = aiMode;
  process.env.AI_PIPELINE_URL = pipelineUrl;
  if (fetchImpl) global.fetch = fetchImpl;
  try {
    await worker.processClaimed('job');
    return { writes };
  } finally {
    global.fetch = originalFetch;
    if (originalAiMode === undefined) delete process.env.AI_MODE; else process.env.AI_MODE = originalAiMode;
    if (originalPipelineUrl === undefined) delete process.env.AI_PIPELINE_URL;
    else process.env.AI_PIPELINE_URL = originalPipelineUrl;
  }
}

test('AI_MODE OFF preserves the evidence and does not call the service', async () => {
  let called = false;
  const { writes } = await runClaimed({ aiMode: 'OFF', fetchImpl: async () => { called = true; throw new Error('must not call'); } });
  assert.equal(called, false);
  assert.deepEqual(writes, []);
});

test('AI_MODE SHADOW records run summary without touching evidence or reviewer artifacts', async () => {
  const payload = {
    suggestions: [{ criterionId: 'criterion', suggestedScore: 3, reasoning: 'Synthetic suggestion', confidenceScore: 0.8 }],
    analysis: {
      schemaVersion: '1.0', aiConfidenceScore: 80, pipelineMode: 'DOCUMENT_PIPELINE', tier: 'YELLOW_STRONG',
      recommendation: 'Cần cán bộ xem lại', scoreBreakdown: [{ component: 'quality', weight: 20, score: 20, source: 'qualityCheck', status: 'PASS' }],
      documentChecks: [{ key: 'quality', status: 'PASS', details: 'Đạt', message_vi: 'Đạt', score_delta: 20, evidence: {} }],
    },
  };
  const { writes } = await runClaimed({ aiMode: 'SHADOW', fetchImpl: async () => ({ ok: true, json: async () => payload }) });
  assert.deepEqual(writes.map(([kind]) => kind), ['job', 'run', 'step']);
  assert.equal(writes.some(([kind]) => ['evidence', 'ocr', 'verification', 'suggestion', 'notification', 'anomaly'].includes(kind)), false);
  assert.equal(writes.find(([kind]) => kind === 'run')[1].data.output.decision, 'REVIEW');
});

test('unknown AI schema version cannot be applied as a result', async () => {
  const { writes } = await runClaimed({ attempts: 3, fetchImpl: async () => ({ ok: true, json: async () => ({ suggestions: [], analysis: { schemaVersion: '99.0', documentChecks: [], scoreBreakdown: [] } }) }) });
  assert.equal(writes.find(([kind]) => kind === 'job')[1].data.status, 'FAILED');
  assert.equal(writes.find(([kind]) => kind === 'evidence')[1].data.status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(writes.some(([, args]) => args?.data?.status === 'REJECTED'), false);
});

test('missing checker contract fields cannot be applied as a result', async () => {
  const { writes } = await runClaimed({ attempts: 3, fetchImpl: async () => ({ ok: true, json: async () => ({ suggestions: [], analysis: { schemaVersion: '1.0', scoreBreakdown: [] } }) }) });
  assert.equal(writes.find(([kind]) => kind === 'job')[1].data.status, 'FAILED');
  assert.equal(writes.find(([kind]) => kind === 'evidence')[1].data.status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(writes.some(([, args]) => args?.data?.status === 'REJECTED'), false);
});

test('a transient AI pipeline HTTP failure is retried while attempts remain', async () => {
  const { writes } = await runClaimed({
    attempts: 1,
    fetchImpl: async () => ({ ok: false, status: 502, text: async () => 'bad gateway' }),
  });
  assert.equal(writes.find(([kind]) => kind === 'job')[1].data.status, 'QUEUED');
  assert.equal(writes.find(([kind]) => kind === 'run')[1].data.status, 'RETRYING');
  assert.equal(writes.some(([kind]) => kind === 'evidence'), false);
  assert.equal(writes.some(([, args]) => args?.data?.status === 'REJECTED'), false);
});

test('an AI pipeline HTTP failure after the retry cap fails the job and sends evidence to human review', async () => {
  const { writes } = await runClaimed({
    attempts: 3,
    fetchImpl: async () => ({ ok: false, status: 500, text: async () => 'server error' }),
  });
  assert.equal(writes.find(([kind]) => kind === 'job')[1].data.status, 'FAILED');
  assert.equal(writes.find(([kind]) => kind === 'run')[1].data.status, 'FAILED');
  assert.equal(writes.find(([kind]) => kind === 'evidence')[1].data.status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(writes.some(([, args]) => args?.data?.status === 'REJECTED'), false);
});

test('an AI request timeout at the retry cap sends evidence to review, never rejection', async () => {
  const { writes } = await runClaimed({ attempts: 3, fetchImpl: async () => { throw new Error('request timeout'); } });
  assert.equal(writes.find(([kind]) => kind === 'job')[1].data.status, 'FAILED');
  assert.equal(writes.find(([kind]) => kind === 'evidence')[1].data.status, 'NEEDS_HUMAN_REVIEW');
  assert.equal(writes.some(([, args]) => args?.data?.status === 'REJECTED'), false);
});

test('a missing AI pipeline URL routes evidence to human review without auto-approving', async () => {
  const { writes } = await runClaimed({ attempts: 1, pipelineUrl: '' });
  assert.equal(writes.find(([kind]) => kind === 'job')[1].data.status, 'UNAVAILABLE');
  assert.equal(writes.find(([kind]) => kind === 'run')[1].data.status, 'UNAVAILABLE');
  assert.equal(writes.find(([kind]) => kind === 'evidence')[1].data.status, 'NEEDS_HUMAN_REVIEW');
});
