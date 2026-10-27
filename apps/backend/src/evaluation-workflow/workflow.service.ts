import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

export type WorkflowActor = { id: string; role: Role; facultyId?: string | null };
const unresolved = ['PROCESSING', 'PLAUSIBLE', 'VERIFIED', 'NEEDS_HUMAN_REVIEW', 'NEEDS_SUPPLEMENT', 'APPEALING'];
export const classification = (score: number) => score >= 90 ? 'Xuất sắc' : score >= 80 ? 'Tốt' : score >= 65 ? 'Khá' : score >= 50 ? 'Trung bình' : 'Yếu';

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

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
    const enrollment = termId ? await db.assessmentHandoff.findUnique({ where: { studentId_termId: { studentId, termId } } }) : null;
    const student = await db.user.findUnique({ where: { id: studentId }, include: { class: true } });
    if (!student || student.role !== Role.STUDENT) throw new NotFoundException('Không tìm thấy sinh viên');
    if (!actor.facultyId || actor.facultyId !== (enrollment?.facultyId ?? student.class?.facultyId)) throw new ForbiddenException('Sinh viên nằm ngoài Khoa phụ trách');
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

  async snapshot(db: Prisma.TransactionClient, studentId: string, termId: string, rubricVersionId: string) {
    const rubric = await db.rubricVersion.findUniqueOrThrow({ where: { id: rubricVersionId }, include: { categories: { orderBy: { position: 'asc' }, include: { criteria: true } } } });
    const assessments = await db.criterionAssessment.findMany({ where: { studentId, termId, criterion: { rubricVersionId } } });
    const categories = rubric.categories.map(cat => {
      const criteria = cat.criteria.sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true })).map(c => ({ id: c.id, code: c.code, name: c.name, maxScore: c.maxScore, assessment: assessments.find(a => a.criterionId === c.id) ?? null }));
      return { key: cat.code, name: cat.name, maxScore: cat.maxScore, criteria, score: Math.min(cat.maxScore, criteria.reduce((n, c) => n + (c.assessment?.status === 'FINALIZED' ? c.assessment.officialScore ?? 0 : 0), 0)) };
    });
    const complete = categories.length > 0 && categories.every(c => c.criteria.length > 0 && c.criteria.every(i => i.assessment?.status === 'FINALIZED' && i.assessment.officialScore !== null && !!i.assessment.verificationNote));
    const totalScore = Math.min(100, categories.reduce((n, c) => n + c.score, 0));
    return { rubricVersionId, categories, totalScore, classification: classification(totalScore), complete };
  }

  async list(actor: WorkflowActor, termId: string, classId?: string, facultyId?: string) {
    if (actor.role === Role.STAFF && !actor.facultyId) throw new ForbiddenException('Chưa được phân công Khoa');
    const term = await this.prisma.term.findUnique({ where: { id: termId } });
    if (!term) throw new NotFoundException('Không tìm thấy kỳ');
    const where = { termId, ...(classId ? { classId } : {}), ...(actor.role === Role.STAFF ? { facultyId: actor.facultyId! } : facultyId ? { facultyId } : {}) };
    const [rows, submissions, assessments, appeals, publications, evidences] = await Promise.all([
      this.prisma.assessmentHandoff.findMany({ where, orderBy: { createdAt: 'asc' } }),
      this.prisma.assessmentSubmission.findMany({ where: { termId } }),
      this.prisma.criterionAssessment.findMany({ where: { termId }, select: { studentId: true, status: true, criterionId: true } }),
      this.prisma.appeal.findMany({ where: { termId, status: 'PENDING' }, select: { studentId: true } }),
      this.prisma.assessmentPublication.findMany({ where: { termId }, orderBy: { revision: 'desc' } }),
      this.prisma.evidence.findMany({ where: { termId, status: { in: unresolved as any } }, select: { studentId: true } }),
    ]);
    const ids = rows.map(r => r.studentId);
    const [users, classes, faculties, criteria] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, studentCode: true, fullName: true } }),
      this.prisma.class.findMany(), this.prisma.faculty.findMany(),
      this.prisma.criterion.findMany({ where: { rubricVersionId: { in: [...new Set(rows.map(r => r.rubricVersionId))] } }, select: { id: true, rubricVersionId: true } }),
    ]);
    const items = rows.map(row => {
      const submission = submissions.find(s => s.studentId === row.studentId && s.rubricVersionId === row.rubricVersionId);
      const targetCriteria = criteria.filter(c => c.rubricVersionId === row.rubricVersionId);
      const finalized = assessments.filter(a => a.studentId === row.studentId && a.status === 'FINALIZED' && targetCriteria.some(c => c.id === a.criterionId)).length;
      const pendingEvidence = evidences.filter(e => e.studentId === row.studentId).length;
      const publication = publications.find(p => p.studentId === row.studentId);
      const pendingAppeals = appeals.filter(a => a.studentId === row.studentId).length;
      const ready = submission?.status === 'SUBMITTED' && targetCriteria.length > 0 && finalized === targetCriteria.length && pendingEvidence === 0 && pendingAppeals === 0;
      const state = row.status === 'EXCLUDED' ? 'NOT_SUBMITTED_RECORDED' : row.status === 'SENT' ? publication?.revision === row.revision ? 'PUBLISHED' : 'SENT' : row.status === 'RETURNED' ? 'FACULTY_RETURNED' : submission?.status === 'RETURNED' ? 'STUDENT_RETURNED' : submission?.status !== 'SUBMITTED' ? 'NOT_SUBMITTED' : ready ? 'READY' : 'REVIEWING';
      return { ...row, snapshot: undefined, student: users.find(u => u.id === row.studentId), class: classes.find(c => c.id === row.classId), faculty: faculties.find(f => f.id === row.facultyId), submissionStatus: submission?.status ?? 'DRAFT', finalizedCriteria: finalized, totalCriteria: targetCriteria.length, pendingEvidence, pendingAppeals, ready, state, publication: publication ? { revision: publication.revision, publishedAt: publication.publishedAt } : null };
    });
    const count = (states: string[]) => items.filter(i => states.includes(i.state)).length;
    return { term, items, summary: { total: items.length, notSubmitted: count(['NOT_SUBMITTED']), reviewing: count(['REVIEWING']), returned: count(['FACULTY_RETURNED', 'STUDENT_RETURNED']), ready: count(['READY']), sent: count(['SENT', 'PUBLISHED']), published: count(['PUBLISHED']), recordedNotSubmitted: count(['NOT_SUBMITTED_RECORDED']), pendingAppeals: items.reduce((n, i) => n + i.pendingAppeals, 0) }, updatedAt: new Date().toISOString() };
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
        if (!sub || !snapshot.complete || pendingEvidence || pendingAppeals) throw new BadRequestException('Phiếu chưa đủ căn cứ, chưa chấm hết hoặc còn minh chứng/phúc khảo chờ xử lý');
        await tx.assessmentHandoff.update({ where: { id: row.id }, data: { status: 'SENT', revision: { increment: 1 }, snapshot: JSON.parse(JSON.stringify(snapshot)), sentAt: new Date(), sentById: actor.id, returnReason: null } });
        await this.audit(tx, actor.id, 'FACULTY_RESULT_SENT', row.id, { studentId, termId, revision: row.revision + 1 });
      }
      return { sent: [...new Set(studentIds)].length };
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
      return result;
    });
  }

  async recordNotSubmitted(actor: WorkflowActor, studentId: string, termId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Cần ghi lý do không nộp phiếu');
    return this.edit(actor, studentId, termId, async tx => {
      const term = await tx.term.findUniqueOrThrow({ where: { id: termId } });
      if (new Date() <= term.submissionDeadline) throw new BadRequestException('Chưa hết hạn nộp phiếu');
      if (await tx.assessmentSubmission.count({ where: { studentId, termId, status: { in: ['SUBMITTED', 'RETURNED'] } } })) throw new BadRequestException('Sinh viên đã có phiếu; phải xử lý phiếu hiện có');
      const row = await tx.assessmentHandoff.update({ where: { studentId_termId: { studentId, termId } }, data: { status: 'EXCLUDED', notSubmittedReason: reason.trim() } });
      await this.audit(tx, actor.id, 'NON_SUBMISSION_RECORDED', row.id, { studentId, termId, reason: reason.trim() });
      return row;
    });
  }

  async publication(studentId: string, termId: string) {
    return this.prisma.assessmentPublication.findFirst({ where: { studentId, termId }, orderBy: { revision: 'desc' } });
  }

  async publish(actor: WorkflowActor, termId: string) {
    if (actor.role !== Role.ADMIN) throw new ForbiddenException();
    return this.prisma.$transaction(async tx => {
      const term = await this.lock(tx, termId);
      if (!term.workflowEnabled || !['ACTIVE', 'REVIEWING'].includes(term.status)) throw new BadRequestException('Không thể công bố kỳ này');
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
        await tx.notification.create({ data: { userId: row.studentId, type: 'RESULT_PUBLISHED', title: 'Đã công bố tạm kết quả rèn luyện', content: `${term.name}: xem kết quả và gửi phúc khảo trước ${term.appealDeadline.toLocaleString('vi-VN')}.` } });
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
      if (!term.workflowEnabled) throw new BadRequestException('Kỳ lịch sử không áp dụng quy trình mới');
      if (term.status !== 'REVIEWING' || new Date() <= term.appealDeadline) throw new BadRequestException('Chỉ chốt sau công bố tạm và hết hạn phúc khảo');
      const rows = await tx.assessmentHandoff.findMany({ where: { termId } });
      const publications = await tx.assessmentPublication.findMany({ where: { termId } });
      if (!rows.length || rows.some(r => r.status !== 'EXCLUDED' && (r.status !== 'SENT' || !publications.some(p => p.studentId === r.studentId && p.revision === r.revision)))) throw new BadRequestException('Còn phiếu chưa công bố phiên bản mới nhất');
      if (await tx.appeal.count({ where: { termId, status: 'PENDING' } })) throw new BadRequestException('Còn đơn phúc khảo chưa giải quyết');
      await this.audit(tx, actor.id, 'TERM_FINALIZED', termId, { termId });
      return tx.term.update({ where: { id: termId }, data: { status: 'CLOSED' } });
    });
  }

  async audit(tx: Prisma.TransactionClient, userId: string, action: string, entityId: string, newValue: Prisma.InputJsonValue) {
    await tx.auditLog.create({ data: { userId, action, entityType: 'AssessmentWorkflow', entityId, newValue } });
  }
}
