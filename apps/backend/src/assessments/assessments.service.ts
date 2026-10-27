import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CriterionAssessmentStatus, EvidenceStatus, Prisma, Role, TermStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { WorkflowService } from '../evaluation-workflow/workflow.service';
import { evaluateRubricCriterion } from '../criteria/rubric-scoring';

@Injectable()
export class AssessmentsService {
  constructor(private readonly prisma: PrismaService, private readonly workflow: WorkflowService) {}

  private async getCriterion(termId: string, criterionId: string) {
    const criterion = await this.prisma.criterion.findFirst({
      where: { id: criterionId, rubricVersion: { termId, status: 'PUBLISHED' } },
      include: { rubricCategory: true },
    });
    if (!criterion) throw new NotFoundException('Không tìm thấy tiêu chí thuộc phiên bản quy chế của kỳ này');
    return criterion;
  }

  private async ensureWritable(termId: string) {
    const term = await this.prisma.term.findUnique({ where: { id: termId }, select: { status: true } });
    if (!term) throw new NotFoundException('Không tìm thấy kỳ đánh giá');
    if (term.status === TermStatus.CLOSED) throw new BadRequestException('Kỳ đánh giá đã chốt, không thể thay đổi điểm');
    if (term.status === TermStatus.UPCOMING) throw new BadRequestException('Kỳ đánh giá chưa được mở');
  }

  private async ensureStudentSubmissionOpen(termId: string) {
    const term = await this.prisma.term.findUnique({ where: { id: termId }, select: { status: true, submissionDeadline: true } });
    if (!term) throw new NotFoundException('Không tìm thấy kỳ đánh giá');
    if (term.status !== TermStatus.ACTIVE) throw new BadRequestException('Kỳ đánh giá hiện không nhận tự đánh giá');
    if (new Date() > term.submissionDeadline) throw new BadRequestException('Đã hết hạn nộp tự đánh giá');
  }

  private validateScore(score: number | null | undefined, maxScore: number, label: string) {
    if (score === null || score === undefined) return;
    if (!Number.isFinite(score) || score < 0 || score > maxScore) {
      throw new BadRequestException(`${label} phải nằm trong khoảng 0–${maxScore} điểm`);
    }
  }

  async getMine(studentId: string, termId: string, staffView = false) {
    const version = await this.prisma.rubricVersion.findFirst({
      where: { termId, status: 'PUBLISHED' },
      include: {
        term: { select: { id: true, name: true, status: true, workflowEnabled: true, appealDeadline: true } },
        categories: {
          orderBy: { position: 'asc' },
          include: { criteria: true },
        },
      },
      orderBy: { version: 'desc' },
    });
    if (!version) {
      const term = await this.prisma.term.findUnique({ where: { id: termId }, select: { id: true, name: true, status: true, workflowEnabled: true, appealDeadline: true } });
      if (!term) throw new NotFoundException('Không tìm thấy kỳ đánh giá');
      return { rubricVersion: null, term, categories: [], submission: null };
    }
    const [assessments, submission] = await Promise.all([this.prisma.criterionAssessment.findMany({
      where: { studentId, termId, criterion: { rubricVersionId: version.id } },
      include: { evidences: { select: { id: true, declaredActivityName: true, status: true } } },
    }), this.prisma.assessmentSubmission.findUnique({ where: { studentId_termId_rubricVersionId: { studentId, termId, rubricVersionId: version.id } } })]);
    const handoff = await this.prisma.assessmentHandoff.findUnique({ where: { studentId_termId: { studentId, termId } } });
    const publication = version.term?.workflowEnabled ? await this.workflow.publication(studentId, termId) : null;
    const publishedSnapshot = publication?.snapshot as any;
    const byCriterion = new Map(assessments.map((assessment) => [assessment.criterionId, assessment]));
    return {
      rubricVersion: { id: version.id, version: version.version, status: version.status, source: version.source },
      term: version.term,
      submission,
      handoff: handoff ? { status: handoff.status, returnReason: handoff.returnReason, revision: handoff.revision } : null,
      publication: publication ? { revision: publication.revision, publishedAt: publication.publishedAt } : null,
      permissions: {
        canReview: staffView && version.term?.status !== 'CLOSED' && submission?.status === 'SUBMITTED' && !['SENT', 'EXCLUDED'].includes(handoff?.status ?? ''),
        canAppeal: !!publication && version.term?.status !== 'CLOSED' && new Date() <= version.term!.appealDeadline,
      },
      categories: version.categories.map((category) => ({
        key: category.code,
        name: category.name,
        maxScore: category.maxScore,
        criteria: [...category.criteria].sort((left, right) => left.code.localeCompare(right.code, 'vi', { numeric: true })).map((criterion) => ({
          ...criterion,
          assessment: (() => {
            const live = byCriterion.get(criterion.id) || null;
            if (staffView || !version.term?.workflowEnabled || !live) return live;
            const published = publishedSnapshot?.categories?.flatMap((c: any) => c.criteria).find((c: any) => c.id === criterion.id)?.assessment;
            return { ...live, verifiedData: null, verificationNote: null, suggestedScore: null, suggestionReason: null, officialScore: published?.officialScore ?? null, officialReason: published?.officialReason ?? null, status: published ? 'FINALIZED' : 'NEEDS_VERIFICATION', finalizedAt: published?.finalizedAt ?? null, finalReviewerId: null };
          })(),
        })),
      })),
    };
  }

