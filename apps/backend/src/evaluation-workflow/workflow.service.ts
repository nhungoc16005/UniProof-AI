import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DeadlineExtensionType, Prisma, Role } from '@prisma/client';
import { WorkflowQueryDto } from './dto/workflow-query.dto';
import { classification, sendBlockers, sumCategory, unresolvedEvidenceStatuses } from './evaluation-policy';
export { classification } from './evaluation-policy';
import { PrismaService } from '../common/prisma/prisma.service';
import { DeadlineExtensionsService } from '../deadline-extensions/deadline-extensions.service';

export type WorkflowActor = { id: string; role: Role; facultyId?: string | null };
const unresolved = [...unresolvedEvidenceStatuses];

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService, private readonly deadlines: DeadlineExtensionsService) {}

  async lock(tx: Prisma.TransactionClient, termId: string) {
    await tx.$queryRaw`SELECT "id" FROM "Term" WHERE "id" = ${termId} FOR UPDATE`;
    const term = await tx.term.findUnique({ where: { id: termId } });
    if (!term) throw new NotFoundException('Không tìm thấy kỳ đánh giá');
    return term;
  }

  async scope(actor: WorkflowActor, studentId: string, termId?: string, db: Prisma.TransactionClient = this.prisma) {
    if (actor.role === Role.STUDENT) {
      if (actor.id !== studentId) throw new ForbiddenException('Không có quyền truy cập phiếu này');
      return;
    }
    if (actor.role === Role.ADMIN) return;
    if (actor.role !== Role.STAFF || !actor.facultyId) throw new ForbiddenException('Chưa được phân công Khoa');
    const term = termId ? await db.term.findUnique({ where: { id: termId } }) : null;
    const enrollment = termId ? await db.assessmentHandoff.findUnique({ where: { studentId_termId: { studentId, termId } } }) : null;
    if (term?.workflowEnabled && !enrollment) throw new ForbiddenException('Sinh viên không thuộc danh sách đánh giá của kỳ');
    const student = await db.user.findUnique({ where: { id: studentId }, include: { class: true } });
    if (!student || student.role !== Role.STUDENT) throw new NotFoundException('Không tìm thấy sinh viên');
    if (!actor.facultyId || actor.facultyId !== (enrollment?.facultyId ?? student.class?.facultyId)) throw new ForbiddenException('Sinh viên nằm ngoài Khoa phụ trách');
  }

  async evidenceScope(actor: WorkflowActor, termId?: string, classId?: string) {
    if (actor.role === Role.STUDENT) return { studentId: actor.id };
    if (actor.role === Role.ADMIN && !classId) return {};
    if (actor.role !== Role.ADMIN && (actor.role !== Role.STAFF || !actor.facultyId)) throw new ForbiddenException('Chưa được phân công Khoa');
    const [assigned, legacyTerms] = await Promise.all([
      this.prisma.assessmentHandoff.findMany({ where: { ...(actor.role === Role.STAFF ? { facultyId: actor.facultyId! } : {}), ...(termId ? { termId } : {}), ...(classId ? { classId } : {}) }, select: { studentId: true, termId: true } }),
      this.prisma.term.findMany({ where: { workflowEnabled: false, ...(termId ? { id: termId } : {}) }, select: { id: true } }),
    ]);
    return { OR: [
      ...assigned.map(row => ({ studentId: row.studentId, termId: row.termId })),
      { termId: { in: legacyTerms.map(t => t.id) }, student: { ...(actor.role === Role.STAFF ? { class: { facultyId: actor.facultyId! } } : {}), ...(classId ? { classId } : {}) } },
    ] };
  }

  async initialize(tx: Prisma.TransactionClient, termId: string) {
    const rubric = await tx.rubricVersion.findFirst({ where: { termId, status: 'PUBLISHED' }, orderBy: { version: 'desc' } });
    if (!rubric) throw new BadRequestException('Chưa ban hành bộ tiêu chí');
    const students = await tx.user.findMany({ where: { role: 'STUDENT', isActive: true, classId: { not: null } }, include: { class: true } });
    await tx.assessmentHandoff.createMany({ data: students.map(s => ({ studentId: s.id, termId, rubricVersionId: rubric.id, classId: s.classId!, facultyId: s.class!.facultyId })), skipDuplicates: true });
  }

  async assertEditable(tx: Prisma.TransactionClient, actor: WorkflowActor, studentId: string, termId: string) {
    const term = await this.lock(tx, termId);
    await this.scope(actor, studentId, termId, tx);
    if (term.status === 'CLOSED' || term.status === 'UPCOMING') throw new BadRequestException('Kỳ này chỉ được xem');
    if (term.workflowEnabled) {
      if (actor.role !== Role.STAFF) throw new ForbiddenException('Chỉ cán bộ Khoa được chấm; CTSV tiếp nhận và công bố kết quả');
      const handoff = await tx.assessmentHandoff.findUnique({ where: { studentId_termId: { studentId, termId } } });
      if (!handoff) throw new BadRequestException('Sinh viên chưa thuộc danh sách đánh giá của kỳ');
      if (handoff.status === 'SENT' || handoff.status === 'EXCLUDED') throw new BadRequestException('Phiếu đã gửi CTSV hoặc đã ghi nhận không nộp; cần được trả lại trước khi sửa');
    }
  }

  edit<T>(actor: WorkflowActor, studentId: string, termId: string, action: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(async tx => { await this.assertEditable(tx, actor, studentId, termId); return action(tx); }, { timeout: 20000 });
  }

  async assertStudentEditable(tx: Prisma.TransactionClient, studentId: string, termId: string) {
    const term = await this.lock(tx, termId);
    const submission = await tx.assessmentSubmission.findFirst({ where: { studentId, termId }, orderBy: { updatedAt: 'desc' } });
    const [submissionWindow, reviewWindow] = await Promise.all([
      this.deadlines.resolve(termId, studentId, DeadlineExtensionType.SUBMISSION, tx),
      this.deadlines.resolve(termId, studentId, DeadlineExtensionType.REVIEW, tx),
    ]);
    const returnedWindow = submission?.status === 'RETURNED' && ['ACTIVE', 'REVIEWING'].includes(term.status) && new Date() <= reviewWindow.deadline;
    if (!returnedWindow && (term.status !== 'ACTIVE' || new Date() > submissionWindow.deadline)) throw new BadRequestException('Kỳ không nhận chỉnh sửa hoặc đã hết hạn nộp/bổ sung phiếu');
    if (submission?.status === 'SUBMITTED') throw new BadRequestException('Phiếu đã nộp; chỉ được sửa sau khi Khoa trả phiếu');
    const handoff = await tx.assessmentHandoff.findUnique({ where: { studentId_termId: { studentId, termId } } });
    if (term.workflowEnabled && (!handoff || ['SENT', 'EXCLUDED'].includes(handoff.status))) throw new BadRequestException('Sinh viên chưa thuộc danh sách kỳ hoặc phiếu đã khóa');
    return term;
  }

  studentEdit<T>(studentId: string, termId: string, action: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(async tx => { await this.assertStudentEditable(tx, studentId, termId); return action(tx); }, { timeout: 20000 });
  }

  async snapshot(db: Prisma.TransactionClient, studentId: string, termId: string, rubricVersionId: string) {
    const rubric = await db.rubricVersion.findUniqueOrThrow({ where: { id: rubricVersionId }, include: { categories: { orderBy: { position: 'asc' }, include: { criteria: true } } } });
    const assessments = await db.criterionAssessment.findMany({ where: { studentId, termId, criterion: { rubricVersionId } } });
    const categories = rubric.categories.map(cat => {
      const criteria = cat.criteria.sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true })).map(c => ({ id: c.id, code: c.code, name: c.name, maxScore: c.maxScore, assessment: assessments.find(a => a.criterionId === c.id) ?? null }));
      return { key: cat.code, name: cat.name, maxScore: cat.maxScore, criteria, score: sumCategory(cat.maxScore, criteria.map(c => c.assessment?.status === 'FINALIZED' ? c.assessment.officialScore : null)) };
    });
    const complete = categories.length > 0 && categories.every(c => c.criteria.length > 0 && c.criteria.every(i => i.assessment?.status === 'FINALIZED' && i.assessment.officialScore !== null && !!i.assessment.verificationNote?.trim()));
    const totalScore = Math.min(100, categories.reduce((n, c) => n + c.score, 0));
    return { rubricVersionId, categories, totalScore, classification: classification(totalScore), complete };
  }

  async list(actor: WorkflowActor, termId: string, query: WorkflowQueryDto = new WorkflowQueryDto(), unpaged = false) {
    const { classId, facultyId, q, state } = query;
    if (actor.role === Role.STUDENT) throw new ForbiddenException();
    if (actor.role === Role.STAFF && facultyId && facultyId !== actor.facultyId) throw new ForbiddenException('Khoa nằm ngoài phạm vi phụ trách');
    if (actor.role === Role.STAFF && !actor.facultyId) throw new ForbiddenException('Chưa được phân công Khoa');
    const term = await this.prisma.term.findUnique({ where: { id: termId } });
    if (!term) throw new NotFoundException('Không tìm thấy kỳ');
    const where = { termId, ...(classId ? { classId } : {}), ...(actor.role === Role.STAFF ? { facultyId: actor.facultyId! } : facultyId ? { facultyId } : {}) };
    let rows = await this.prisma.assessmentHandoff.findMany({ where, select: { id: true, studentId: true, termId: true, rubricVersionId: true, classId: true, facultyId: true, status: true, sentById: true, sentAt: true, returnReason: true, notSubmittedReason: true, exclusionReason: true, excludedAt: true, revision: true, createdAt: true, updatedAt: true }, orderBy: [{ createdAt: 'asc' }, { studentId: 'asc' }] });
    if (!term.workflowEnabled) {
      const rubric = await this.prisma.rubricVersion.findFirst({ where: { termId, status: 'PUBLISHED' }, orderBy: { version: 'desc' } });
      const history = await Promise.all([
        this.prisma.criterionAssessment.findMany({ where: { termId }, select: { studentId: true }, distinct: ['studentId'] }),
        this.prisma.assessmentSubmission.findMany({ where: { termId }, select: { studentId: true }, distinct: ['studentId'] }),
        this.prisma.evidence.findMany({ where: { termId }, select: { studentId: true }, distinct: ['studentId'] }),
      ]);
      const historicalIds = [...new Set(history.flat().map(row => row.studentId))];
      const legacy = await this.prisma.user.findMany({ where: { id: { in: historicalIds }, role: 'STUDENT', ...(classId ? { classId } : {}), ...((actor.role === Role.STAFF ? actor.facultyId : facultyId) ? { class: { facultyId: actor.role === Role.STAFF ? actor.facultyId! : facultyId } } : {}) }, include: { class: true }, orderBy: { studentCode: 'asc' } });
      rows = legacy.filter(u => u.class).map(u => ({ id: u.id, studentId: u.id, termId, rubricVersionId: rubric?.id ?? '', classId: u.classId!, facultyId: u.class!.facultyId, status: 'WORKING' as const, sentById: null, sentAt: null, returnReason: null, notSubmittedReason: null, exclusionReason: null, excludedAt: null, snapshot: null, revision: 0, createdAt: u.createdAt, updatedAt: u.updatedAt }));
    }
    const ids = rows.map(r => r.studentId);
    const scoped = { termId, studentId: { in: ids } };
    const [submissions, assessments, appeals, publications, evidences] = await Promise.all([
      this.prisma.assessmentSubmission.findMany({ where: scoped }),
      this.prisma.criterionAssessment.findMany({ where: scoped, select: { studentId: true, status: true, criterionId: true, officialScore: true, verificationNote: true } }),
      this.prisma.appeal.findMany({ where: { ...scoped, status: 'PENDING' }, select: { studentId: true } }),
      this.prisma.assessmentPublication.findMany({ where: scoped, select: { studentId: true, revision: true, publishedAt: true }, orderBy: { revision: 'desc' } }),
      this.prisma.evidence.findMany({ where: { ...scoped, status: { in: unresolved as any } }, select: { studentId: true } }),
    ]);
    const [users, classes, faculties, criteria] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, studentCode: true, fullName: true } }),
      this.prisma.class.findMany({ where: { id: { in: [...new Set(rows.map(r => r.classId))] } } }), this.prisma.faculty.findMany({ where: { id: { in: [...new Set(rows.map(r => r.facultyId))] } } }),
      this.prisma.criterion.findMany({ where: { rubricVersionId: { in: [...new Set(rows.map(r => r.rubricVersionId))] } }, select: { id: true, rubricVersionId: true } }),
    ]);
    const usersById = new Map(users.map(u => [u.id, u]));
    const classesById = new Map(classes.map(c => [c.id, c]));
    const facultiesById = new Map(faculties.map(f => [f.id, f]));
    const submissionByKey = new Map(submissions.map(s => [`${s.studentId}:${s.rubricVersionId}`, s]));
    const criteriaByRubric = new Map<string, Set<string>>();
    for (const criterion of criteria) {
      if (!criteriaByRubric.has(criterion.rubricVersionId!)) criteriaByRubric.set(criterion.rubricVersionId!, new Set());
      criteriaByRubric.get(criterion.rubricVersionId!)!.add(criterion.id);
    }
    const finalizedByStudent = new Map<string, Set<string>>();
    for (const a of assessments) if (a.status === 'FINALIZED' && a.officialScore !== null && a.verificationNote?.trim()) {
      if (!finalizedByStudent.has(a.studentId)) finalizedByStudent.set(a.studentId, new Set());
      finalizedByStudent.get(a.studentId)!.add(a.criterionId);
    }
    const countByStudent = (values: Array<{ studentId: string }>) => { const counts = new Map<string,number>(); for (const v of values) counts.set(v.studentId,(counts.get(v.studentId) ?? 0)+1); return counts; };
    const evidenceCounts = countByStudent(evidences);
    const appealCounts = countByStudent(appeals);
    const publicationByStudent = new Map<string, typeof publications[number]>();
    for (const p of publications) if (!publicationByStudent.has(p.studentId)) publicationByStudent.set(p.studentId,p);
    const items = rows.map(row => {
      const submission = submissionByKey.get(`${row.studentId}:${row.rubricVersionId}`);
      const targetCriteria = [...(criteriaByRubric.get(row.rubricVersionId) ?? [])];
      const finalized = targetCriteria.filter(id => finalizedByStudent.get(row.studentId)?.has(id)).length;
      const pendingEvidence = evidenceCounts.get(row.studentId) ?? 0;
      const publication = publicationByStudent.get(row.studentId);
      const pendingAppeals = appealCounts.get(row.studentId) ?? 0;
      const blockers = sendBlockers(submission?.status === 'SUBMITTED', targetCriteria.length > 0 && finalized === targetCriteria.length, pendingEvidence, pendingAppeals);
      const ready = !blockers.length && !['SENT', 'EXCLUDED'].includes(row.status) && ['ACTIVE', 'REVIEWING'].includes(term.status) && term.workflowEnabled;
      const state = row.status === 'EXCLUDED' ? 'NOT_SUBMITTED_RECORDED' : row.status === 'SENT' ? publication?.revision === row.revision ? 'PUBLISHED' : 'SENT' : row.status === 'RETURNED' ? 'FACULTY_RETURNED' : submission?.status === 'RETURNED' ? 'STUDENT_RETURNED' : submission?.status !== 'SUBMITTED' ? 'NOT_SUBMITTED' : ready ? 'READY' : 'REVIEWING';
      return { ...row, snapshot: undefined, student: usersById.get(row.studentId), class: classesById.get(row.classId), faculty: facultiesById.get(row.facultyId), submissionStatus: submission?.status ?? 'DRAFT', finalizedCriteria: finalized, totalCriteria: targetCriteria.length, pendingEvidence, pendingAppeals, ready, blockers, state, publication: publication ? { revision: publication.revision, publishedAt: publication.publishedAt } : null };
    });
    const filtered = items.filter(r => (!state || (state === 'APPEALS' ? r.pendingAppeals > 0 : state === 'SENT' ? ['SENT', 'PUBLISHED'].includes(r.state) : state === 'RETURNED' ? ['FACULTY_RETURNED', 'STUDENT_RETURNED'].includes(r.state) : r.state === state)) && (!q || `${r.student?.fullName} ${r.student?.studentCode}`.toLocaleLowerCase('vi').includes(q.trim().toLocaleLowerCase('vi'))));
    const count = (states: string[]) => filtered.filter(i => states.includes(i.state)).length;
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(query.pageSize) || 25));
    const summary = { total: filtered.length, notSubmitted: count(['NOT_SUBMITTED']), reviewing: count(['REVIEWING']), returned: count(['FACULTY_RETURNED', 'STUDENT_RETURNED']), ready: count(['READY']), sent: count(['SENT', 'PUBLISHED']), published: count(['PUBLISHED']), recordedNotSubmitted: count(['NOT_SUBMITTED_RECORDED']), pendingAppeals: filtered.reduce((n, i) => n + i.pendingAppeals, 0) };
    const facultyProgress = [...new Set(filtered.map(r => r.facultyId))].map(id => {
      const group = filtered.filter(r => r.facultyId === id);
      return { id, name: group[0]?.faculty?.name, total: group.length, sent: group.filter(r => ['SENT', 'PUBLISHED'].includes(r.state)).length, published: group.filter(r => r.state === 'PUBLISHED').length, pendingAppeals: group.reduce((n,r) => n + r.pendingAppeals, 0) };
    });
    return { term, items: unpaged ? filtered : filtered.slice((page - 1) * pageSize, page * pageSize), summary, facultyProgress, filters: { classes, faculties }, total: filtered.length, page, pageSize, updatedAt: new Date().toISOString() };
  }

  async conditions(actor: WorkflowActor, termId: string, db: Prisma.TransactionClient = this.prisma) {
    if (actor.role !== Role.ADMIN) throw new ForbiddenException();
    const term = await db.term.findUniqueOrThrow({ where: { id: termId } });
    const [rows, publications, pending] = await Promise.all([
      db.assessmentHandoff.findMany({ where: { termId } }),
      db.assessmentPublication.findMany({ where: { termId }, select: { studentId: true, revision: true } }),
      db.appeal.count({ where: { termId, status: 'PENDING' } }),
    ]);
    const common = [!term.workflowEnabled && 'Kỳ lịch sử chỉ được tra cứu', !rows.length && 'Chưa có danh sách đánh giá', rows.some(r => !['SENT', 'EXCLUDED'].includes(r.status)) && 'Còn phiếu chưa gửi hoặc chưa ghi nhận không nộp', pending > 0 && `${pending} phúc khảo chờ xử lý`].filter(Boolean) as string[];
    const publishBlockers = [...common, ...(!['ACTIVE', 'REVIEWING'].includes(term.status) ? ['Trạng thái kỳ không cho phép công bố'] : []), ...(new Date() > term.appealDeadline ? ['Cần gia hạn phúc khảo trước khi công bố'] : []), ...(rows.some(r => r.status === 'SENT' && !r.snapshot) ? ['Thiếu bản kết quả Khoa'] : [])];
    const closeBlockers = [...common, ...(term.status !== 'REVIEWING' ? ['Cần công bố tạm trước khi chốt'] : []), ...(new Date() <= term.appealDeadline ? ['Chưa hết hạn phúc khảo'] : []), ...(rows.some(r => r.status === 'SENT' && !publications.some(p => p.studentId === r.studentId && p.revision === r.revision)) ? ['Còn phiên bản kết quả chưa công bố'] : [])];
    return { canPublish: !publishBlockers.length, canClose: !closeBlockers.length, publishBlockers, closeBlockers };
  }

  async export(actor: WorkflowActor, termId: string, query: WorkflowQueryDto) {
    const data = await this.list(actor, termId, query, true);
    return { ...data, source: 'WORKFLOW', filtersApplied: query };
  }


  async history(actor: WorkflowActor, studentId: string, termId: string) {
    await this.scope(actor, studentId, termId);
    const assessments = await this.prisma.criterionAssessment.findMany({ where: { studentId, termId }, select: { id: true } });
    const evidence = await this.prisma.evidence.findMany({ where: { studentId, termId }, select: { id: true } });
    const submissions = await this.prisma.assessmentSubmission.findMany({ where: { studentId, termId }, select: { id: true } });
    const handoff = await this.prisma.assessmentHandoff.findUnique({ where: { studentId_termId: { studentId, termId } } });
    return this.prisma.auditLog.findMany({ where: { OR: [{ entityId: { in: [...assessments, ...evidence, ...submissions].map(a => a.id).concat(handoff ? [handoff.id] : []) } }, { AND: [{ newValue: { path: ['studentId'], equals: studentId } }, { newValue: { path: ['termId'], equals: termId } }] }] }, include: { user: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async send(actor: WorkflowActor, termId: string, studentIds: string[]) {
    if (actor.role !== Role.STAFF || !studentIds.length || studentIds.length > 100) throw new BadRequestException('Chọn 1–100 phiếu để gửi');
    return this.prisma.$transaction(async tx => {
      const term = await this.lock(tx, termId);
      if (!term.workflowEnabled || !['ACTIVE', 'REVIEWING'].includes(term.status)) throw new BadRequestException('Kỳ không nhận kết quả Khoa');
      let sent = 0;
      for (const studentId of [...new Set(studentIds)]) {
        await this.scope(actor, studentId, termId, tx);
        const row = await tx.assessmentHandoff.findUnique({ where: { studentId_termId: { studentId, termId } } });
        if (!row) throw new BadRequestException('Sinh viên không thuộc danh sách kỳ');
        if (row.status === 'SENT') continue;
        if (row.status === 'EXCLUDED') throw new BadRequestException('Sinh viên đã được ghi nhận không nộp');
        const sub = await tx.assessmentSubmission.findFirst({ where: { studentId, termId, rubricVersionId: row.rubricVersionId, status: 'SUBMITTED' } });
        const snapshot = await this.snapshot(tx, studentId, termId, row.rubricVersionId);
        const pendingEvidence = await tx.evidence.count({ where: { studentId, termId, status: { in: unresolved as any } } });
        const pendingAppeals = await tx.appeal.count({ where: { studentId, termId, status: 'PENDING' } });
        const blockers = sendBlockers(!!sub, snapshot.complete, pendingEvidence, pendingAppeals);
        if (blockers.length) throw new BadRequestException({ message: blockers.join('; '), blockers, studentId });
        await tx.assessmentHandoff.update({ where: { id: row.id }, data: { status: 'SENT', revision: { increment: 1 }, snapshot: JSON.parse(JSON.stringify(snapshot)), sentAt: new Date(), sentById: actor.id, returnReason: null } });
        await tx.publicationCorrectionRequest.updateMany({ where: { handoffId: row.id, status: 'OPEN' }, data: { status: 'FACULTY_RESUBMITTED' } });
        sent++;
        await this.audit(tx, actor.id, 'FACULTY_RESULT_SENT', row.id, { studentId, termId, revision: row.revision + 1 });
      }
      return { sent };
    }, { timeout: 30000 });
  }

  async returnResult(actor: WorkflowActor, studentId: string, termId: string, reason: string) {
    if (actor.role !== Role.ADMIN || !reason?.trim()) throw new BadRequestException('CTSV phải ghi lý do trả kết quả');
    return this.prisma.$transaction(async tx => {
      const term = await this.lock(tx, termId);
      if (term.status === 'CLOSED') throw new BadRequestException('Kỳ đã chốt');
      const row = await tx.assessmentHandoff.findUniqueOrThrow({ where: { studentId_termId: { studentId, termId } } });
      if (row.status !== 'SENT') throw new BadRequestException('Khoa chưa gửi phiếu này');
      const result = await tx.assessmentHandoff.update({ where: { id: row.id }, data: { status: 'RETURNED', returnReason: reason.trim() } });
      await this.audit(tx, actor.id, 'CTSV_RESULT_RETURNED', row.id, { studentId, termId, reason: reason.trim() });
      const staffIds = (await tx.user.findMany({ where: { role: 'STAFF', facultyId: row.facultyId, isActive: true }, select: { id: true } })).map(user => user.id);
      if (staffIds.length) await tx.notification.createMany({ data: staffIds.map(userId => ({ userId, type: 'FACULTY_RESULT_RETURNED', eventKey: 'FACULTY_RESULT_RETURNED', dedupeKey: `handoff-return:${row.id}:${row.revision}:${userId}`, title: 'CTSV đã trả kết quả về Khoa', content: reason.trim(), targetPath: `/officer/students/${studentId}/assessment?termId=${termId}`, metadata: { studentId, termId } })) });
      return result;
    });
  }

  async recordNotSubmitted(actor: WorkflowActor, studentId: string, termId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Cần ghi lý do không nộp phiếu');
    return this.edit(actor, studentId, termId, async tx => {
      const term = await tx.term.findUniqueOrThrow({ where: { id: termId } });
      const effective = await this.deadlines.resolve(termId, studentId, DeadlineExtensionType.SUBMISSION, tx);
      if (new Date() <= effective.deadline) throw new BadRequestException('Chưa hết hạn nộp phiếu');
      if (await tx.assessmentSubmission.count({ where: { studentId, termId, status: { in: ['SUBMITTED', 'RETURNED'] } } })) throw new BadRequestException('Sinh viên đã có phiếu; phải xử lý phiếu hiện có');
      const row = await tx.assessmentHandoff.update({ where: { studentId_termId: { studentId, termId } }, data: { status: 'EXCLUDED', notSubmittedReason: reason.trim() } });
      await this.audit(tx, actor.id, 'NON_SUBMISSION_RECORDED', row.id, { studentId, termId, reason: reason.trim() });
      return row;
    });
  }

  async publication(studentId: string, termId: string) {
    return this.prisma.assessmentPublication.findFirst({ where: { studentId, termId }, orderBy: { revision: 'desc' } });
  }

  async requestCorrection(actor: WorkflowActor, studentId: string, termId: string, reason: string) {
    if (actor.role !== Role.ADMIN || !reason?.trim()) throw new BadRequestException('CTSV phải ghi lý do điều chỉnh');
    return this.prisma.$transaction(async tx => {
      const term = await this.lock(tx, termId);
      if (term.status === 'CLOSED') throw new BadRequestException('Kỳ đã chốt, không thể mở điều chỉnh');
      const handoff = await tx.assessmentHandoff.findUniqueOrThrow({ where: { studentId_termId: { studentId, termId } } });
      const publication = await tx.assessmentPublication.findFirst({ where: { studentId, termId }, orderBy: { revision: 'desc' } });
      if (!publication) throw new BadRequestException('Sinh viên chưa có kết quả công bố');
      if (await tx.publicationCorrectionRequest.count({ where: { handoffId: handoff.id, status: { in: ['OPEN', 'FACULTY_RESUBMITTED'] } } })) throw new BadRequestException('Đang có yêu cầu điều chỉnh chưa hoàn tất');
      const request = await tx.publicationCorrectionRequest.create({ data: { termId, handoffId: handoff.id, sourcePublicationId: publication.id, sourceRevision: publication.revision, reason: reason.trim(), requestedById: actor.id } });
      await tx.assessmentHandoff.update({ where: { id: handoff.id }, data: { status: 'RETURNED', returnReason: `Điều chỉnh sau công bố: ${reason.trim()}` } });
      const staffIds = (await tx.user.findMany({ where: { role: 'STAFF', facultyId: handoff.facultyId, isActive: true }, select: { id: true } })).map(user => user.id);
      if (staffIds.length) await tx.notification.createMany({ data: staffIds.map(userId => ({ userId, type: 'PUBLICATION_CORRECTION_REQUESTED', eventKey: 'PUBLICATION_CORRECTION_REQUESTED', dedupeKey: `correction:${request.id}:${userId}`, title: 'CTSV yêu cầu điều chỉnh kết quả', content: reason.trim(), targetPath: `/officer/students/${studentId}/assessment?termId=${termId}`, metadata: { requestId: request.id, studentId, termId, sourceRevision: publication.revision } })) });
      await this.audit(tx, actor.id, 'PUBLICATION_CORRECTION_REQUESTED', request.id, { studentId, termId, sourceRevision: publication.revision, reason: reason.trim() });
      return request;
    });
  }

  async corrections(actor: WorkflowActor, termId: string) {
    const where: Prisma.PublicationCorrectionRequestWhereInput = { termId };
    if (actor.role === Role.STAFF) {
      if (!actor.facultyId) throw new ForbiddenException('Chưa được phân công Khoa');
      where.handoff = { facultyId: actor.facultyId };
    }
    return this.prisma.publicationCorrectionRequest.findMany({ where, include: { handoff: { include: { student: { select: { id: true, fullName: true, studentCode: true } }, class: { select: { code: true } } } }, sourcePublication: { select: { revision: true, publishedAt: true } }, requestedBy: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async exclude(actor: WorkflowActor, studentId: string, termId: string, reason: string) {
    if (actor.role !== Role.ADMIN || !reason?.trim()) throw new BadRequestException('Cần ghi lý do loại trừ');
    return this.prisma.$transaction(async tx => {
      const term = await this.lock(tx, termId);
      if (term.status === 'CLOSED') throw new BadRequestException('Kỳ đã chốt');
      if (await tx.assessmentPublication.count({ where: { studentId, termId } })) throw new BadRequestException('Kết quả đã công bố; hãy dùng quy trình điều chỉnh');
      const row = await tx.assessmentHandoff.findUniqueOrThrow({ where: { studentId_termId: { studentId, termId } } });
      const updated = await tx.assessmentHandoff.update({ where: { id: row.id }, data: { status: 'EXCLUDED', exclusionReason: reason.trim(), excludedById: actor.id, excludedAt: new Date() } });
      await tx.notification.create({ data: { userId: studentId, type: 'ASSESSMENT_EXCLUDED', eventKey: 'ASSESSMENT_EXCLUDED', dedupeKey: `excluded:${row.id}:${row.revision}`, title: 'Cập nhật danh sách đánh giá', content: reason.trim(), targetPath: '/student', metadata: { termId } } });
      await this.audit(tx, actor.id, 'ASSESSMENT_EXCLUDED', row.id, { studentId, termId, reason: reason.trim() });
      return updated;
    });
  }

  async restoreExcluded(actor: WorkflowActor, studentId: string, termId: string) {
    if (actor.role !== Role.ADMIN) throw new ForbiddenException();
    return this.prisma.$transaction(async tx => {
      const term = await this.lock(tx, termId);
      if (term.status === 'CLOSED') throw new BadRequestException('Kỳ đã chốt');
      const row = await tx.assessmentHandoff.findUniqueOrThrow({ where: { studentId_termId: { studentId, termId } } });
      if (row.status !== 'EXCLUDED' || !row.exclusionReason) throw new BadRequestException('Sinh viên không thuộc trường hợp loại trừ có thể khôi phục');
      const updated = await tx.assessmentHandoff.update({ where: { id: row.id }, data: { status: 'WORKING', exclusionReason: null, excludedById: null, excludedAt: null } });
      await this.audit(tx, actor.id, 'ASSESSMENT_EXCLUSION_RESTORED', row.id, { studentId, termId });
      return updated;
    });
  }

  async publish(actor: WorkflowActor, termId: string) {
    if (actor.role !== Role.ADMIN) throw new ForbiddenException();
    return this.prisma.$transaction(async tx => {
      const term = await this.lock(tx, termId);
      const conditions = await this.conditions(actor, termId, tx);
      if (!conditions.canPublish) throw new BadRequestException({ message: conditions.publishBlockers.join('; '), blockers: conditions.publishBlockers });
      if (new Date() > term.appealDeadline) throw new BadRequestException('Cần gia hạn phúc khảo trước khi công bố');
      const rows = await tx.assessmentHandoff.findMany({ where: { termId } });
      if (!rows.length || rows.some(r => !['SENT', 'EXCLUDED'].includes(r.status))) throw new BadRequestException('Còn phiếu chưa được Khoa gửi hoặc chưa ghi nhận không nộp');
      if (await tx.appeal.count({ where: { termId, status: 'PENDING' } })) throw new BadRequestException('Còn phúc khảo chờ xử lý');
      let published = 0;
      for (const row of rows.filter(r => r.status === 'SENT')) {
        const existing = await tx.assessmentPublication.findUnique({ where: { studentId_termId_revision: { studentId: row.studentId, termId, revision: row.revision } } });
        if (existing) continue;
        if (!row.snapshot) throw new BadRequestException('Thiếu bản kết quả Khoa');
        await tx.assessmentPublication.create({ data: { studentId: row.studentId, termId, rubricVersionId: row.rubricVersionId, revision: row.revision, snapshot: row.snapshot, publishedById: actor.id } });
        await tx.publicationCorrectionRequest.updateMany({ where: { handoffId: row.id, status: 'FACULTY_RESUBMITTED' }, data: { status: 'REPUBLISHED', resultingRevision: row.revision } });
        await tx.notification.create({ data: { userId: row.studentId, type: 'RESULT_PUBLISHED', eventKey: 'RESULT_PUBLISHED', dedupeKey: `publication:${row.studentId}:${termId}:${row.revision}`, title: 'Đã công bố tạm kết quả rèn luyện', content: `${term.name}: xem kết quả và gửi phúc khảo trước ${term.appealDeadline.toLocaleString('vi-VN')}.`, targetPath: `/student/scores?termId=${termId}`, metadata: { termId, revision: row.revision } } });
        published++;
      }
      await tx.term.update({ where: { id: termId }, data: { status: 'REVIEWING' } });
      await this.audit(tx, actor.id, 'PROVISIONAL_RESULTS_PUBLISHED', termId, { termId, count: published });
      return { published };
    }, { timeout: 30000 });
  }

  async close(actor: WorkflowActor, termId: string) {
    if (actor.role !== Role.ADMIN) throw new ForbiddenException();
    return this.prisma.$transaction(async tx => {
      const term = await this.lock(tx, termId);
      if (term.status === 'CLOSED') return term;
      const conditions = await this.conditions(actor, termId, tx);
      if (!conditions.canClose) throw new BadRequestException({ message: conditions.closeBlockers.join('; '), blockers: conditions.closeBlockers });
      if (term.status !== 'REVIEWING' || new Date() <= term.appealDeadline) throw new BadRequestException('Chỉ chốt sau công bố tạm và hết hạn phúc khảo');
      const rows = await tx.assessmentHandoff.findMany({ where: { termId } });
      const publications = await tx.assessmentPublication.findMany({ where: { termId } });
      if (!rows.length || rows.some(r => r.status !== 'EXCLUDED' && (r.status !== 'SENT' || !publications.some(p => p.studentId === r.studentId && p.revision === r.revision)))) throw new BadRequestException('Còn phiếu chưa công bố phiên bản mới nhất');
      if (await tx.appeal.count({ where: { termId, status: 'PENDING' } })) throw new BadRequestException('Còn đơn phúc khảo chưa giải quyết');
      await this.audit(tx, actor.id, 'TERM_FINALIZED', termId, { termId });
      return tx.term.update({ where: { id: termId }, data: { status: 'CLOSED' } });
    });
  }

  async jobs(query: { termId?: string; status?: string; page: number; pageSize: number }) {
    const where: Prisma.AiProcessingJobWhereInput = { ...(query.termId ? { evidence: { termId: query.termId } } : {}), ...(query.status ? { status: query.status as any } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.aiProcessingJob.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: {
        id: true, evidenceId: true, status: true, attempts: true, error: true, createdAt: true, startedAt: true, completedAt: true,
        evidence: { select: { termId: true, status: true, declaredActivityName: true, student: { select: { fullName: true, studentCode: true } } } },
        pipelineRuns: { orderBy: { attempt: 'desc' }, take: 1, select: { id: true, attempt: true, status: true, inputVersion: true, rubricVersionId: true, modelName: true, modelVersion: true, configVersion: true, error: true, startedAt: true, completedAt: true, steps: { select: { id: true, stepKey: true, status: true, error: true, startedAt: true, completedAt: true } } } },
      } }),
      this.prisma.aiProcessingJob.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize, updatedAt: new Date().toISOString() };
  }

  async retryJob(actor: WorkflowActor, id: string) {
    if (actor.role !== Role.ADMIN) throw new ForbiddenException();
    const job = await this.prisma.aiProcessingJob.findUniqueOrThrow({ where: { id }, include: { evidence: true } });
    return this.prisma.$transaction(async tx => {
      const term = await this.lock(tx, job.evidence.termId);
      const current = await tx.aiProcessingJob.findUniqueOrThrow({ where: { id }, include: { evidence: { include: { criterionAssessment: { include: { criterion: true } } } } } });
      if (!['FAILED', 'UNAVAILABLE'].includes(current.status)) throw new BadRequestException('Chỉ xử lý lại job thất bại hoặc chưa khả dụng');
      const ev = current.evidence;
      const rubricId = ev.criterionAssessment?.criterion.rubricVersionId;
      const submission = rubricId ? await tx.assessmentSubmission.findFirst({ where: { studentId: ev.studentId, termId: ev.termId, rubricVersionId: rubricId, status: 'SUBMITTED' } }) : null;
      const handoff = await tx.assessmentHandoff.findUnique({ where: { studentId_termId: { studentId: ev.studentId, termId: ev.termId } } });
      if (!['ACTIVE', 'REVIEWING'].includes(term.status) || !submission || ['SENT', 'EXCLUDED'].includes(handoff?.status ?? '') || !['PROCESSING', 'NEEDS_HUMAN_REVIEW', 'PLAUSIBLE', 'VERIFIED'].includes(ev.status)) throw new BadRequestException('Minh chứng đã có quyết định, chưa nộp hoặc phiếu đã khóa');
      if (await tx.aiProcessingJob.count({ where: { evidenceId: ev.id, status: { in: ['QUEUED', 'PROCESSING'] } } })) throw new BadRequestException('Minh chứng đang có lượt xử lý');
      const result = await tx.aiProcessingJob.create({ data: { evidenceId: ev.id } });
      await tx.evidence.update({ where: { id: ev.id }, data: { status: 'PROCESSING' } });
      await this.audit(tx, actor.id, 'AI_JOB_RETRIED', result.id, { studentId: ev.studentId, termId: ev.termId, previousJobId: id });
      return result;
    });
  }

  async audit(tx: Prisma.TransactionClient, userId: string, action: string, entityId: string, newValue: Prisma.InputJsonValue) {
    await tx.auditLog.create({ data: { userId, action, entityType: 'AssessmentWorkflow', entityId, newValue } });
  }
}
