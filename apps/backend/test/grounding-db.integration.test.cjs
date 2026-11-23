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
  const { lockTerm } = require('../src/evaluation-workflow/workflow-lock.helper');
  const { CriteriaService } = require('../src/criteria/criteria.service');
  const { WorkflowService } = require('../src/evaluation-workflow/workflow.service');
  const { DeadlineExtensionsService } = require('../src/deadline-extensions/deadline-extensions.service');
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
    const daysFromNow = days => new Date(now.getTime() + days * 86_400_000);
    const term = await prisma.term.create({ data: { code: `T${id}`, name: 'Test term', startDate: now, endDate: daysFromNow(1), submissionDeadline: daysFromNow(2), reviewDeadline: daysFromNow(3), appealDeadline: daysFromNow(4), status: 'REVIEWING', evidenceBasisWorkflowEnabled: true } });
    const rubric = await prisma.rubricVersion.create({ data: { termId: term.id, status: 'PUBLISHED' } });
    await prisma.assessmentHandoff.create({ data: { studentId: student.id, termId: term.id, rubricVersionId: rubric.id, classId: cls.id, facultyId: faculty.id } });
    const criterion = await prisma.criterion.create({ data: { rubricVersionId: rubric.id, code: '1', name: 'Test', description: 'Test', maxScore: 6, scoringConfig: { kind: 'attendance_penalty', requiredData: ['examBans', 'classWarnings'], baseScore: 6, examBanPenalty: 3, warningPenalty: 1 } } });
    const assessments = new AssessmentsService(prisma, {}, {});
    const service = new GroundingImportService(prisma, {}, {}, assessments);
    const actor = { id: staff.id, role: Role.STAFF, facultyId: faculty.id };
    const input = { termId: term.id, previewTermId: term.id, type: 'ACADEMIC', source: 'test.xlsx', validRows: [{ studentCode: student.studentCode, criterionCode: '1', data: { examBans: 0, classWarnings: 1 }, note: 'Ghi chú khác' }] };

    await t.test('BL-032: only open F15 terms accept preview or confirm', async () => {
      for (const [status, flag] of [['UPCOMING', true], ['CLOSED', true], ['REVIEWING', false]]) {
        await prisma.term.update({ where: { id: term.id }, data: { status, evidenceBasisWorkflowEnabled: flag } });
        const blocker = flag ? /đang mở hoặc đang thẩm định/ : /quy trình truyền thống/;
        await assert.rejects(service.preview(actor, { ...input, rows: input.validRows }), blocker);
        await assert.rejects(service.confirm(actor, input), blocker);
        assert.equal(await prisma.importBatch.count({ where: { termId: term.id } }), 0);
        assert.equal(await prisma.criterionAssessment.count({ where: { termId: term.id } }), 0);
      }
      await prisma.term.update({ where: { id: term.id }, data: { status: 'REVIEWING', evidenceBasisWorkflowEnabled: true } });
    });

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
    await prisma.$transaction(async tx => {
      await lockTerm(tx, term.id);
      await assessments.syncStudentGrounding(tx, student.id, term.id, rubric.id);
    });
    const manual = await prisma.criterionAssessment.findUniqueOrThrow({ where: { id: after.id } });
    assert.equal(manual.suggestedScore, 3);
    assert.equal(manual.academicGroundingId, null);

    await t.test('BL-030: sources for criteria 4 and 13 are review-only and revoke atomically', async () => {
      const deadlines = new DeadlineExtensionsService(prisma);
      const workflow = new WorkflowService(prisma, deadlines);
      const assessmentService = new AssessmentsService(prisma, workflow, deadlines);
      const termService = new CriteriaService(prisma, workflow);
      const category = await prisma.rubricCategory.create({ data: { rubricVersionId: rubric.id, code: 'CLUB', name: 'Nhóm CLB', maxScore: 8, position: 1 } });
      const club = await prisma.criterion.create({ data: {
        rubricVersionId: rubric.id, categoryId: category.id, code: '4', name: 'CLB', description: 'Fixture', maxScore: 3,
        scoringConfig: { kind: 'verified_boolean', requiredData: ['eligibleMembership'], passScore: 3 },
      } });
      const organizer = await prisma.criterion.create({ data: {
        rubricVersionId: rubric.id, categoryId: category.id, code: '13', name: 'BTC', description: 'Fixture', maxScore: 5,
        scoringConfig: { kind: 'verified_boolean', requiredData: ['organizerConfirmation'], passScore: 5 },
      } });
      const row = (criterionCode, organizationName) => ({ studentCode: student.studentCode, criterionCode, organizationName, roleTitle: 'Thành viên' });
      const confirm = rows => service.confirm(actor, { ...input, type: 'CLUB_LEADERSHIP', validRows: rows });
      const first = await confirm([row('4', 'CLB A'), row('13', 'BTC A')]);
      const second = await confirm([row('4', 'CLB B')]);
      const affected = await prisma.clubLeadershipGrounding.findMany({ where: { termId: term.id }, orderBy: { id: 'asc' } });
      const clubWhere = { studentId_termId_criterionId: { studentId: student.id, termId: term.id, criterionId: club.id } };
      const readClub = () => prisma.criterionAssessment.findUniqueOrThrow({ where: clubWhere });
      const before = await readClub();
      assert.deepEqual(before.clubGroundingIds, affected.filter(source => source.criterionCode === '4').map(source => source.id));
      assert.equal(before.verifiedData, null);
      assert.equal(before.suggestedScore, null);
      assert.equal(before.status, 'NEEDS_VERIFICATION');
      const staffSheet = await assessmentService.getStudentAssessments(actor, student.id, term.id);
      assert.deepEqual(staffSheet.categories[0].criteria.find(criterion => criterion.id === organizer.id).clubGroundings.map(source => source.organizationName), ['BTC A']);
      const studentSheet = await assessmentService.getMine(student.id, term.id);
      const studentClub = studentSheet.categories[0].criteria.find(criterion => criterion.id === club.id);
      assert.equal(studentClub.clubGroundings, undefined);
      assert.equal(studentClub.assessment.clubGroundingIds, undefined);
      await assert.rejects(termService.updateTerm(term.id, { evidenceBasisWorkflowEnabled: false }, staff.id), /lô căn cứ đang có hiệu lực/);

      const handoffWhere = { studentId_termId: { studentId: student.id, termId: term.id } };
      const revoke = () => service.revokeBatch(actor, first.batchId, 'Kiểm thử thu hồi CLB');
      for (const status of ['SENT', 'EXCLUDED']) {
        await prisma.assessmentHandoff.update({ where: handoffWhere, data: { status } });
        await assert.rejects(revoke, /phiếu đã khóa/);
      }
      await prisma.assessmentHandoff.update({ where: handoffWhere, data: { status: 'WORKING' } });
      const publication = await prisma.assessmentPublication.create({ data: {
        termId: term.id, studentId: student.id, rubricVersionId: rubric.id, revision: 1, snapshot: {}, publishedById: staff.id,
      } });
      await assert.rejects(revoke, /công bố/);
      await prisma.assessmentPublication.delete({ where: { id: publication.id } });

      await prisma.criterionAssessment.update({ where: clubWhere, data: { status: 'FINALIZED', officialScore: 3 } });
      await assert.rejects(revoke, /chốt điểm/);
      const againstFinalized = row('4', 'CLB không thể bổ sung sau chốt');
      const preview = await service.preview(actor, { ...input, type: 'CLUB_LEADERSHIP', rows: [againstFinalized] });
      assert.equal(preview.errorCount, 1);
      assert.match(preview.previewItems[0].reason, /tiêu chí đã chốt/);
      await assert.rejects(() => confirm([againstFinalized]), /Không có dòng dữ liệu nào hợp lệ/);
      assert.equal(await prisma.clubLeadershipGrounding.count({ where: { termId: term.id } }), affected.length);
      assert.equal((await prisma.importBatch.findUniqueOrThrow({ where: { id: first.batchId } })).status, 'ACTIVE');
      assert.equal(await prisma.clubLeadershipGrounding.count({ where: { batchId: first.batchId, status: 'ACTIVE' } }), 2);
      assert.equal(await prisma.auditLog.count({ where: { entityId: first.batchId, action: 'GROUNDING_BATCH_REVOKED' } }), 0);

      const manualData = { eligibleMembership: true };
      await prisma.criterionAssessment.update({ where: clubWhere, data: {
        status: 'READY_FOR_REVIEW', officialScore: null, verifiedData: manualData, verificationNote: 'Đã xác minh tay', suggestedScore: 3,
      } });
      await revoke();
      const after = await readClub();
      assert.deepEqual(after.clubGroundingIds, affected.filter(source => source.batchId === second.batchId).map(source => source.id));
      assert.deepEqual(after.verifiedData, manualData);
      assert.equal(after.suggestedScore, 3);
      assert.equal(after.verificationNote, 'Đã xác minh tay');
      const organizerAssessment = await prisma.criterionAssessment.findUniqueOrThrow({
        where: { studentId_termId_criterionId: { studentId: student.id, termId: term.id, criterionId: organizer.id } },
      });
      assert.deepEqual(organizerAssessment.clubGroundingIds, []);
      assert.equal(organizerAssessment.suggestedScore, null);
    });

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