  async saveSelfAssessment(studentId: string, termId: string, criterionId: string, body: { score?: number | null; note?: string }) {
    await this.ensureStudentSubmissionOpen(termId);
    const criterion = await this.getCriterion(termId, criterionId);
    await this.ensureSubmissionEditable(studentId, termId, criterion.rubricVersionId!);
    this.validateScore(body.score, criterion.maxScore, 'Điểm tự đánh giá');
    const assessment = await this.prisma.criterionAssessment.upsert({
      where: { studentId_termId_criterionId: { studentId, termId, criterionId } },
      create: {
        studentId,
        termId,
        criterionId,
        selfScore: body.score,
        selfNote: body.note?.trim() || null,
      },
      update: {
        selfScore: body.score,
        selfNote: body.note?.trim() || null,
      },
      include: { criterion: true },
    });
    return assessment;
  }

  private async ensureSubmissionEditable(studentId: string, termId: string, rubricVersionId: string) {
    const submission = await this.prisma.assessmentSubmission.findUnique({ where: { studentId_termId_rubricVersionId: { studentId, termId, rubricVersionId } } });
    if (submission?.status === 'SUBMITTED') throw new BadRequestException('Phiếu đã nộp và đang chờ cán bộ xử lý; không thể chỉnh sửa');
  }

  private async ensureSubmittedForStaffReview(studentId: string, termId: string, rubricVersionId: string) {
    const submission = await this.prisma.assessmentSubmission.findUnique({ where: { studentId_termId_rubricVersionId: { studentId, termId, rubricVersionId } }, select: { status: true } });
    if (submission?.status !== 'SUBMITTED') throw new BadRequestException('Chỉ được xác minh và chốt điểm khi sinh viên đã nộp phiếu');
  }

  async saveSelfAssessmentBatch(studentId: string, termId: string, scores: Array<{ criterionId: string; score: number | null }>) {
    await this.ensureStudentSubmissionOpen(termId);
    const version = await this.prisma.rubricVersion.findFirst({ where: { termId, status: 'PUBLISHED' }, include: { criteria: true } });
    if (!version) throw new BadRequestException('Kỳ này chưa có rubric được ban hành');
    await this.ensureSubmissionEditable(studentId, termId, version.id);
    const criteriaById = new Map(version.criteria.map((criterion) => [criterion.id, criterion]));
    for (const item of scores) {
      const criterion = criteriaById.get(item.criterionId);
      if (!criterion) throw new BadRequestException(`Tiêu chí ${item.criterionId} không thuộc rubric đang áp dụng`);
      this.validateScore(item.score, criterion.maxScore, `Điểm tự đánh giá mục ${criterion.code}`);
    }
    await this.prisma.$transaction(scores.map((item) => this.prisma.criterionAssessment.upsert({
      where: { studentId_termId_criterionId: { studentId, termId, criterionId: item.criterionId } },
      create: { studentId, termId, criterionId: item.criterionId, selfScore: item.score },
      update: { selfScore: item.score },
    })));
    return this.getMine(studentId, termId);
  }

