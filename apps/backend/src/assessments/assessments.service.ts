import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CriterionAssessmentStatus, DeadlineExtensionType, EvidenceStatus, Prisma, Role, TermStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { WorkflowService } from '../evaluation-workflow/workflow.service';
import { WorkflowQueryDto } from '../evaluation-workflow/dto/workflow-query.dto';
import { evaluateRubricCriterion } from '../criteria/rubric-scoring';
import { DeadlineExtensionsService } from '../deadline-extensions/deadline-extensions.service';
import { aggregateStudentActivitySources } from '../activities/activity-aggregator';
import { unresolvedEvidenceStatuses } from '../evaluation-workflow/evaluation-policy';

export function validateVerifiedData(config: Record<string, unknown> | null, data: Record<string, unknown>, maxScore: number): void {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new BadRequestException({
      code: 'INVALID_VERIFICATION_DATA',
      message: 'Dữ liệu xác minh không hợp lệ',
      details: { fields: [{ field: 'data', message: 'Dữ liệu xác minh phải là một object' }] },
    });
  }

  const errors: Array<{ field: string; message: string }> = [];

  const counterFields = new Set([
    'attendanceViolations', 'classWarnings', 'examBans', 'unexcusedAbsences',
    'excusedAbsences', 'missedGroupDeadlines', 'nonCauseAccountLocks',
    'classTaskFailures', 'unexcusedClassMeetingAbsences', 'excusedClassMeetingAbsences',
    'communityViolations', 'verifiedActivityCount', 'cheerleaderActivityCount',
  ]);

  const booleanFields = new Set([
    'leadershipRole', 'improvedFromPreviousTerm', 'academicWarning', 'eligibleMembership',
    'tuitionCompliance', 'studentWeekParticipation', 'requiredSurveyParticipation',
    'disciplinaryViolation', 'healthInsurance', 'residenceDeclaration',
    'organizerConfirmation', 'advisorConfirmation', 'excellentDutyConfirmation',
    'awardEvidence', 'institutionAwardEvidence',
  ]);

  for (const [key, val] of Object.entries(data)) {
    if (val === undefined || val === null) continue;

    if (counterFields.has(key)) {
      if (typeof val !== 'number' || !Number.isInteger(val) || val < 0) {
        errors.push({ field: key, message: `Trường ${key} phải là số nguyên không âm` });
      }
    } else if (booleanFields.has(key)) {
      if (typeof val !== 'boolean') {
        errors.push({ field: key, message: `Trường ${key} phải có kiểu boolean` });
      }
    } else if (key === 'collectiveApprovalPercent') {
      if (typeof val !== 'number' || !Number.isFinite(val) || val < 0 || val > 100) {
        errors.push({ field: key, message: 'Tỷ lệ tập thể bình chọn phải là số từ 0 đến 100' });
      }
    } else if (key === 'convertedCommunityPoints') {
      if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
        errors.push({ field: key, message: 'Điểm hoạt động cộng đồng quy đổi phải là số không âm' });
      }
    } else if (key === 'officialScore') {
      if (typeof val !== 'number' || !Number.isFinite(val) || val < 0 || val > maxScore) {
        errors.push({ field: key, message: `Điểm chính thức phải là số từ 0 đến ${maxScore}` });
      }
    } else if (key === 'academicTier') {
      if (typeof val !== 'string' || !['BELOW_AVERAGE', 'AVERAGE', 'ABOVE_AVERAGE', 'GOOD', 'EXCELLENT'].includes(val)) {
        errors.push({ field: key, message: 'Xếp loại học tập không hợp lệ' });
      }
    } else if (key === 'awardTier') {
      const scores = config?.scores as Record<string, number> | undefined;
      if (typeof val !== 'string' || (scores && !Object.prototype.hasOwnProperty.call(scores, val))) {
        errors.push({ field: key, message: 'Mức thành tích không hợp lệ' });
      }
    } else if (key === 'officialAssessment') {
      if (typeof val !== 'string') {
        errors.push({ field: key, message: 'Kết luận xác minh chính thức phải là chuỗi' });
      }
    }
  }

  if (errors.length > 0) {
    throw new BadRequestException({
      code: 'INVALID_VERIFICATION_DATA',
      error: 'INVALID_VERIFICATION_DATA',
      message: 'Dữ liệu xác minh không hợp lệ',
      details: { fields: errors },
    });
  }
}

@Injectable()
export class AssessmentsService {
  constructor(private readonly prisma: PrismaService, private readonly workflow: WorkflowService, private readonly deadlines: DeadlineExtensionsService) {}

