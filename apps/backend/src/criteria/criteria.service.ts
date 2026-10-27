import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateTermDto, UpdateTermDto, CreateCriterionDto, UpdateCriterionDto } from './dto/criteria.dto';
import { Prisma, RubricVersionStatus, TermStatus } from '@prisma/client';
import { WorkflowService } from '../evaluation-workflow/workflow.service';
import { DUT_RUBRIC_CATEGORIES, DUT_RUBRIC_CRITERIA } from './dut-rubric';

type RubricDefinition = {
  categories: Array<{
    code: string; name: string; maxScore: number; position: number;
    criteria: Array<{ code: string; name: string; description: string; maxScore: number; scoringConfig: Record<string, unknown> }>;
  }>;
};

const compareCriterionCodes = <T extends { code: string }>(criteria: T[]) =>
  [...criteria].sort((left, right) => left.code.localeCompare(right.code, 'vi', { numeric: true }));

function validateRubricDefinition(value: unknown): asserts value is RubricDefinition {
  if (!value || typeof value !== 'object' || !Array.isArray((value as any).categories) || !(value as any).categories.length) {
    throw new BadRequestException('Rubric phải có ít nhất một khung điểm');
  }
  const definition = value as RubricDefinition;
  const categoryCodes = new Set<string>();
  const allCriterionCodes = new Set<string>();
  let total = 0;
  const allowedKinds = new Set(['manual_verified', 'attendance_penalty', 'group_penalty', 'conduct_penalty', 'leadership_duty', 'academic_effort', 'verified_boolean', 'award_tier', 'activity_threshold', 'all_conditions', 'community_activity_tier']);
  for (const category of definition.categories) {
    if (!category.code?.trim() || !category.name?.trim() || categoryCodes.has(category.code)) throw new BadRequestException('Mã và tên khung phải có giá trị, mã khung không được trùng');
    categoryCodes.add(category.code);
    if (!Number.isFinite(category.maxScore) || category.maxScore < 0 || !Array.isArray(category.criteria) || category.criteria.length === 0) throw new BadRequestException(`Khung ${category.code} có cấu hình điểm không hợp lệ`);
    let categoryTotal = 0;
    for (const criterion of category.criteria) {
      if (!criterion.code?.trim() || !criterion.name?.trim() || !criterion.description?.trim() || allCriterionCodes.has(criterion.code)) throw new BadRequestException(`Mã, tên, mô tả tiêu chí trong ${category.code} phải hợp lệ và mã không được trùng`);
      allCriterionCodes.add(criterion.code);
      if (!Number.isFinite(criterion.maxScore) || criterion.maxScore < 0) throw new BadRequestException(`Điểm tối đa của mục ${criterion.code} không hợp lệ`);
      const config = criterion.scoringConfig;
      if (!config || typeof config.kind !== 'string' || !allowedKinds.has(config.kind) || !Array.isArray(config.requiredData)) throw new BadRequestException(`Quy tắc tính điểm mục ${criterion.code} chưa hợp lệ hoặc chưa được Backend hỗ trợ`);
      categoryTotal += criterion.maxScore;
    }
    if (Math.abs(categoryTotal - category.maxScore) > 0.001) throw new BadRequestException(`Tổng điểm tiêu chí của khung ${category.code} (${categoryTotal}) phải bằng ${category.maxScore}`);
    total += category.maxScore;
  }
  if (Math.abs(total - 100) > 0.001) throw new BadRequestException(`Tổng điểm toàn rubric phải bằng 100; hiện là ${total}`);
}

@Injectable()
export class CriteriaService {
  constructor(private prisma: PrismaService, private workflow: WorkflowService) {}

  // ==========================================
  // CRITERIA
  // ==========================================
  async getCriteria(termId?: string) {
    if (termId) return this.getRubric(termId);
    return this.prisma.criterion.findMany({
      where: { rubricVersionId: null },
      orderBy: { code: 'asc' },
    });
  }