  async submitSelfAssessment(studentId: string, termId: string) {
    await this.ensureStudentSubmissionOpen(termId);
    const version = await this.prisma.rubricVersion.findFirst({ where: { termId, status: 'PUBLISHED' }, include: { criteria: true } });
    if (!version) throw new BadRequestException('Kỳ này chưa có rubric được ban hành');
    await this.ensureSubmissionEditable(studentId, termId, version.id);
    const drafts = await this.prisma.evidence.findMany({ where: { studentId, termId, status: EvidenceStatus.DRAFT }, include: { files: true } });
    const incomplete = drafts.find((evidence) => evidence.files.length === 0);
    if (incomplete) throw new BadRequestException(`Minh chứng “${incomplete.declaredActivityName || 'Chưa đặt tên'}” chưa có tệp; hãy bổ sung tệp hoặc xóa hồ sơ nháp trước khi nộp phiếu`);

    return this.prisma.$transaction(async (tx) => {
      const submission = await tx.assessmentSubmission.upsert({
        where: { studentId_termId_rubricVersionId: { studentId, termId, rubricVersionId: version.id } },
        create: { studentId, termId, rubricVersionId: version.id, status: 'SUBMITTED', submittedAt: new Date(), returnedAt: null, returnReason: null, returnedById: null },
        update: { status: 'SUBMITTED', submittedAt: new Date(), returnedAt: null, returnReason: null, returnedById: null },
      });
      for (const evidence of drafts) {
        await tx.evidence.update({ where: { id: evidence.id }, data: { status: EvidenceStatus.PROCESSING, submittedAt: new Date() } });
        await tx.aiProcessingJob.create({ data: { evidenceId: evidence.id } });
      }
      await tx.auditLog.create({ data: { userId: studentId, action: 'ASSESSMENT_SUBMITTED', entityType: 'AssessmentSubmission', entityId: submission.id, newValue: { status: 'SUBMITTED', rubricVersionId: version.id, evidenceCount: drafts.length } } });
      return { submission, submittedEvidenceCount: drafts.length };
    });
  }

  async returnSelfAssessment(staff: { id: string; role: Role; facultyId?: string | null }, studentId: string, termId: string, reason: string) {
    await this.ensureStaffScope(staff, studentId);
    if (!reason?.trim()) throw new BadRequestException('Cần ghi lý do trả phiếu cho sinh viên');
    const submission = await this.prisma.assessmentSubmission.findFirst({ where: { studentId, termId, status: 'SUBMITTED' } });
    if (!submission) throw new NotFoundException('Không tìm thấy phiếu đang chờ xử lý');
    const evidenceIds = (await this.prisma.evidence.findMany({ where: { studentId, termId, status: { notIn: [EvidenceStatus.APPROVED, EvidenceStatus.WITHDRAWN] } }, select: { id: true } })).map((item) => item.id);
    return this.workflow.edit(staff, studentId, termId, async (tx) => {
      await tx.criterionAssessment.updateMany({ where: { studentId, termId }, data: { status: 'NEEDS_VERIFICATION', officialScore: null, officialReason: null, finalReviewerId: null, finalizedAt: null, suggestedScore: null, suggestionReason: null } });
      const returned = await tx.assessmentSubmission.update({ where: { id: submission.id }, data: { status: 'RETURNED', returnedAt: new Date(), returnReason: reason.trim(), returnedById: staff.id } });
      await tx.auditLog.create({ data: { userId: staff.id, action: 'ASSESSMENT_RETURNED', entityType: 'AssessmentSubmission', entityId: returned.id, oldValue: { status: 'SUBMITTED' }, newValue: { status: 'RETURNED', reason: reason.trim(), studentId, termId } } });
      if (evidenceIds.length) {
        await tx.aiProcessingJob.updateMany({ where: { evidenceId: { in: evidenceIds }, status: { in: ['QUEUED', 'PROCESSING'] } }, data: { status: 'CANCELLED', error: 'Hủy lượt xử lý để sinh viên bổ sung theo yêu cầu cán bộ.' } });
        await tx.evidence.updateMany({ where: { id: { in: evidenceIds } }, data: { status: EvidenceStatus.DRAFT } });
      }
      return returned;
    });
  }