  async syncStudentGrounding(
    tx: Prisma.TransactionClient,
    studentId: string,
    termId: string,
    rubricVersionId?: string,
  ): Promise<void> {
    const version = rubricVersionId
      ? await tx.rubricVersion.findUnique({ where: { id: rubricVersionId }, include: { criteria: true } })
      : await tx.rubricVersion.findFirst({ where: { termId, status: 'PUBLISHED' }, orderBy: { version: 'desc' }, include: { criteria: true } });

    if (!version) return;

    const activeGroundings = await tx.academicGrounding.findMany({
      where: { studentId, termId, status: 'ACTIVE' },
    });

    const activeByCode = new Map(activeGroundings.map((g) => [g.criterionCode, g]));

    for (const criterion of version.criteria) {
      if (!['1', '3', '7'].includes(criterion.code)) continue;

      const existing = await tx.criterionAssessment.findUnique({
        where: { studentId_termId_criterionId: { studentId, termId, criterionId: criterion.id } },
      });

      // Nếu tiêu chí ĐÃ được chốt chính thức (FINALIZED) thì không ghi đè
      if (existing?.status === CriterionAssessmentStatus.FINALIZED) {
        continue;
      }

      // Nếu cán bộ đã xác minh thủ công (verifiedData đã có và không phải do hệ thống căn cứ tự sinh),
      // tuyệt đối KHÔNG ghi đè thay đổi thủ công của cán bộ
      if (existing?.verifiedData && !existing.academicGroundingId) {
        continue;
      }

      const grounding = activeByCode.get(criterion.code);
      if (grounding) {
        const evaluation = evaluateRubricCriterion(
          criterion.maxScore,
          criterion.scoringConfig,
          grounding.data as Record<string, unknown>,
        );

        await tx.criterionAssessment.upsert({
          where: { studentId_termId_criterionId: { studentId, termId, criterionId: criterion.id } },
          create: {
            studentId,
            termId,
            criterionId: criterion.id,
            verifiedData: grounding.data as Prisma.InputJsonValue,
            academicGroundingId: grounding.id,
            verificationNote: grounding.note || `Căn cứ học vụ từ ${grounding.source || 'Khoa import'}`,
            suggestedScore: evaluation.suggestedScore,
            suggestionReason: evaluation.reason,
            status: evaluation.status,
          },
          update: {
            verifiedData: grounding.data as Prisma.InputJsonValue,
            academicGroundingId: grounding.id,
            verificationNote: grounding.note || `Căn cứ học vụ từ ${grounding.source || 'Khoa import'}`,
            suggestedScore: evaluation.suggestedScore,
            suggestionReason: evaluation.reason,
            status: evaluation.status,
            officialScore: null,
            officialReason: null,
            finalReviewerId: null,
            finalizedAt: null,
          },
        });
      } else if (existing?.academicGroundingId) {
        // Lô cũ bị thu hồi -> reset điểm gợi ý và căn cứ
        await tx.criterionAssessment.update({
          where: { id: existing.id },
          data: {
            verifiedData: Prisma.DbNull,
            academicGroundingId: null,
            verificationNote: null,
            suggestedScore: null,
            suggestionReason: null,
            status: CriterionAssessmentStatus.NEEDS_VERIFICATION,
          },
        });
      }
    }
  }

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