  async getRubric(termId: string) {
    const version = await this.prisma.rubricVersion.findFirst({
      where: { termId, status: 'PUBLISHED' },
      include: {
        term: { select: { id: true, name: true, status: true } },
        categories: {
          orderBy: { position: 'asc' },
          include: { criteria: true },
        },
      },
      orderBy: { version: 'desc' },
    });
    if (!version) return { rubricVersion: null, termId, categories: [], criteria: [] };
    return {
      rubricVersion: { id: version.id, version: version.version, status: version.status, source: version.source, publishedAt: version.publishedAt },
      term: version.term,
      categories: version.categories.map(({ id, code, name, maxScore, position, criteria }) => ({ id, key: code, name, maxScore, position, criteria: compareCriterionCodes(criteria) })),
      criteria: version.categories.flatMap((category) => compareCriterionCodes(category.criteria)),
    };
  }

  async getRubricTemplates() {
    return this.prisma.rubricTemplate.findMany({
      orderBy: { createdAt: 'asc' },
      include: { versions: { orderBy: { version: 'desc' }, select: { id: true, version: true, status: true, publishedAt: true, sourceDescription: true, changeNote: true, createdAt: true } } },
    });
  }

  async getRubricTemplateVersion(versionId: string) {
    const version = await this.prisma.rubricTemplateVersion.findUnique({ where: { id: versionId }, include: { template: true } });
    if (!version) throw new NotFoundException('Không tìm thấy phiên bản bộ tiêu chí chuẩn');
    return version;
  }

  async createRubricTemplateDraft() {
    const template = await this.prisma.rubricTemplate.findUnique({ where: { code: 'DUT_DEFAULT' } });
    if (!template) throw new NotFoundException('Chưa có bộ tiêu chí chuẩn. Hãy áp dụng migration rubric trước.');
    const latestDraft = await this.prisma.rubricTemplateVersion.findFirst({ where: { templateId: template.id, status: RubricVersionStatus.DRAFT }, orderBy: { version: 'desc' } });
    if (latestDraft) throw new BadRequestException('Đã có bản nháp bộ chuẩn. Hãy tiếp tục chỉnh bản nháp đó.');
    const current = await this.prisma.rubricTemplateVersion.findFirst({ where: { templateId: template.id, status: RubricVersionStatus.PUBLISHED }, orderBy: { version: 'desc' } });
    if (!current) throw new NotFoundException('Bộ chuẩn chưa có phiên bản đã ban hành');
    return this.prisma.rubricTemplateVersion.create({
      data: { templateId: template.id, version: (await this.prisma.rubricTemplateVersion.aggregate({ where: { templateId: template.id }, _max: { version: true } }))._max.version! + 1, status: RubricVersionStatus.DRAFT, definition: current.definition as Prisma.InputJsonValue, sourceDescription: `Sao chép từ bộ chuẩn v${current.version}` },
    });
  }

  async updateRubricTemplateDraft(versionId: string, definition: unknown, changeNote?: string) {
    const version = await this.prisma.rubricTemplateVersion.findUnique({ where: { id: versionId } });
    if (!version) throw new NotFoundException('Không tìm thấy phiên bản bộ tiêu chí');
    if (version.status !== RubricVersionStatus.DRAFT) throw new BadRequestException('Chỉ được chỉnh sửa phiên bản Nháp');
    validateRubricDefinition(definition);
    return this.prisma.rubricTemplateVersion.update({ where: { id: versionId }, data: { definition: definition as Prisma.InputJsonValue, changeNote: changeNote?.trim() || null } });
  }