  private async ensureStaffScope(staff: { id: string; role: Role; facultyId?: string | null }, studentId: string) {
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, role: true, class: { select: { facultyId: true } } },
    });
    if (!student || student.role !== Role.STUDENT) throw new NotFoundException('Không tìm thấy sinh viên');
    if (staff.role === Role.STAFF && staff.facultyId !== student.class?.facultyId) {
      throw new ForbiddenException('Bạn chỉ được đánh giá sinh viên thuộc Khoa phụ trách');
    }
  }

  async getStudentAssessments(staff: { id: string; role: Role; facultyId?: string | null }, studentId: string, termId: string) {
    await this.ensureStaffScope(staff, studentId);
    const result = await this.getMine(studentId, termId, true);
    const assessments = await this.prisma.criterionAssessment.findMany({
      where: { studentId, termId },
      include: {
        classEvaluator: { select: { id: true, fullName: true } },
        finalReviewer: { select: { id: true, fullName: true } },
        evidences: {
          select: {
            id: true, declaredActivityName: true, status: true,
            aiSuggestions: { orderBy: { createdAt: 'desc' }, take: 1 },
            reviews: { orderBy: { createdAt: 'desc' }, take: 1, select: { finalScore: true, reason: true } },
          },
        },
      },
    });
    const byCriterion = new Map(assessments.map((assessment) => [assessment.criterionId, assessment]));
    return {
      ...result,
      permissions: { ...result.permissions, canReview: staff.role === 'STAFF' && result.permissions?.canReview },
      categories: result.categories.map((category) => ({
        ...category,
        criteria: category.criteria.map((criterion) => ({ ...criterion, assessment: byCriterion.get(criterion.id) || null })),
      })),
    };
  }

  async recordClassAssessment(
    staff: { id: string; role: Role; facultyId?: string | null },
    studentId: string,
    termId: string,
    criterionId: string,
    body: { score: number; note: string },
  ) {
    await this.ensureStaffScope(staff, studentId);
    await this.ensureWritable(termId);
    const criterion = await this.getCriterion(termId, criterionId);
    this.validateScore(body.score, criterion.maxScore, 'Điểm đánh giá của lớp');
    if (!body.note?.trim()) throw new BadRequestException('Cần ghi căn cứ/xác nhận của tập thể lớp');
    throw new BadRequestException('Đánh giá lớp đã ngừng sử dụng; hãy xác minh và chấm điểm tại phiếu rèn luyện');
    const assessment = await this.prisma.criterionAssessment.upsert({
      where: { studentId_termId_criterionId: { studentId, termId, criterionId } },
      create: { studentId, termId, criterionId, classScore: body.score, classNote: body.note.trim(), classEvaluatorId: staff.id },
      update: { classScore: body.score, classNote: body.note.trim(), classEvaluatorId: staff.id },
      include: { criterion: true },
    });
    return assessment;
  }

  async verifyCriterion(
    staff: { id: string; role: Role; facultyId?: string | null },
    studentId: string,
    termId: string,
    criterionId: string,
    body: { data: Record<string, unknown>; note: string },
  ) {
    await this.ensureStaffScope(staff, studentId);
    await this.ensureWritable(termId);
    if (!body.note?.trim()) throw new BadRequestException('Cần ghi căn cứ xác minh');
    const criterion = await this.getCriterion(termId, criterionId);
    await this.ensureSubmittedForStaffReview(studentId, termId, criterion.rubricVersionId!);
    const config = criterion.scoringConfig as Record<string, unknown> | null;
    const verifiedData = { ...body.data };
    let hasUnresolvedEvidence = false;
    if (config && ['activity_threshold', 'community_activity_tier'].includes(String(config.kind))) {
      const existingAssessment = await this.prisma.criterionAssessment.findUnique({
        where: { studentId_termId_criterionId: { studentId, termId, criterionId } },
        select: { id: true },
      });
      const evidences = existingAssessment ? await this.prisma.evidence.findMany({
        where: { studentId, termId, criterionAssessmentId: existingAssessment.id },
        select: { id: true, activityId: true, declaredRole: true, status: true },
      }) : [];
      hasUnresolvedEvidence = evidences.some((evidence) => evidence.status !== EvidenceStatus.APPROVED && evidence.status !== EvidenceStatus.REJECTED && evidence.status !== EvidenceStatus.WITHDRAWN);
      const approved = evidences.filter((evidence) => evidence.status === 'APPROVED');
      const uniqueActivities = new Map(approved.map((evidence) => [evidence.activityId || evidence.id, evidence]));
      verifiedData.verifiedActivityCount = uniqueActivities.size;
      if (config.cheerleaderMultiplier) {
        verifiedData.cheerleaderActivityCount = [...uniqueActivities.values()].filter((evidence) => ['CHEERLEADER', 'CO_VU'].includes(evidence.declaredRole || '')).length;
      }
    }
    const computedEvaluation = evaluateRubricCriterion(criterion.maxScore, criterion.scoringConfig, verifiedData);
    const evaluation = hasUnresolvedEvidence
      ? { status: 'NEEDS_VERIFICATION' as const, suggestedScore: null, reason: 'Còn minh chứng đang chờ xử lý; điểm chỉ được tính sau khi hồ sơ liên quan được duyệt hoặc kết thúc.' }
      : computedEvaluation;
    return this.workflow.edit(staff, studentId, termId, async (tx) => {
    if (!await tx.assessmentSubmission.count({ where: { studentId, termId, status: 'SUBMITTED' } })) throw new BadRequestException('Sinh viên chưa nộp phiếu');
    const assessment = await tx.criterionAssessment.upsert({
      where: { studentId_termId_criterionId: { studentId, termId, criterionId } },
      create: {
        studentId,
        termId,
        criterionId,
        verifiedData: verifiedData as Prisma.InputJsonValue,
        verificationNote: body.note.trim(),
        suggestedScore: evaluation.suggestedScore,
        suggestionReason: evaluation.reason,
        status: evaluation.status,
      },
      update: {
        verifiedData: verifiedData as Prisma.InputJsonValue,
        verificationNote: body.note.trim(),
        suggestedScore: evaluation.suggestedScore,
        suggestionReason: evaluation.reason,
        status: evaluation.status,
        officialScore: null,
        officialReason: null,
        finalReviewerId: null,
        finalizedAt: null,
      },
    });
    await tx.auditLog.create({ data: { userId: staff.id, action: 'CRITERION_VERIFIED', entityType: 'CriterionAssessment', entityId: assessment.id, oldValue: null, newValue: { studentId, termId, criterionId, verifiedData: verifiedData as Prisma.InputJsonValue, suggestedScore: evaluation.suggestedScore, status: evaluation.status, note: body.note.trim() } } });
    return assessment;
    });
  }

  async finalizeCriterion(
    staff: { id: string; role: Role; facultyId?: string | null },
    studentId: string,
    termId: string,
    criterionId: string,
    body: { score?: number; reason?: string },
  ) {
    await this.ensureStaffScope(staff, studentId);
    await this.ensureWritable(termId);
    const criterion = await this.getCriterion(termId, criterionId);
    await this.ensureSubmittedForStaffReview(studentId, termId, criterion.rubricVersionId!);
    const assessment = await this.prisma.criterionAssessment.findUnique({
      where: { studentId_termId_criterionId: { studentId, termId, criterionId } },
    });
    if (!assessment || assessment.status !== CriterionAssessmentStatus.READY_FOR_REVIEW || assessment.suggestedScore === null) {
      throw new BadRequestException('Chưa có dữ liệu đã xác minh để đề xuất điểm');
    }
    const finalScore = body.score ?? assessment.suggestedScore;
    this.validateScore(finalScore, criterion.maxScore, 'Điểm chính thức');
    const adjusted = finalScore !== assessment.suggestedScore;
    if (adjusted && !body.reason?.trim()) throw new BadRequestException('Bắt buộc ghi lý do khi điều chỉnh điểm đề xuất');
    const finalized = await this.workflow.edit(staff, studentId, termId, async (tx) => {
      if (!await tx.assessmentSubmission.count({ where: { studentId, termId, status: 'SUBMITTED' } })) throw new BadRequestException('Sinh viên chưa nộp phiếu');
      const changed = await tx.criterionAssessment.updateMany({
        where: { id: assessment.id, status: CriterionAssessmentStatus.READY_FOR_REVIEW, suggestedScore: assessment.suggestedScore, updatedAt: assessment.updatedAt },
        data: {
        officialScore: finalScore,
        officialReason: adjusted ? body.reason!.trim() : body.reason?.trim() || 'Cán bộ xác nhận điểm đề xuất theo căn cứ đã xác minh.',
        finalReviewerId: staff.id,
        status: CriterionAssessmentStatus.FINALIZED,
        finalizedAt: new Date(),
      },
      });
      if (!changed.count) throw new ConflictException('Tiêu chí vừa được cập nhật bởi một thao tác khác; hãy tải lại phiếu trước khi chốt điểm.');
      const result = await tx.criterionAssessment.findUniqueOrThrow({ where: { id: assessment.id }, include: { criterion: true } });
      await tx.auditLog.create({ data: { userId: staff.id, action: adjusted ? 'CRITERION_SCORE_ADJUSTED' : 'CRITERION_FINALIZED', entityType: 'CriterionAssessment', entityId: result.id, oldValue: { suggestedScore: assessment.suggestedScore, officialScore: assessment.officialScore }, newValue: { suggestedScore: assessment.suggestedScore, officialScore: finalScore, reason: result.officialReason, studentId, termId, criterionId } } });
      return result;
    });
    return finalized;
  }
}