  private async ensureStudentSubmissionOpen(studentId: string, termId: string) {
    await this.prisma.$transaction(tx => this.workflow.assertStudentEditable(tx, studentId, termId));
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
        term: { select: { id: true, name: true, status: true, workflowEnabled: true, appealDeadline: true, submissionDeadline: true, reviewDeadline: true } },
        categories: {
          orderBy: { position: 'asc' },
          include: { criteria: true },
        },
      },
      orderBy: { version: 'desc' },
    });
    if (!version) {
      const term = await this.prisma.term.findUnique({ where: { id: termId }, select: { id: true, name: true, status: true, workflowEnabled: true, appealDeadline: true, submissionDeadline: true, reviewDeadline: true } });
      if (!term) throw new NotFoundException('Không tìm thấy kỳ đánh giá');
      return { rubricVersion: null, term, categories: [], submission: null };
    }

    const [assessments, submission, submissionWindow, reviewWindow, appealWindow] = await Promise.all([this.prisma.criterionAssessment.findMany({
      where: { studentId, termId, criterion: { rubricVersionId: version.id } },
      include: { evidences: { select: { id: true, declaredActivityName: true, status: true } } },
    }), this.prisma.assessmentSubmission.findUnique({ where: { studentId_termId_rubricVersionId: { studentId, termId, rubricVersionId: version.id } } }), this.deadlines.resolve(termId, studentId, DeadlineExtensionType.SUBMISSION), this.deadlines.resolve(termId, studentId, DeadlineExtensionType.REVIEW), this.deadlines.resolve(termId, studentId, DeadlineExtensionType.APPEAL)]);
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
        canEdit: (!version.term?.workflowEnabled || !!handoff && !['SENT','EXCLUDED'].includes(handoff.status)) && submission?.status !== 'SUBMITTED' && ((version.term?.status === 'ACTIVE' && new Date() <= submissionWindow.deadline) || (submission?.status === 'RETURNED' && ['ACTIVE', 'REVIEWING'].includes(version.term!.status) && new Date() <= reviewWindow.deadline)),
        canAppeal: !!publication && version.term?.status !== 'CLOSED' && new Date() <= appealWindow.deadline,
        effectiveDeadlines: { submission: submissionWindow, review: reviewWindow, appeal: appealWindow },
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
            return { ...live, verifiedData: null, verificationNote: null, suggestionReason: null, officialScore: published?.officialScore ?? null, officialReason: published?.officialReason ?? null, status: published ? 'FINALIZED' : 'NEEDS_VERIFICATION', finalizedAt: published?.finalizedAt ?? null, finalReviewerId: null };
          })(),
        })),
      })),
    };
  }

  async saveSelfAssessment(studentId: string, termId: string, criterionId: string, body: { score?: number | null; note?: string }) {
    await this.ensureStudentSubmissionOpen(studentId, termId);
    const criterion = await this.getCriterion(termId, criterionId);
    await this.ensureSubmissionEditable(studentId, termId, criterion.rubricVersionId!);
    this.validateScore(body.score, criterion.maxScore, 'Điểm tự đánh giá');
    const assessment = await this.workflow.studentEdit(studentId, termId, tx => tx.criterionAssessment.upsert({
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
    }));
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
    await this.ensureStudentSubmissionOpen(studentId, termId);
    const version = await this.prisma.rubricVersion.findFirst({ where: { termId, status: 'PUBLISHED' }, include: { criteria: true } });
    if (!version) throw new BadRequestException('Kỳ này chưa có rubric được ban hành');
    await this.ensureSubmissionEditable(studentId, termId, version.id);
    const criteriaById = new Map(version.criteria.map((criterion) => [criterion.id, criterion]));
    for (const item of scores) {
      const criterion = criteriaById.get(item.criterionId);
      if (!criterion) throw new BadRequestException(`Tiêu chí ${item.criterionId} không thuộc rubric đang áp dụng`);
      this.validateScore(item.score, criterion.maxScore, `Điểm tự đánh giá mục ${criterion.code}`);
    }
    await this.workflow.studentEdit(studentId, termId, async tx => { for (const item of scores) await tx.criterionAssessment.upsert({
      where: { studentId_termId_criterionId: { studentId, termId, criterionId: item.criterionId } },
      create: { studentId, termId, criterionId: item.criterionId, selfScore: item.score },
      update: { selfScore: item.score },
    }); });
    return this.getMine(studentId, termId);
  }

  async preflight(studentId: string, termId: string) {
    const version = await this.prisma.rubricVersion.findFirst({ where: { termId, status: 'PUBLISHED' }, include: { categories: { include: { criteria: true } } } });
    if (!version) return { canSubmit: false, blockers: ['Kỳ chưa có bộ tiêu chí được ban hành'], warnings: [], completedCriteria: 0, totalCriteria: 0 };

    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      select: { evidenceBasisWorkflowEnabled: true },
    });
    const isNewWorkflow = term?.evidenceBasisWorkflowEnabled ?? false;

    const [assessments, drafts, effective, attendances, academicGroundings, clubGroundings] = await Promise.all([
      this.prisma.criterionAssessment.findMany({ where: { studentId, termId, criterion: { rubricVersionId: version.id } } }),
      this.prisma.evidence.findMany({ where: { studentId, termId, status: EvidenceStatus.DRAFT }, include: { files: true } }),
      this.deadlines.resolve(termId, studentId, DeadlineExtensionType.SUBMISSION),
      this.prisma.activityParticipant.findMany({ where: { studentId, status: 'CONFIRMED', activity: { termId } }, include: { activity: true } }),
      this.prisma.academicGrounding.findMany({ where: { studentId, termId, status: 'ACTIVE' } }),
      this.prisma.clubLeadershipGrounding.findMany({ where: { studentId, termId, status: 'ACTIVE' } }),
    ]);
    const byCriterion = new Map(assessments.map(row => [row.criterionId, row]));
    const blockers: string[] = [];
    const warnings: string[] = [];
    const missing = version.categories.flatMap(category => category.criteria).filter(criterion => byCriterion.get(criterion.id)?.selfScore == null);
    if (missing.length) blockers.push(`Còn ${missing.length} tiêu chí chưa tự đánh giá`);
    for (const category of version.categories) {
      const sum = category.criteria.reduce((total, criterion) => total + (byCriterion.get(criterion.id)?.selfScore ?? 0), 0);
      if (sum > category.maxScore) blockers.push(`${category.name}: tổng điểm ${sum} vượt trần ${category.maxScore}`);
    }

    const incompleteDrafts = drafts.filter(evidence => {
      if (evidence.files.length > 0) return false;
      if (isNewWorkflow && evidence.description && evidence.description.trim().length >= 10) return false;
      return true;
    });
    if (incompleteDrafts.length) {
      blockers.push(`Có ${incompleteDrafts.length} minh chứng nháp chưa có tệp hoặc thiếu mô tả chi tiết (tối thiểu 10 ký tự)`);
    }

    const evidenceCriterionIds = new Set(drafts.filter(evidence => evidence.files.length || (isNewWorkflow && evidence.description?.trim().length >= 10)).flatMap(evidence => evidence.criterionAssessmentId ? [evidence.criterionAssessmentId] : []));
    const confirmedActivityCriterionIds = new Set(attendances.map(a => a.activity?.criterionId).filter(Boolean) as string[]);
    const academicGroundingCodes = new Set(academicGroundings.map(g => g.criterionCode));
    const clubGroundingCodes = new Set(clubGroundings.map(g => g.criterionCode));

    const activityWithoutEvidence = version.categories.flatMap(category => category.criteria).filter(criterion => {
      const config = criterion.scoringConfig as Record<string, unknown> | null;
      const score = byCriterion.get(criterion.id)?.selfScore ?? 0;
      const assessmentId = byCriterion.get(criterion.id)?.id;
      if (score <= 0) return false;

      // Nếu đã có điểm danh xác nhận hoặc căn cứ học vụ / CLB tương ứng -> không cảnh báo thiếu minh chứng
      if (confirmedActivityCriterionIds.has(criterion.id)) return false;
      if (academicGroundingCodes.has(criterion.code)) return false;
      if (clubGroundingCodes.has(criterion.code)) return false;

      return ['activity_threshold', 'community_activity_tier', 'verified_boolean', 'award_tier'].includes(String(config?.kind)) && (!assessmentId || !evidenceCriterionIds.has(assessmentId));
    });
    if (activityWithoutEvidence.length) warnings.push(`${activityWithoutEvidence.length} tiêu chí có điểm nhưng chưa gắn minh chứng nháp`);
    try { await this.ensureStudentSubmissionOpen(studentId, termId); } catch (error: any) { blockers.push(error?.message || 'Không còn quyền nộp phiếu'); }
    return { canSubmit: blockers.length === 0, blockers, warnings, completedCriteria: version.categories.flatMap(category => category.criteria).length - missing.length, totalCriteria: version.categories.flatMap(category => category.criteria).length, effectiveDeadline: effective.deadline, deadlineSource: effective.source };
  }

  async submitSelfAssessment(studentId: string, termId: string) {
    await this.ensureStudentSubmissionOpen(studentId, termId);
    const preflight = await this.preflight(studentId, termId);
    if (!preflight.canSubmit) throw new BadRequestException({ message: preflight.blockers.join('; '), blockers: preflight.blockers, warnings: preflight.warnings });
    const version = await this.prisma.rubricVersion.findFirst({ where: { termId, status: 'PUBLISHED' }, include: { criteria: true } });
    if (!version) throw new BadRequestException('Kỳ này chưa có rubric được ban hành');
    await this.ensureSubmissionEditable(studentId, termId, version.id);

    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      select: { evidenceBasisWorkflowEnabled: true },
    });
    const isNewWorkflow = term?.evidenceBasisWorkflowEnabled ?? false;

    const drafts = await this.prisma.evidence.findMany({ where: { studentId, termId, status: EvidenceStatus.DRAFT }, include: { files: true } });
    const incomplete = drafts.find((evidence) => {
      if (evidence.files.length > 0) return false;
      if (isNewWorkflow && evidence.description && evidence.description.trim().length >= 10) return false;
      return true;
    });
    if (incomplete) {
      if (isNewWorkflow) {
        throw new BadRequestException(`Minh chứng “${incomplete.declaredActivityName || 'Chưa đặt tên'}” chưa có tệp đính kèm và chưa có mô tả chi tiết (tối thiểu 10 ký tự); hãy bổ sung tệp hoặc mô tả trước khi nộp`);
      } else {
        throw new BadRequestException(`Minh chứng “${incomplete.declaredActivityName || 'Chưa đặt tên'}” chưa có tệp; hãy bổ sung tệp hoặc xóa hồ sơ nháp trước khi nộp phiếu`);
      }
    }

    return this.workflow.studentEdit(studentId, termId, async tx => {
      const currentDrafts = await tx.evidence.findMany({ where: { studentId, termId, status: 'DRAFT' }, include: { files: true } });
      if (currentDrafts.some(e => !e.files.length && (!isNewWorkflow || !e.description || e.description.trim().length < 10))) {
        throw new BadRequestException('Có minh chứng nháp chưa có tệp hoặc chưa có mô tả hợp lệ');
      }

      const submission = await tx.assessmentSubmission.upsert({
        where: { studentId_termId_rubricVersionId: { studentId, termId, rubricVersionId: version.id } },
        create: { studentId, termId, rubricVersionId: version.id, status: 'SUBMITTED', submittedAt: new Date(), returnedAt: null, returnReason: null, returnedById: null },
        update: { status: 'SUBMITTED', submittedAt: new Date(), returnedAt: null, returnReason: null, returnedById: null },
      });

      // Tự động đồng bộ căn cứ học vụ (nếu có) khi sinh viên nộp phiếu
      await this.syncStudentGrounding(tx, studentId, termId, version.id);

      for (const evidence of currentDrafts) {
        const hasFiles = evidence.files.length > 0;
        if (hasFiles) {
          await tx.evidence.update({ where: { id: evidence.id }, data: { status: EvidenceStatus.PROCESSING, submittedAt: new Date() } });
          await tx.aiProcessingJob.create({ data: { evidenceId: evidence.id } });
        } else {
          // Kỳ mới cho phép 0 file khi có mô tả: chuyển sang NEEDS_HUMAN_REVIEW, KHÔNG tạo AI job
          await tx.evidence.update({ where: { id: evidence.id }, data: { status: EvidenceStatus.NEEDS_HUMAN_REVIEW, submittedAt: new Date() } });
        }
      }

      await tx.auditLog.create({ data: { userId: studentId, action: 'ASSESSMENT_SUBMITTED', entityType: 'AssessmentSubmission', entityId: submission.id, newValue: { status: 'SUBMITTED', rubricVersionId: version.id, evidenceCount: currentDrafts.length } } });
      return { submission, submittedEvidenceCount: currentDrafts.length };
    });
  }

  async returnSelfAssessment(staff: { id: string; role: Role; facultyId?: string | null }, studentId: string, termId: string, reason: string) {
    await this.workflow.scope(staff, studentId, termId);
    if (!reason?.trim()) throw new BadRequestException('Cần ghi lý do trả phiếu cho sinh viên');
    const submission = await this.prisma.assessmentSubmission.findFirst({ where: { studentId, termId, status: 'SUBMITTED' } });
    if (!submission) throw new NotFoundException('Không tìm thấy phiếu đang chờ xử lý');
    const evidenceIds = (await this.prisma.evidence.findMany({ where: { studentId, termId, status: { notIn: [EvidenceStatus.APPROVED, EvidenceStatus.WITHDRAWN] } }, select: { id: true } })).map((item) => item.id);
    return this.workflow.edit(staff, studentId, termId, async (tx) => {
      const current = await tx.assessmentSubmission.findUnique({ where: { id: submission.id } });
      if (current?.status !== 'SUBMITTED') throw new ConflictException('Phiếu vừa thay đổi; hãy tải lại');
      await tx.notification.create({ data: { userId: studentId, type: 'ASSESSMENT_RETURNED', eventKey: 'ASSESSMENT_RETURNED', dedupeKey: `assessment-return:${submission.id}:${current?.updatedAt.toISOString()}`, title: 'Phiếu rèn luyện cần chỉnh sửa', content: reason.trim(), targetPath: `/student/scores?termId=${termId}`, metadata: { studentId, termId } } });
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
    await this.workflow.scope(staff, studentId, termId);
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
    const handoff = staff.role === Role.ADMIN ? await this.prisma.assessmentHandoff.findUnique({ where: { studentId_termId: { studentId, termId } } }) : null;
    const sentSnapshot = handoff?.status === 'SENT' ? handoff.snapshot as any : null;
    const readiness = result.term?.workflowEnabled && staff.role === Role.STAFF ? await this.workflow.list(staff, termId, new WorkflowQueryDto(), true) : null;
    const row = readiness?.items.find(r => r.studentId === studentId);

    return {
      ...result,
      permissions: { ...result.permissions, canReview: staff.role === 'STAFF' && result.permissions?.canReview, canSend: row?.ready ?? false, sendBlockers: row?.blockers ?? [] },
      resultSource: sentSnapshot ? 'HANDOFF_SNAPSHOT' : 'WORKING',
      handoffRevision: handoff?.revision ?? null,
      categories: sentSnapshot ? sentSnapshot.categories.map((category: any) => ({ ...category, criteria: category.criteria.map((criterion: any) => ({ ...criterion, assessment: criterion.assessment ? { ...criterion.assessment, evidences: byCriterion.get(criterion.id)?.evidences ?? [] } : null })) })) : result.categories.map((category) => ({
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
    await this.workflow.scope(staff, studentId, termId);
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
    await this.workflow.scope(staff, studentId, termId);
    await this.ensureWritable(termId);
    if (!body.note?.trim()) throw new BadRequestException('Cần ghi căn cứ xác minh');
    const criterion = await this.getCriterion(termId, criterionId);
    validateVerifiedData(criterion.scoringConfig as Record<string, unknown> | null, body.data, criterion.maxScore);
    await this.ensureSubmittedForStaffReview(studentId, termId, criterion.rubricVersionId!);
    return this.workflow.edit(staff, studentId, termId, async (tx) => {
    if (!await tx.assessmentSubmission.count({ where: { studentId, termId, status: 'SUBMITTED' } })) throw new BadRequestException('Sinh viên chưa nộp phiếu');
    const config = criterion.scoringConfig as Record<string, unknown> | null;
    const verifiedData = { ...body.data };
    let evaluation: { status: 'READY_FOR_REVIEW' | 'NEEDS_VERIFICATION'; suggestedScore: number | null; reason: string };

    if (config && ['activity_threshold', 'community_activity_tier'].includes(String(config.kind))) {
      const aggregation = await aggregateStudentActivitySources(tx, { studentId, termId, criterionId });
      Object.assign(verifiedData, aggregation.verifiedDataUpdates);
      evaluation = aggregation.evaluation;
    } else {
      evaluation = evaluateRubricCriterion(criterion.maxScore, criterion.scoringConfig, verifiedData);
    }
    const assessment = await tx.criterionAssessment.upsert({
      where: { studentId_termId_criterionId: { studentId, termId, criterionId } },
      create: {
        studentId,
        termId,
        criterionId,
        verifiedData: verifiedData as Prisma.InputJsonValue,
        academicGroundingId: null,
        verificationNote: body.note.trim(),
        suggestedScore: evaluation.suggestedScore,
        suggestionReason: evaluation.reason,
        status: evaluation.status,
      },
      update: {
        verifiedData: verifiedData as Prisma.InputJsonValue,
        academicGroundingId: null,
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
    await this.workflow.scope(staff, studentId, termId);
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

  /**
   * Xem trước bảng chốt 16 tiêu chí của một phiếu sinh viên
   */
  async previewFinalizeStudent(
    staff: { id: string; role: Role; facultyId?: string | null },
    studentId: string,
    termId: string,
  ) {
    await this.workflow.scope(staff, studentId, termId);
    const version = await this.prisma.rubricVersion.findFirst({
      where: { termId, status: 'PUBLISHED' },
      include: { criteria: true },
      orderBy: { version: 'desc' },
    });
    if (!version) throw new NotFoundException('Kỳ này chưa có bộ tiêu chí được ban hành');

    const submission = await this.prisma.assessmentSubmission.findFirst({
      where: { studentId, termId, status: 'SUBMITTED' },
    });
    const handoff = await this.prisma.assessmentHandoff.findUnique({
      where: { studentId_termId: { studentId, termId } },
    });

    const blockers: string[] = [];

    if (!submission) {
      blockers.push('Sinh viên chưa nộp phiếu rèn luyện');
    }
    if (handoff?.status === 'SENT') {
      blockers.push('Phiếu sinh viên đã được gửi lên CTSV/Admin (SENT)');
    }
    if (handoff?.status === 'EXCLUDED') {
      blockers.push('Sinh viên đã bị ghi nhận không nộp hoặc loại trừ');
    }

    // Chặn cả hai trạng thái NEEDS_HUMAN_REVIEW và NEEDS_SUPPLEMENT + các trạng thái chưa xử lý khác (Point 3)
    const pendingEvidences = await this.prisma.evidence.findMany({
      where: {
        studentId,
        termId,
        status: { in: [...unresolvedEvidenceStatuses] as any },
      },
      select: { id: true, status: true, declaredActivityName: true },
    });

    const needsHumanReviewCount = pendingEvidences.filter((e) => e.status === EvidenceStatus.NEEDS_HUMAN_REVIEW).length;
    const needsSupplementCount = pendingEvidences.filter((e) => e.status === EvidenceStatus.NEEDS_SUPPLEMENT).length;

    if (pendingEvidences.length > 0) {
      blockers.push(
        `Còn ${pendingEvidences.length} minh chứng chưa giải quyết xong (${needsHumanReviewCount} chờ xem xét, ${needsSupplementCount} cần bổ sung giấy tờ)`,
      );
    }

    const pendingAppeals = await this.prisma.appeal.count({
      where: { studentId, termId, status: 'PENDING' },
    });
    if (pendingAppeals > 0) {
      blockers.push(`Còn ${pendingAppeals} khiếu nại đang chờ xử lý`);
    }

    const assessments = await this.prisma.criterionAssessment.findMany({
      where: { studentId, termId, criterion: { rubricVersionId: version.id } },
      include: { criterion: true },
    });
    const byCriterionId = new Map(assessments.map((a) => [a.criterionId, a]));

    const criteriaSummary = version.criteria
      .sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true }))
      .map((criterion) => {
        const ca = byCriterionId.get(criterion.id);
        const isFinalized = ca?.status === CriterionAssessmentStatus.FINALIZED;
        const isReady = ca?.status === CriterionAssessmentStatus.READY_FOR_REVIEW && ca.suggestedScore !== null;
        const currentOfficial = ca?.officialScore ?? null;
        const suggested = ca?.suggestedScore ?? null;
        const projectedScore = isFinalized ? currentOfficial : isReady ? suggested : null;

        let statusText: 'ALREADY_FINALIZED' | 'READY_TO_FINALIZE' | 'BLOCKED';
        if (isFinalized) {
          statusText = 'ALREADY_FINALIZED';
        } else if (isReady) {
          statusText = 'READY_TO_FINALIZE';
        } else {
          statusText = 'BLOCKED';
          blockers.push(`Tiêu chí ${criterion.code} (${criterion.name}): Chưa có căn cứ xác minh để đề xuất điểm`);
        }

        return {
          criterionId: criterion.id,
          id: criterion.id,
          code: criterion.code,
          name: criterion.name,
          maxScore: criterion.maxScore,
          selfScore: ca?.selfScore ?? null,
          suggestedScore: suggested,
          officialScore: currentOfficial,
          projectedScore,
          status: statusText,
          canFinalize: isReady || isFinalized,
          reason: ca?.suggestionReason || ca?.verificationNote || (isFinalized ? 'Đã chốt' : 'Chưa có điểm gợi ý'),
          verificationNote: ca?.verificationNote ?? null,
        };
      });

    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, studentCode: true, fullName: true, class: { select: { code: true } } },
    });

    return {
      student,
      canFinalize: blockers.length === 0,
      blockers,
      warnings: [],
      criteria: criteriaSummary,
      criteriaSummary,
      totalProjectedScore: criteriaSummary.reduce((sum, c) => sum + (c.projectedScore ?? 0), 0),
    };
  }

  /**
   * Chốt toàn bộ các tiêu chí đủ điều kiện của một phiếu sinh viên
   */
  async finalizeStudentAssessment(
    staff: { id: string; role: Role; facultyId?: string | null },
    studentId: string,
    termId: string,
  ) {
    await this.workflow.scope(staff, studentId, termId);
    await this.ensureWritable(termId);

    return this.workflow.edit(staff, studentId, termId, async (tx) => {
      const version = await tx.rubricVersion.findFirst({
        where: { termId, status: 'PUBLISHED' },
        include: { criteria: true },
        orderBy: { version: 'desc' },
      });
      if (!version) throw new NotFoundException('Kỳ này chưa có bộ tiêu chí');

      // Tự động đồng bộ căn cứ học vụ
      await this.syncStudentGrounding(tx, studentId, termId, version.id);

      const submission = await tx.assessmentSubmission.findFirst({
        where: { studentId, termId, status: 'SUBMITTED' },
      });
      if (!submission) throw new BadRequestException('Sinh viên chưa nộp phiếu rèn luyện');

      const handoff = await tx.assessmentHandoff.findUnique({
        where: { studentId_termId: { studentId, termId } },
      });
      if (handoff?.status === 'SENT') throw new BadRequestException('Phiếu đã được gửi lên CTSV/Admin; không thể chỉnh sửa');
      if (handoff?.status === 'EXCLUDED') throw new BadRequestException('Sinh viên đã bị loại trừ');

      // Chặn nếu còn minh chứng chưa giải quyết (chặn cả NEEDS_HUMAN_REVIEW và NEEDS_SUPPLEMENT)
      const pendingEvidences = await tx.evidence.count({
        where: {
          studentId,
          termId,
          status: { in: [...unresolvedEvidenceStatuses] as any },
        },
      });
      if (pendingEvidences > 0) {
        throw new BadRequestException(`Còn ${pendingEvidences} minh chứng đang chờ xử lý (chờ xem xét hoặc bổ sung); không thể chốt phiếu`);
      }

      const pendingAppeals = await tx.appeal.count({
        where: { studentId, termId, status: 'PENDING' },
      });
      if (pendingAppeals > 0) {
        throw new BadRequestException(`Còn ${pendingAppeals} khiếu nại đang chờ giải quyết; không thể chốt phiếu`);
      }

      const assessments = await tx.criterionAssessment.findMany({
        where: { studentId, termId, criterion: { rubricVersionId: version.id } },
      });
      const byCriterionId = new Map(assessments.map((a) => [a.criterionId, a]));

      const notReadyCriteria: string[] = [];
      for (const criterion of version.criteria) {
        const ca = byCriterionId.get(criterion.id);
        if (ca?.status === CriterionAssessmentStatus.FINALIZED) continue;
        if (!ca || ca.status !== CriterionAssessmentStatus.READY_FOR_REVIEW || ca.suggestedScore === null) {
          notReadyCriteria.push(criterion.code);
        }
      }

      if (notReadyCriteria.length > 0) {
        throw new BadRequestException(
          `Các tiêu chí [${notReadyCriteria.join(', ')}] chưa có điểm đề xuất hợp lệ để chốt`,
        );
      }

      // Chốt tất cả các tiêu chí READY_FOR_REVIEW
      let finalizedCount = 0;
      for (const criterion of version.criteria) {
        const ca = byCriterionId.get(criterion.id);
        if (ca && ca.status === CriterionAssessmentStatus.READY_FOR_REVIEW && ca.suggestedScore !== null) {
          await tx.criterionAssessment.update({
            where: { id: ca.id },
            data: {
              officialScore: ca.suggestedScore,
              officialReason: ca.officialReason?.trim() || 'Cán bộ xác nhận điểm đề xuất theo căn cứ đã xác minh',
              status: CriterionAssessmentStatus.FINALIZED,
              finalReviewerId: staff.id,
              finalizedAt: new Date(),
            },
          });
          finalizedCount++;
        }
      }

      await tx.auditLog.create({
        data: {
          userId: staff.id,
          action: 'STUDENT_ASSESSMENT_FINALIZED',
          entityType: 'AssessmentHandoff',
          entityId: handoff?.id || `${studentId}:${termId}`,
          oldValue: null,
          newValue: { studentId, termId, finalizedCount },
        },
      });

      const allAssessments = await tx.criterionAssessment.findMany({
        where: { studentId, termId, criterion: { rubricVersionId: version.id } },
        select: { officialScore: true },
      });
      const officialTotalScore = allAssessments.reduce((sum, a) => sum + (a.officialScore ?? 0), 0);

      return {
        success: true,
        studentId,
        termId,
        finalizedCount,
        officialTotalScore,
        message: `Đã chốt thành công ${finalizedCount} tiêu chí của sinh viên`,
      };
    });
  }

  /**
   * Chốt phiếu hàng loạt (Tối đa 100 phiếu, transaction riêng biệt từng phiếu)
   * TUYỆT ĐỐI KHÔNG TỰ ĐỘNG GỬI ADMIN HOẶC CÔNG BỐ
   */
  async batchFinalizeAssessments(
    staff: { id: string; role: Role; facultyId?: string | null },
    termId: string,
    studentIds: string[],
  ) {
    if (!studentIds || !studentIds.length) {
      throw new BadRequestException('Danh sách sinh viên không được rỗng');
    }
    if (studentIds.length > 100) {
      throw new BadRequestException('Chỉ được chọn tối đa 100 phiếu mỗi lần chốt hàng loạt');
    }

    await this.ensureWritable(termId);

    const version = await this.prisma.rubricVersion.findFirst({
      where: { termId, status: 'PUBLISHED' },
      include: { criteria: true },
      orderBy: { version: 'desc' },
    });
    if (!version) throw new NotFoundException('Kỳ này chưa có bộ tiêu chí được ban hành');

    const uniqueIds = [...new Set(studentIds)];
    const results: Array<{
      studentId: string;
      studentCode?: string;
      fullName?: string;
      success: boolean;
      finalizedCount: number;
      blockers: string[];
    }> = [];

    let successCount = 0;
    let failureCount = 0;

    for (const studentId of uniqueIds) {
      try {
        const studentInfo = await this.prisma.user.findUnique({
          where: { id: studentId },
          select: { studentCode: true, fullName: true },
        });

        // Mỗi phiếu xử lý trong một transaction độc lập (Rule 6)
        const outcome = await this.prisma.$transaction(
          async (tx) => {
            await this.workflow.assertEditable(tx, staff, studentId, termId);

            const handoff = await tx.assessmentHandoff.findUnique({
              where: { studentId_termId: { studentId, termId } },
            });
            if (!handoff) throw new BadRequestException('Sinh viên không thuộc roster kỳ');
            if (handoff.status === 'SENT') throw new BadRequestException('Phiếu đã gửi CTSV');
            if (handoff.status === 'EXCLUDED') throw new BadRequestException('Sinh viên đã bị loại trừ');

            const submission = await tx.assessmentSubmission.findFirst({
              where: { studentId, termId, status: 'SUBMITTED' },
            });
            if (!submission) throw new BadRequestException('Sinh viên chưa nộp phiếu');

            // Đồng bộ grounding
            await this.syncStudentGrounding(tx, studentId, termId, version.id);

            // Kiểm tra minh chứng chờ (chặn cả NEEDS_HUMAN_REVIEW và NEEDS_SUPPLEMENT)
            const pendingEvidences = await tx.evidence.count({
              where: {
                studentId,
                termId,
                status: { in: [...unresolvedEvidenceStatuses] as any },
              },
            });
            if (pendingEvidences > 0) {
              throw new BadRequestException(`Còn ${pendingEvidences} minh chứng chưa giải quyết`);
            }

            const pendingAppeals = await tx.appeal.count({
              where: { studentId, termId, status: 'PENDING' },
            });
            if (pendingAppeals > 0) {
              throw new BadRequestException(`Còn ${pendingAppeals} khiếu nại chưa giải quyết`);
            }

            const assessments = await tx.criterionAssessment.findMany({
              where: { studentId, termId, criterion: { rubricVersionId: version.id } },
            });
            const byCriterionId = new Map(assessments.map((a) => [a.criterionId, a]));

            const notReady: string[] = [];
            for (const criterion of version.criteria) {
              const ca = byCriterionId.get(criterion.id);
              if (ca?.status === CriterionAssessmentStatus.FINALIZED) continue;
              if (!ca || ca.status !== CriterionAssessmentStatus.READY_FOR_REVIEW || ca.suggestedScore === null) {
                notReady.push(criterion.code);
              }
            }

            if (notReady.length > 0) {
              throw new BadRequestException(`Thiếu điểm đề xuất tiêu chí [${notReady.join(', ')}]`);
            }

            let finalizedCount = 0;
            for (const criterion of version.criteria) {
              const ca = byCriterionId.get(criterion.id);
              if (ca && ca.status === CriterionAssessmentStatus.READY_FOR_REVIEW && ca.suggestedScore !== null) {
                await tx.criterionAssessment.update({
                  where: { id: ca.id },
                  data: {
                    officialScore: ca.suggestedScore,
                    officialReason: ca.officialReason?.trim() || 'Cán bộ xác nhận điểm đề xuất theo căn cứ đã xác minh',
                    status: CriterionAssessmentStatus.FINALIZED,
                    finalReviewerId: staff.id,
                    finalizedAt: new Date(),
                  },
                });
                finalizedCount++;
              }
            }

            await tx.auditLog.create({
              data: {
                userId: staff.id,
                action: 'BATCH_STUDENT_ASSESSMENT_FINALIZED',
                entityType: 'AssessmentHandoff',
                entityId: handoff.id,
                oldValue: null,
                newValue: { studentId, termId, finalizedCount },
              },
            });

            return { finalizedCount };
          },
          { timeout: 15000 },
        );

        results.push({
          studentId,
          studentCode: studentInfo?.studentCode || undefined,
          fullName: studentInfo?.fullName || undefined,
          success: true,
          finalizedCount: outcome.finalizedCount,
          blockers: [],
        });
        successCount++;
      } catch (err: any) {
        results.push({
          studentId,
          success: false,
          finalizedCount: 0,
          blockers: [err.message || 'Lỗi khi chốt phiếu'],
        });
        failureCount++;
      }
    }

    return {
      totalRequested: uniqueIds.length,
      successCount,
      failureCount,
      results,
    };
  }
}