  async publishRubricTemplateDraft(versionId: string) {
    const draft = await this.prisma.rubricTemplateVersion.findUnique({ where: { id: versionId } });
    if (!draft) throw new NotFoundException('Không tìm thấy phiên bản bộ tiêu chí');
    if (draft.status !== RubricVersionStatus.DRAFT) throw new BadRequestException('Chỉ có thể ban hành phiên bản Nháp');
    validateRubricDefinition(draft.definition);
    return this.prisma.$transaction(async (tx) => {
      await tx.rubricTemplateVersion.updateMany({ where: { templateId: draft.templateId, status: RubricVersionStatus.PUBLISHED }, data: { status: RubricVersionStatus.ARCHIVED } });
      return tx.rubricTemplateVersion.update({ where: { id: versionId }, data: { status: RubricVersionStatus.PUBLISHED, publishedAt: new Date() } });
    });
  }

  async getTermRubric(termId: string) {
    const term = await this.prisma.term.findUnique({ where: { id: termId }, select: { id: true, name: true, code: true, status: true } });
    if (!term) throw new NotFoundException('Không tìm thấy kỳ đánh giá');
    const version = await this.prisma.rubricVersion.findFirst({ where: { termId }, orderBy: { version: 'desc' }, include: { sourceTemplateVersion: { select: { id: true, version: true, status: true } }, categories: { orderBy: { position: 'asc' }, include: { criteria: true } } } });
    return { term, rubricVersion: version, definition: version ? { categories: version.categories.map((category) => ({ code: category.code, name: category.name, maxScore: category.maxScore, position: category.position, criteria: compareCriterionCodes(category.criteria).map((criterion) => ({ code: criterion.code, name: criterion.name, description: criterion.description, maxScore: criterion.maxScore, scoringConfig: criterion.scoringConfig })) })) } : null };
  }

  async createTermRubricDraft(termId: string, source: { type: 'DEFAULT' | 'TERM'; sourceTermId?: string }) {
    const term = await this.prisma.term.findUnique({ where: { id: termId } });
    if (!term) throw new NotFoundException('Không tìm thấy kỳ đánh giá');
    if (term.status === TermStatus.CLOSED) throw new BadRequestException('Không thể tạo phiên bản cho kỳ đã chốt');
    const [existingVersions, evidenceCount, assessmentCount] = await Promise.all([
      this.prisma.rubricVersion.count({ where: { termId } }),
      this.prisma.evidence.count({ where: { termId } }),
      this.prisma.criterionAssessment.count({ where: { termId } }),
    ]);
    if (existingVersions) throw new BadRequestException('Kỳ này đã có phiên bản rubric; không thể ghi đè lịch sử');
    if (evidenceCount || assessmentCount) throw new BadRequestException('Kỳ đã có minh chứng hoặc điểm; không thể áp dụng rubric mới hồi tố');
    let definition: unknown;
    let sourceTemplateVersionId: string | undefined;
    let sourceTermCode: string | undefined;
    let sourceLabel: string;
    if (source.type === 'DEFAULT') {
      const template = await this.prisma.rubricTemplate.findUnique({ where: { code: 'DUT_DEFAULT' }, include: { versions: { where: { status: RubricVersionStatus.PUBLISHED }, orderBy: { version: 'desc' }, take: 1 } } });
      const templateVersion = template?.versions[0];
      if (!templateVersion) throw new NotFoundException('Chưa có bộ chuẩn đã ban hành');
      definition = templateVersion.definition;
      sourceTemplateVersionId = templateVersion.id;
      sourceLabel = `DUT_DEFAULT v${templateVersion.version}`;
    } else {
      if (!source.sourceTermId || source.sourceTermId === termId) throw new BadRequestException('Hãy chọn kỳ nguồn hợp lệ');
      const sourceTerm = await this.prisma.term.findUnique({ where: { id: source.sourceTermId } });
      const sourceVersion = await this.prisma.rubricVersion.findFirst({ where: { termId: source.sourceTermId, status: RubricVersionStatus.PUBLISHED }, orderBy: { version: 'desc' }, include: { categories: { orderBy: { position: 'asc' }, include: { criteria: { orderBy: { code: 'asc' } } } } } });
      if (!sourceTerm || !sourceVersion) throw new NotFoundException('Kỳ nguồn chưa có rubric đã ban hành');
      sourceTermCode = sourceTerm.code;
      sourceLabel = `Kế thừa kỳ ${sourceTerm.code} · phiên bản ${sourceVersion.version}`;
      definition = { categories: sourceVersion.categories.map((category) => ({ code: category.code, name: category.name, maxScore: category.maxScore, position: category.position, criteria: category.criteria.map((criterion) => ({ code: criterion.code, name: criterion.name, description: criterion.description, maxScore: criterion.maxScore, scoringConfig: criterion.scoringConfig })) })) };
    }
    validateRubricDefinition(definition);
    await this.prisma.$transaction(async (tx) => this.persistTermRubricDraft(tx, termId, definition as RubricDefinition, sourceLabel, sourceTemplateVersionId, sourceTermCode));
    return this.getTermRubric(termId);
  }

