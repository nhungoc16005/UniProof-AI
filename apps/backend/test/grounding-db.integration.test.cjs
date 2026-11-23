const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const url = process.env.TEST_DATABASE_URL;

if (!url) {
  test('grounding PostgreSQL integration requires an isolated test database', { skip: true }, () => {});
} else {
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || !parsed.pathname.slice(1).endsWith('_test')) {
    throw new Error('Only a local database ending in _test is permitted');
  }
  process.env.DATABASE_URL = process.env.DIRECT_URL = url;
  require(path.join(__dirname, '../node_modules/ts-node')).register({ project: path.join(__dirname, '../tsconfig.json') });
  require('reflect-metadata');
  const { PrismaClient, Role } = require('@prisma/client');
  const { GroundingImportService } = require('../src/grounding-import/grounding-import.service');
  const { AssessmentsService } = require('../src/assessments/assessments.service');

  test('concurrent import, provenance and revoke on PostgreSQL', async t => {
    const prisma = new PrismaClient();
    t.after(() => prisma.$disconnect());
    const id = randomUUID();
    const faculty = await prisma.faculty.create({ data: { code: `F${id}`, name: 'Test faculty' } });
    const cls = await prisma.class.create({ data: { code: `C${id}`, name: 'Test class', cohort: 'test', facultyId: faculty.id } });
    const staff = await prisma.user.create({ data: { email: `${id}-staff@test.invalid`, fullName: 'Test staff', role: Role.STAFF, facultyId: faculty.id } });
    const student = await prisma.user.create({ data: { email: `${id}-student@test.invalid`, fullName: 'Test student', role: Role.STUDENT, studentCode: `0${id}`, classId: cls.id } });
    const now = new Date();
    const term = await prisma.term.create({ data: { code: `T${id}`, name: 'Test term', startDate: now, endDate: now, submissionDeadline: now, reviewDeadline: now, appealDeadline: now, status: 'REVIEWING' } });
    const rubric = await prisma.rubricVersion.create({ data: { termId: term.id, status: 'PUBLISHED' } });
    await prisma.assessmentHandoff.create({ data: { studentId: student.id, termId: term.id, rubricVersionId: rubric.id, classId: cls.id, facultyId: faculty.id } });
    const criterion = await prisma.criterion.create({ data: { rubricVersionId: rubric.id, code: '1', name: 'Test', description: 'Test', maxScore: 6, scoringConfig: { kind: 'attendance_penalty', requiredData: ['examBans', 'classWarnings'], baseScore: 6, examBanPenalty: 3, warningPenalty: 1 } } });
    const assessments = new AssessmentsService(prisma, {}, {});
    const service = new GroundingImportService(prisma, {}, {}, assessments);
    const actor = { id: staff.id, role: Role.STAFF, facultyId: faculty.id };
    const input = { termId: term.id, previewTermId: term.id, type: 'ACADEMIC', source: 'test.xlsx', validRows: [{ studentCode: student.studentCode, criterionCode: '1', data: { examBans: 0, classWarnings: 1 }, note: 'Ghi chú khác' }] };

    const results = await Promise.allSettled([service.confirm(actor, { ...input, idempotencyKey: `${id}-1` }), service.confirm(actor, { ...input, idempotencyKey: `${id}-2` })]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(await prisma.academicGrounding.count({ where: { termId: term.id, studentId: student.id, status: 'ACTIVE' } }), 1);
    const imported = results.find(r => r.status === 'fulfilled').value;
    const preview = await service.preview(actor, { termId: term.id, type: 'ACADEMIC', source: 'test.xlsx', rows: input.validRows });
    assert.equal(preview.skippedCount, 1);
    const before = await prisma.criterionAssessment.findUniqueOrThrow({ where: { studentId_termId_criterionId: { studentId: student.id, termId: term.id, criterionId: criterion.id } } });
    assert.ok(before.academicGroundingId);
    assert.equal(before.suggestedScore, 5);
    await service.revokeBatch(actor, imported.batchId, 'Nhập nhầm dữ liệu');
    const after = await prisma.criterionAssessment.findUniqueOrThrow({ where: { studentId_termId_criterionId: { studentId: student.id, termId: term.id, criterionId: criterion.id } } });
    assert.equal(after.academicGroundingId, null);
    assert.equal(after.suggestedScore, null);
    assert.equal(after.status, 'NEEDS_VERIFICATION');
    await service.confirm(actor, { ...input, idempotencyKey: `${id}-3` });
    assert.equal(await prisma.academicGrounding.count({ where: { termId: term.id, studentId: student.id, status: 'ACTIVE' } }), 1);
    await prisma.criterionAssessment.update({ where: { id: after.id }, data: { verifiedData: { examBans: 1, classWarnings: 0 }, verificationNote: 'Cán bộ xác minh lại', academicGroundingId: null, suggestedScore: 3 } });
    await prisma.$transaction(tx => assessments.syncStudentGrounding(tx, student.id, term.id, rubric.id));
    const manual = await prisma.criterionAssessment.findUniqueOrThrow({ where: { id: after.id } });
    assert.equal(manual.suggestedScore, 3);
    assert.equal(manual.academicGroundingId, null);

    const activityCriterion = await prisma.criterion.create({ data: { rubricVersionId: rubric.id, code: '8', name: 'Hoạt động', description: 'Test', maxScore: 5, scoringConfig: { kind: 'activity_threshold', requiredData: ['verifiedActivityCount'], tiers: [{ min: 1, score: 5 }] } } });
    const activity = await prisma.activity.create({ data: { termId: term.id, facultyId: faculty.id, criterionId: activityCriterion.id, name: 'Test', organizer: 'Test', type: 'INTERNAL' } });
    const batch = await prisma.importBatch.create({ data: { termId: term.id, facultyId: faculty.id, type: 'ACTIVITY', source: 'test.xlsx', importedById: staff.id } });
    const participant = await prisma.activityParticipant.create({ data: { activityId: activity.id, studentId: student.id, batchId: batch.id, status: 'CONFIRMED', formRole: 'THAM_GIA_CHINH', confirmedById: staff.id, confirmedAt: new Date() } });
    await service.revokeBatch(actor, batch.id, 'Danh sách chưa chính xác');
    const revoked = await prisma.activityParticipant.findUniqueOrThrow({ where: { id: participant.id } });
    assert.equal(revoked.status, 'REVOKED');
    assert.equal(revoked.revokeReason, 'Danh sách chưa chính xác');
    assert.equal(revoked.confirmedById, staff.id);
    const newParticipant = await prisma.activityParticipant.create({ data: { activityId: activity.id, studentId: student.id, status: 'DRAFT' } });
    assert.notEqual(newParticipant.id, participant.id);
    await assert.rejects(prisma.activityParticipant.create({ data: { activityId: activity.id, studentId: student.id, status: 'DRAFT' } }), { code: 'P2002' });
  });
}
