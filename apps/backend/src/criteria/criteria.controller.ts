import { Controller, Get, Post, Patch, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CriteriaService } from './criteria.service';
import { CreateTermDto, UpdateTermDto, CreateCriterionDto, UpdateCriterionDto } from './dto/criteria.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Criteria & Master Data')
@Controller()
export class CriteriaController {
  constructor(private criteriaService: CriteriaService) {}

  // --- CRITERIA ---
  @Get('criteria')
  @ApiOperation({ summary: 'Lấy cây tiêu chí đánh giá ĐRL (16 mục ĐHBK Đà Nẵng)' })
  async getCriteria(@Query('termId') termId?: string) {
    return this.criteriaService.getCriteria(termId);
  }

  @Get('rubric-templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  async getRubricTemplates() {
    return this.criteriaService.getRubricTemplates();
  }

  @Get('rubric-templates/:versionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  async getRubricTemplateVersion(@Param('versionId') versionId: string) {
    return this.criteriaService.getRubricTemplateVersion(versionId);
  }

  @Post('rubric-templates/draft')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  async createRubricTemplateDraft() {
    return this.criteriaService.createRubricTemplateDraft();
  }

  @Put('rubric-templates/:versionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  async updateRubricTemplateDraft(@Param('versionId') versionId: string, @Body() body: { definition: unknown; changeNote?: string }) {
    return this.criteriaService.updateRubricTemplateDraft(versionId, body.definition, body.changeNote);
  }

  @Post('rubric-templates/:versionId/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  async publishRubricTemplateDraft(@Param('versionId') versionId: string) {
    return this.criteriaService.publishRubricTemplateDraft(versionId);
  }

  @Get('terms/:id/rubric')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  async getTermRubric(@Param('id') id: string) {
    return this.criteriaService.getTermRubric(id);
  }

  @Post('terms/:id/rubric/draft')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  async createTermRubricDraft(@Param('id') id: string, @Body() body: { type: 'DEFAULT' | 'TERM'; sourceTermId?: string }) {
    return this.criteriaService.createTermRubricDraft(id, body);
  }

  @Put('terms/:id/rubric')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  async updateTermRubricDraft(@Param('id') id: string, @Body() body: { definition: unknown; changeNote?: string }) {
    return this.criteriaService.updateTermRubricDraft(id, body.definition, body.changeNote);
  }

  @Post('terms/:id/rubric/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  async publishTermRubric(@Param('id') id: string) {
    return this.criteriaService.publishTermRubric(id);
  }

  @Post('criteria')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo tiêu chí mới (Admin)' })
  async createCriterion(@Body() dto: CreateCriterionDto) {
    return this.criteriaService.createCriterion(dto);
  }

  @Patch('criteria/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật tiêu chí / trần điểm (Admin)' })
  async updateCriterion(@Param('id') id: string, @Body() dto: UpdateCriterionDto) {
    return this.criteriaService.updateCriterion(id, dto);
  }

  @Delete('criteria/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa tiêu chí (Admin)' })
  async deleteCriterion(@Param('id') id: string) {
    return this.criteriaService.deleteCriterion(id);
  }

  // --- TERMS ---
  @Get('terms')
  @ApiOperation({ summary: 'Lấy danh sách các kỳ đánh giá' })
  async getTerms() {
    return this.criteriaService.getTerms();
  }

  @Get('terms/active')
  @ApiOperation({ summary: 'Lấy kỳ đánh giá đang hoạt động (ACTIVE)' })
  async getActiveTerm() {
    return this.criteriaService.getActiveTerm();
  }

  @Post('terms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo kỳ đánh giá mới (Admin)' })
  async createTerm(@Body() dto: CreateTermDto) {
    return this.criteriaService.createTerm(dto);
  }

  @Patch('terms/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật thời hạn kỳ đánh giá (Admin)' })
  async updateTerm(@Param('id') id: string, @Body() dto: UpdateTermDto) {
    return this.criteriaService.updateTerm(id, dto);
  }

  @Post('terms/:id/close')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chốt kỳ đánh giá - không cho sửa hoặc nộp thêm (Admin)' })
  async closeTerm(@Param('id') id: string, @CurrentUser() actor: any) {
    return this.criteriaService.closeTerm(id, actor);
  }

  @Post('terms/:id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mở kỳ sau khi rubric đã được ban hành' })
  async activateTerm(@Param('id') id: string) {
    return this.criteriaService.activateTerm(id);
  }

  @Post('terms/:id/reopen')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mở lại kỳ đánh giá đặc biệt (Bắt buộc có lý do) (Admin)' })
  async reopenTerm(@Param('id') id: string, @Body('reason') reason: string) {
    return this.criteriaService.reopenTerm(id, reason);
  }

  // --- FACULTIES & CLASSES ---
  @Get('faculties')
  @ApiOperation({ summary: 'Lấy danh mục các Khoa trong trường' })
  async getFaculties() {
    return this.criteriaService.getFaculties();
  }

  @Post('faculties')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo Khoa mới (Admin)' })
  async createFaculty(@Body() dto: { code: string; name: string }) {
    return this.criteriaService.createFaculty(dto);
  }

  @Patch('faculties/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật thông tin Khoa (Admin)' })
  async updateFaculty(@Param('id') id: string, @Body() dto: { code?: string; name?: string }) {
    return this.criteriaService.updateFaculty(id, dto);
  }

  @Delete('faculties/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa Khoa (Admin)' })
  async deleteFaculty(@Param('id') id: string) {
    return this.criteriaService.deleteFaculty(id);
  }

  @Get('classes')
  @ApiOperation({ summary: 'Lấy danh mục các Lớp học sinh hoạt' })
  async getClasses(@Query('facultyId') facultyId?: string) {
    return this.criteriaService.getClasses(facultyId);
  }

  @Post('classes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo Lớp sinh hoạt mới (Admin, Cán bộ)' })
  async createClass(@Body() dto: { code: string; name?: string; cohort: string; facultyId: string }) {
    return this.criteriaService.createClass(dto);
  }

  @Patch('classes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật Lớp sinh hoạt (Admin, Cán bộ)' })
  async updateClass(@Param('id') id: string, @Body() dto: { code?: string; name?: string; cohort?: string; facultyId?: string }) {
    return this.criteriaService.updateClass(id, dto);
  }

  @Delete('classes/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa Lớp sinh hoạt (Admin, Cán bộ)' })
  async deleteClass(@Param('id') id: string) {
    return this.criteriaService.deleteClass(id);
  }

  // --- REGULATION DOCUMENTS (KNOWLEDGE BASE) ---
  @Get('regulations')
  @ApiOperation({ summary: 'Lấy danh mục văn bản quy chế (Knowledge Base)' })
  async getRegulations() {
    return this.criteriaService.getRegulations();
  }

  @Post('regulations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tải lên / Tạo mới tài liệu quy chế (Admin)' })
  async createRegulation(
    @CurrentUser('id') userId: string,
    @Body() dto: { title: string; version: string; fileUrl?: string; effectiveDate?: string },
  ) {
    return this.criteriaService.createRegulation({ ...dto, uploadedById: userId });
  }

  @Delete('regulations/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa tài liệu quy chế (Admin)' })
  async deleteRegulation(@Param('id') id: string) {
    return this.criteriaService.deleteRegulation(id);
  }
}