  private async persistTermRubricDraft(tx: Prisma.TransactionClient, termId: string, definition: RubricDefinition, source: string, sourceTemplateVersionId?: string, sourceTermCode?: string) {
    const version = await tx.rubricVersion.create({ data: { termId, version: 1, status: RubricVersionStatus.DRAFT, source, sourceTemplateVersionId, sourceTermCode } });
    for (const category of definition.categories) {
      const createdCategory = await tx.rubricCategory.create({ data: { rubricVersionId: version.id, code: category.code, name: category.name, maxScore: category.maxScore, position: category.position } });
      await tx.criterion.createMany({ data: category.criteria.map((criterion) => ({ rubricVersionId: version.id, categoryId: createdCategory.id, code: criterion.code, name: criterion.name, description: criterion.description, minScore: 0, maxScore: criterion.maxScore, category: category.code, scoringConfig: criterion.scoringConfig as Prisma.InputJsonValue })) });
    }
    return version.id;
  }

  async updateTermRubricDraft(termId: string, definition: unknown, changeNote?: string) {
    validateRubricDefinition(definition);
    const version = await this.prisma.rubricVersion.findFirst({ where: { termId }, orderBy: { version: 'desc' } });
    if (!version) throw new NotFoundException('Kỳ này chưa có bản nháp rubric');
    if (version.status !== RubricVersionStatus.DRAFT) throw new BadRequestException('Chỉ được chỉnh sửa phiên bản Nháp');
    const [term, assessmentCount, evidenceCount] = await Promise.all([
      this.prisma.term.findUnique({ where: { id: termId } }),
      this.prisma.criterionAssessment.count({ where: { termId } }),
      this.prisma.evidence.count({ where: { termId } }),
    ]);
    if (!term) throw new NotFoundException('Không tìm thấy kỳ đánh giá');
    if (term.status === TermStatus.CLOSED) throw new BadRequestException('Kỳ đã chốt');
    if (assessmentCount || evidenceCount) throw new BadRequestException('Đã có đánh giá hoặc minh chứng trong kỳ; không thể thay đổi cấu trúc rubric');
    const normalized = definition as RubricDefinition;
    await this.prisma.$transaction(async (tx) => {
      const criterionIds = (await tx.criterion.findMany({ where: { rubricVersionId: version.id }, select: { id: true } })).map((criterion) => criterion.id);
      await tx.aiSuggestion.updateMany({ where: { criterionId: { in: criterionIds } }, data: { criterionId: null } });
      await tx.review.updateMany({ where: { criterionId: { in: criterionIds } }, data: { criterionId: null } });
      await tx.criterion.deleteMany({ where: { rubricVersionId: version.id } });
      await tx.rubricCategory.deleteMany({ where: { rubricVersionId: version.id } });
      for (const category of normalized.categories) {
        const createdCategory = await tx.rubricCategory.create({ data: { rubricVersionId: version.id, code: category.code, name: category.name, maxScore: category.maxScore, position: category.position } });
        await tx.criterion.createMany({ data: category.criteria.map((criterion) => ({ rubricVersionId: version.id, categoryId: createdCategory.id, code: criterion.code, name: criterion.name, description: criterion.description, minScore: 0, maxScore: criterion.maxScore, category: category.code, scoringConfig: criterion.scoringConfig as Prisma.InputJsonValue })) });
      }
      await tx.rubricVersion.update({ where: { id: version.id }, data: { changeNote: changeNote?.trim() || null } });
    });
    return this.getTermRubric(termId);
  }

