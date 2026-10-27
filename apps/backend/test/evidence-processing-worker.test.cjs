const { test } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node').register({ project: require('node:path').join(__dirname, '../tsconfig.json') });
const { EvidenceProcessingWorker } = require('../src/evidence/evidence-processing.worker');

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
