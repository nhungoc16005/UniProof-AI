const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  test('submission concurrency requires an isolated PostgreSQL test database', { skip: true }, () => {});
} else {
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || !parsed.pathname.endsWith('_test')) {
    throw new Error('Only a local database ending in _test is permitted');
  }
  process.env.DATABASE_URL = process.env.DIRECT_URL = url;
  require('ts-node').register({ project: path.join(__dirname, '../tsconfig.json') });
  require('reflect-metadata');
  const { PrismaClient } = require('@prisma/client');
  const { AssessmentsService } = require('../src/assessments/assessments.service');
  const { EvidenceService } = require('../src/evidence/evidence.service');
  const { WorkflowService } = require('../src/evaluation-workflow/workflow.service');
  const { DeadlineExtensionsService } = require('../src/deadline-extensions/deadline-extensions.service');

  const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
  };

  test('BL-026/027: submit and concurrent edits serialize on the PostgreSQL Term row', { timeout: 60_000 }, async t => {
    const observer = new PrismaClient();
    const left = new PrismaClient();
    const right = new PrismaClient();
    t.after(async () => Promise.all([observer.$disconnect(), left.$disconnect(), right.$disconnect()]));
    const services = db => {
      const deadlines = new DeadlineExtensionsService(db);
      const workflow = new WorkflowService(db, deadlines);
      return { db, workflow, assessment: new AssessmentsService(db, workflow, deadlines), evidence: new EvidenceService(db, workflow) };
    };
    const a = services(left);
    const b = services(right);
    const suffix = randomUUID().slice(0, 12);
    const faculty = await observer.faculty.create({ data: { code: 'F' + suffix, name: 'Test faculty' } });
    const cls = await observer.class.create({ data: { code: 'C' + suffix, name: 'Test class', cohort: 'Test', facultyId: faculty.id } });
    const student = await observer.user.create({ data: { email: suffix + '@test.invalid', role: 'STUDENT', fullName: 'Test student', classId: cls.id } });
    const fixtures = [];

    async function fixture(isF15, hasFile) {
      const now = new Date();
      const future = new Date(now.getTime() + 86_400_000);
      const term = await observer.term.create({ data: {
        code: 'RACE' + randomUUID().slice(0, 12), name: 'Race test', status: 'ACTIVE', startDate: now,
        endDate: future, submissionDeadline: future, reviewDeadline: future, appealDeadline: future, evidenceBasisWorkflowEnabled: isF15,
      } });
      fixtures.push(term.id);
      const rubric = await observer.rubricVersion.create({ data: {
        termId: term.id, status: 'PUBLISHED', categories: { create: { code: 'A', name: 'Nhóm A', maxScore: 10, position: 1 } },
      }, include: { categories: true } });
      await observer.assessmentHandoff.create({ data: { studentId: student.id, termId: term.id, rubricVersionId: rubric.id, classId: cls.id, facultyId: faculty.id } });
      const criteria = await Promise.all(['5', '6'].map(code => observer.criterion.create({ data: {
        rubricVersionId: rubric.id, categoryId: rubric.categories[0].id, code, name: 'Tiêu chí ' + code, description: 'Fixture', maxScore: 10,
      } })));
      const scores = await Promise.all(criteria.map(criterion => observer.criterionAssessment.create({ data: {
        studentId: student.id, termId: term.id, criterionId: criterion.id, selfScore: 5,
      } })));
      assert.deepEqual(scores[0].clubGroundingIds, []);
      const evidence = await observer.evidence.create({ data: {
        studentId: student.id, termId: term.id, status: 'DRAFT', evidenceType: 'TEST',
        description: 'Mô tả minh chứng đủ dài', declaredActivityName: 'Nháp kiểm thử',
        ...(hasFile ? { files: { create: {
          fileType: 'application/pdf', fileUrl: 'evidence/test-fixture.pdf', fileName: 'test-fixture.pdf', fileSize: 1,
        } } } : {}),
      }, include: { files: true } });
      return { term, scores, evidence };
    }

    async function blockedBy(pid) {
      const deadline = Date.now() + 7_000;
      while (Date.now() < deadline) {
        const [row] = await observer.$queryRaw`SELECT EXISTS (
          SELECT 1 FROM pg_stat_activity WHERE ${pid} = ANY(pg_blocking_pids(pid))
        ) AS blocked`;
        if (row.blocked) return;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      assert.fail('Second connection never waited on the PostgreSQL row lock');
    }

    async function interleave(first, second) {
      const held = deferred();
      const release = deferred();
      const original = a.workflow.studentEdit.bind(a.workflow);
      a.workflow.studentEdit = (studentId, termId, action) => original(studentId, termId, async tx => {
        const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
        held.resolve(pid);
        await release.promise;
        return action(tx);
      });
      const observe = promise => promise.then(value => ({ value }), error => ({ error }));
      const firstResult = observe(first());
      let secondResult;
      try {
        const outcome = await Promise.race([held.promise, firstResult]);
        if (typeof outcome !== 'number') throw outcome.error ?? new Error('First transaction completed without reaching the barrier');
        secondResult = observe(second());
        await blockedBy(outcome);
      } finally {
        release.resolve();
        a.workflow.studentEdit = original;
        await firstResult;
        await secondResult;
      }
      return [await firstResult, await secondResult];
    }

    const submit = (service, term) => service.assessment.submitSelfAssessment(student.id, term.id);
    const assertUnsubmitted = async ({ term, evidence }) => {
      assert.equal(await observer.assessmentSubmission.count({ where: { termId: term.id, status: 'SUBMITTED' } }), 0);
      assert.equal(await observer.auditLog.count({ where: { userId: student.id, action: 'ASSESSMENT_SUBMITTED', newValue: { path: ['rubricVersionId'], equals: (await observer.rubricVersion.findFirstOrThrow({ where: { termId: term.id } })).id } } }), 0);
      assert.equal((await observer.evidence.findUniqueOrThrow({ where: { id: evidence.id } })).status, 'DRAFT');
      assert.equal(await observer.aiProcessingJob.count({ where: { evidenceId: evidence.id } }), 0);
    };

    try {
      for (const [score, message] of [[null, /chưa tự đánh giá/], [8, /vượt trần/]]) {
        await t.test('BL-027: current score is checked after waiting, value=' + score, async () => {
          const data = await fixture(false, true);
          assert.equal((await b.assessment.preflight(student.id, data.term.id)).canSubmit, true);
          const [saved, submitted] = await interleave(
            () => a.assessment.saveSelfAssessment(student.id, data.term.id, data.scores[0].criterionId, { score }),
            () => submit(b, data.term),
          );
          assert.ifError(saved.error);
          assert.match(submitted.error?.message ?? '', message);
          await assertUnsubmitted(data);
        });
      }

      await t.test('BL-027: disabling F15 while submit waits blocks the old no-file draft', async () => {
        const data = await fixture(true, false);
        assert.equal((await b.assessment.preflight(student.id, data.term.id)).canSubmit, true);
        const [updated, submitted] = await interleave(
          () => a.workflow.studentEdit(student.id, data.term.id, tx => tx.term.update({
            where: { id: data.term.id }, data: { evidenceBasisWorkflowEnabled: false },
          })),
          () => submit(b, data.term),
        );
        assert.ifError(updated.error);
        assert.match(submitted.error?.message ?? '', /minh chứng nháp/);
        await assertUnsubmitted(data);
      });

      await t.test('BL-026: delete commits first, submit sees the missing file', async () => {
        const data = await fixture(false, true);
        const cleanups = [];
        a.evidence.cleanupStorageObject = async file => { cleanups.push(file); return { success: true }; };
        const [deleted, submitted] = await interleave(
          () => a.evidence.deleteDraftFile(data.evidence.id, data.evidence.files[0].id, student.id),
          () => submit(b, data.term),
        );
        assert.ifError(deleted.error);
        assert.match(submitted.error?.message ?? '', /minh chứng nháp/);
        assert.deepEqual(cleanups, ['evidence/test-fixture.pdf']);
        await assertUnsubmitted(data);
      });

      await t.test('BL-026: submit commits first, delete changes neither the dossier nor Storage', async () => {
        const data = await fixture(false, true);
        const cleanups = [];
        b.evidence.cleanupStorageObject = async file => { cleanups.push(file); return { success: true }; };
        const [submitted, deleted] = await interleave(
          () => submit(a, data.term),
          () => b.evidence.deleteEvidence(data.evidence.id, student),
        );
        assert.ifError(submitted.error);
        assert.match(deleted.error?.message ?? '', /Phiếu đã nộp/);
        assert.deepEqual(cleanups, []);
        assert.equal(await observer.assessmentSubmission.count({ where: { termId: data.term.id, status: 'SUBMITTED' } }), 1);
        assert.equal(await observer.evidenceFile.count({ where: { evidenceId: data.evidence.id } }), 1);
        assert.equal(await observer.aiProcessingJob.count({ where: { evidenceId: data.evidence.id } }), 1);
      });
    } finally {
      await observer.aiProcessingJob.updateMany({
        where: { status: 'QUEUED', evidence: { termId: { in: fixtures } } },
        data: { status: 'CANCELLED' },
      });
      await observer.term.updateMany({ where: { id: { in: fixtures } }, data: { status: 'CLOSED' } });
    }
  });
}