  async publishTermRubric(termId: string) {
    const draft = await this.prisma.rubricVersion.findFirst({ where: { termId }, orderBy: { version: 'desc' }, include: { categories: { include: { criteria: true } } } });
    if (!draft) throw new NotFoundException('Kỳ này chưa có bản nháp rubric');
    if (draft.status !== RubricVersionStatus.DRAFT) throw new BadRequestException('Chỉ có thể ban hành phiên bản Nháp');
    if (Math.abs(draft.categories.reduce((sum, category) => sum + category.maxScore, 0) - 100) > 0.001) throw new BadRequestException('Tổng điểm các khung phải bằng 100');
    const definition = { categories: draft.categories.map((category) => ({ ...category, criteria: category.criteria.map((criterion) => ({ ...criterion, scoringConfig: criterion.scoringConfig as Record<string, unknown> })) })) };
    validateRubricDefinition(definition);
    const term = await this.prisma.term.findUnique({ where: { id: termId } });
    if (!term || term.status === TermStatus.CLOSED) throw new BadRequestException('Không thể ban hành rubric cho kỳ đã chốt');
    return this.prisma.rubricVersion.update({ where: { id: draft.id }, data: { status: RubricVersionStatus.PUBLISHED, publishedAt: new Date() } });
  }

  async createCriterion(dto: CreateCriterionDto) {
    const existing = await this.prisma.criterion.findFirst({ where: { code: dto.code, rubricVersionId: null } });
    if (existing) throw new BadRequestException(`Tiêu chí mã ${dto.code} đã tồn tại`);

    return this.prisma.criterion.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        maxScore: dto.maxScore,
        category: dto.category,
      },
    });
  }

  async updateCriterion(id: string, dto: UpdateCriterionDto) {
    const existing = await this.prisma.criterion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy tiêu chí');

    return this.prisma.criterion.update({
      where: { id },
      data: dto,
    });
  }

  async deleteCriterion(id: string) {
    const crit = await this.prisma.criterion.findUnique({ where: { id } });
    if (!crit) throw new NotFoundException('Không tìm thấy tiêu chí');

    await this.prisma.$transaction([
      this.prisma.aiSuggestion.updateMany({ where: { criterionId: id }, data: { criterionId: null } }),
      this.prisma.review.updateMany({ where: { criterionId: id }, data: { criterionId: null } }),
      this.prisma.criterion.delete({ where: { id } }),
    ]);

    return { success: true, message: 'Đã xóa tiêu chí thành công' };
  }

  // ==========================================
  // TERMS
  // ==========================================
  async getTerms() {
    return this.prisma.term.findMany({
      orderBy: { startDate: 'desc' },
      include: { rubricVersions: { select: { id: true, version: true, status: true, publishedAt: true }, orderBy: { version: 'desc' } } },
    });
  }

  async getActiveTerm() {
    const term = await this.prisma.term.findFirst({
      where: { status: TermStatus.ACTIVE },
      orderBy: { startDate: 'desc' },
    });
    if (!term) {
      // Fallback lấy kỳ mới nhất
      return this.prisma.term.findFirst({
        orderBy: { startDate: 'desc' },
      });
    }
    return term;
  }

  async createTerm(dto: CreateTermDto) {
    const existing = await this.prisma.term.findUnique({ where: { code: dto.code } });
    if (existing) throw new BadRequestException(`Kỳ học mã ${dto.code} đã tồn tại`);
    if (dto.status === TermStatus.ACTIVE || dto.status === TermStatus.REVIEWING) throw new BadRequestException('Kỳ mới phải ở trạng thái Sắp diễn ra; chỉ mở kỳ sau khi ban hành bộ tiêu chí');
    const sourceType = dto.rubricSourceType || 'DEFAULT';
    let definition: unknown;
    let sourceTemplateVersionId: string | undefined;
    let sourceTermCode: string | undefined;
    let sourceLabel = '';
    if (sourceType === 'DEFAULT') {
      const template = await this.prisma.rubricTemplate.findUnique({ where: { code: 'DUT_DEFAULT' }, include: { versions: { where: { status: RubricVersionStatus.PUBLISHED }, orderBy: { version: 'desc' }, take: 1 } } });
      const templateVersion = template?.versions[0];
      if (!templateVersion) throw new NotFoundException('Chưa có bộ chuẩn đã ban hành. Hãy áp dụng migration rubric trước.');
      definition = templateVersion.definition;
      sourceTemplateVersionId = templateVersion.id;
      sourceLabel = `DUT_DEFAULT v${templateVersion.version}`;
    } else {
      if (!dto.sourceTermId) throw new BadRequestException('Hãy chọn kỳ nguồn để sao chép rubric');
      const sourceTerm = await this.prisma.term.findUnique({ where: { id: dto.sourceTermId } });
      const sourceVersion = await this.prisma.rubricVersion.findFirst({ where: { termId: dto.sourceTermId, status: RubricVersionStatus.PUBLISHED }, orderBy: { version: 'desc' }, include: { categories: { orderBy: { position: 'asc' }, include: { criteria: { orderBy: { code: 'asc' } } } } } });
      if (!sourceTerm || !sourceVersion) throw new NotFoundException('Kỳ nguồn chưa có rubric đã ban hành');
      definition = { categories: sourceVersion.categories.map((category) => ({ code: category.code, name: category.name, maxScore: category.maxScore, position: category.position, criteria: category.criteria.map((criterion) => ({ code: criterion.code, name: criterion.name, description: criterion.description, maxScore: criterion.maxScore, scoringConfig: criterion.scoringConfig })) })) };
      sourceTermCode = sourceTerm.code;
      sourceLabel = `Kế thừa kỳ ${sourceTerm.code} · phiên bản ${sourceVersion.version}`;
    }
    validateRubricDefinition(definition);
    return this.prisma.$transaction(async (tx) => {
      const term = await tx.term.create({ data: {
        name: dto.name,
        code: dto.code,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        submissionDeadline: new Date(dto.submissionDeadline),
        reviewDeadline: new Date(dto.reviewDeadline),
        appealDeadline: new Date(dto.appealDeadline),
        status: TermStatus.UPCOMING,
      } });
      await this.persistTermRubricDraft(tx, term.id, definition as RubricDefinition, sourceLabel, sourceTemplateVersionId, sourceTermCode);
      return tx.term.findUnique({
        where: { id: term.id },
        include: { rubricVersions: { include: { categories: { include: { criteria: true } } } } },
      });
    });
  }

  async updateTerm(id: string, dto: UpdateTermDto) {
    const existing = await this.prisma.term.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy kỳ học');
    if (existing.status === 'CLOSED') throw new BadRequestException('Kỳ đã chốt chỉ được xem');
    if (dto.status && dto.status !== existing.status) throw new BadRequestException('Sử dụng thao tác mở kỳ, công bố và chốt theo quy trình');
    if (dto.status === TermStatus.ACTIVE) {
      const [publishedRubric, otherActiveTerm] = await Promise.all([
        this.prisma.rubricVersion.findFirst({ where: { termId: id, status: RubricVersionStatus.PUBLISHED }, select: { id: true } }),
        this.prisma.term.findFirst({ where: { status: TermStatus.ACTIVE, id: { not: id } }, select: { id: true } }),
      ]);
      if (!publishedRubric) throw new BadRequestException('Hãy ban hành bộ tiêu chí trước khi mở kỳ');
      if (otherActiveTerm) throw new BadRequestException('Đang có kỳ khác hoạt động; hãy chuyển kỳ đó sang trạng thái phù hợp trước');
    }

    return this.prisma.term.update({
      where: { id },
      data: {
        name: dto.name,
        submissionDeadline: dto.submissionDeadline ? new Date(dto.submissionDeadline) : undefined,
        reviewDeadline: dto.reviewDeadline ? new Date(dto.reviewDeadline) : undefined,
        appealDeadline: dto.appealDeadline ? new Date(dto.appealDeadline) : undefined,
        status: dto.status,
      },
    });
  }

  async closeTerm(id: string, actor: any) {
    const term = await this.prisma.term.findUnique({ where: { id } });
    if (!term) throw new NotFoundException('Không tìm thấy kỳ học');

    return this.workflow.close(actor, id);
  }

  async activateTerm(id: string) {
    const term = await this.prisma.term.findUnique({ where: { id } });
    if (!term) throw new NotFoundException('Không tìm thấy kỳ đánh giá');
    if (term.status === TermStatus.CLOSED) throw new BadRequestException('Kỳ đã chốt, không thể mở lại bằng thao tác này');
    const publishedRubric = await this.prisma.rubricVersion.findFirst({ where: { termId: id, status: RubricVersionStatus.PUBLISHED }, select: { id: true } });
    if (!publishedRubric) throw new BadRequestException('Hãy ban hành bộ tiêu chí trước khi mở kỳ');
    const otherActiveTerm = await this.prisma.term.findFirst({ where: { status: TermStatus.ACTIVE, id: { not: id } }, select: { id: true } });
    if (otherActiveTerm) throw new BadRequestException('Đang có kỳ khác hoạt động; hãy chuyển kỳ đó sang trạng thái phù hợp trước');
    return this.prisma.$transaction(async tx => {
      await this.workflow.lock(tx, id);
      if (term.workflowEnabled) await this.workflow.initialize(tx, id);
      return tx.term.update({ where: { id }, data: { status: TermStatus.ACTIVE } });
    });
  }

  async reopenTerm(id: string, reason: string) {
    throw new BadRequestException('Kỳ đã chốt chỉ được xem; điều chỉnh cần quy trình đính chính riêng');
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Bắt buộc phải có lý do văn bản khi mở lại kỳ học đã chốt');
    }
    const term = await this.prisma.term.findUnique({ where: { id } });
    if (!term) throw new NotFoundException('Không tìm thấy kỳ học');

    return this.prisma.term.update({
      where: { id },
      data: { status: TermStatus.ACTIVE },
    });
  }

  // ==========================================
  // FACULTIES & CLASSES
  // ==========================================
  async getFaculties() {
    return this.prisma.faculty.findMany({
      include: {
        _count: { select: { classes: true, staffs: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  async getClasses(facultyId?: string) {
    return this.prisma.class.findMany({
      where: facultyId ? { facultyId } : undefined,
      include: {
        faculty: { select: { id: true, code: true, name: true } },
        _count: { select: { students: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  async createFaculty(dto: { code: string; name: string }) {
    const existing = await this.prisma.faculty.findUnique({ where: { code: dto.code.trim().toUpperCase() } });
    if (existing) throw new BadRequestException('Mã khoa đã tồn tại');
    return this.prisma.faculty.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
      },
      include: {
        _count: { select: { classes: true, staffs: true } },
      },
    });
  }

  async updateFaculty(id: string, dto: { code?: string; name?: string }) {
    const faculty = await this.prisma.faculty.findUnique({ where: { id } });
    if (!faculty) throw new NotFoundException('Không tìm thấy khoa');
    return this.prisma.faculty.update({
      where: { id },
      data: {
        code: dto.code ? dto.code.trim().toUpperCase() : undefined,
        name: dto.name ? dto.name.trim() : undefined,
      },
      include: {
        _count: { select: { classes: true, staffs: true } },
      },
    });
  }

  async deleteFaculty(id: string) {
    const faculty = await this.prisma.faculty.findUnique({
      where: { id },
      include: {
        _count: { select: { classes: true, staffs: true } },
      },
    });
    if (!faculty) throw new NotFoundException('Không tìm thấy khoa');
    if (faculty._count.classes > 0 || faculty._count.staffs > 0) {
      throw new BadRequestException('Không thể xóa khoa đang có lớp học hoặc cán bộ phụ trách. Vui lòng chuyển các lớp và cán bộ sang khoa khác trước.');
    }
    return this.prisma.faculty.delete({ where: { id } });
  }

  async createClass(dto: { code: string; name?: string; cohort: string; facultyId: string }) {
    const existing = await this.prisma.class.findUnique({ where: { code: dto.code.trim().toUpperCase() } });
    if (existing) throw new BadRequestException('Mã lớp sinh hoạt đã tồn tại');
    const faculty = await this.prisma.faculty.findUnique({ where: { id: dto.facultyId } });
    if (!faculty) throw new NotFoundException('Khoa không tồn tại');
    return this.prisma.class.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        name: dto.name ? dto.name.trim() : dto.code.trim().toUpperCase(),
        cohort: dto.cohort.trim(),
        facultyId: dto.facultyId,
      },
      include: {
        faculty: { select: { id: true, code: true, name: true } },
        _count: { select: { students: true } },
      },
    });
  }

  async updateClass(id: string, dto: { code?: string; name?: string; cohort?: string; facultyId?: string }) {
    const cls = await this.prisma.class.findUnique({ where: { id } });
    if (!cls) throw new NotFoundException('Không tìm thấy lớp');
    return this.prisma.class.update({
      where: { id },
      data: {
        code: dto.code ? dto.code.trim().toUpperCase() : undefined,
        name: dto.name ? dto.name.trim() : undefined,
        cohort: dto.cohort ? dto.cohort.trim() : undefined,
        facultyId: dto.facultyId ? dto.facultyId : undefined,
      },
      include: {
        faculty: { select: { id: true, code: true, name: true } },
        _count: { select: { students: true } },
      },
    });
  }

  async deleteClass(id: string) {
    const cls = await this.prisma.class.findUnique({
      where: { id },
      include: {
        _count: { select: { students: true } },
      },
    });
    if (!cls) throw new NotFoundException('Không tìm thấy lớp');
    if (cls._count.students > 0) {
      throw new BadRequestException('Không thể xóa lớp sinh hoạt đang có sinh viên. Vui lòng chuyển sinh viên sang lớp khác trước.');
    }
    return this.prisma.class.delete({ where: { id } });
  }

  // ==========================================
  // REGULATION DOCUMENTS (KNOWLEDGE BASE A06)
  // ==========================================
  async getRegulations() {
    return this.prisma.regulationDocument.findMany({
      include: {
        uploadedBy: { select: { id: true, fullName: true, email: true } },
        _count: { select: { chunks: true, criteria: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRegulation(dto: { title: string; version: string; fileUrl?: string; effectiveDate?: string; uploadedById: string }) {
    return this.prisma.regulationDocument.create({
      data: {
        title: dto.title.trim(),
        version: dto.version.trim(),
        fileUrl: dto.fileUrl || '/docs/quy-che.pdf',
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : new Date(),
        uploadedById: dto.uploadedById,
        status: 'ACTIVE',
      },
      include: {
        uploadedBy: { select: { id: true, fullName: true, email: true } },
        _count: { select: { chunks: true, criteria: true } },
      },
    });
  }

  async deleteRegulation(id: string) {
    const doc = await this.prisma.regulationDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Không tìm thấy tài liệu quy chế');

    await this.prisma.$transaction([
      this.prisma.regulationChunk.deleteMany({ where: { regulationDocumentId: id } }),
      this.prisma.criterion.updateMany({ where: { regulationDocumentId: id }, data: { regulationDocumentId: null } }),
      this.prisma.regulationDocument.delete({ where: { id } }),
    ]);

    return { success: true, message: 'Đã xóa tài liệu quy chế thành công' };
  }
}
