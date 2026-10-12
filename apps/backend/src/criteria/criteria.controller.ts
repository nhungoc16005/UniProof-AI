import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CriteriaService } from './criteria.service';
import { CreateTermDto, UpdateTermDto, CreateCriterionDto, UpdateCriterionDto } from './dto/criteria.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Criteria & Master Data')
@Controller()
export class CriteriaController {
  constructor(private criteriaService: CriteriaService) {}

  // --- CRITERIA ---
  @Get('criteria')
  @ApiOperation({ summary: 'Lấy cây tiêu chí đánh giá ĐRL (16 mục ĐHBK Đà Nẵng)' })
  async getCriteria() {
    return this.criteriaService.getCriteria();
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
  async closeTerm(@Param('id') id: string) {
    return this.criteriaService.closeTerm(id);
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

  @Get('classes')
  @ApiOperation({ summary: 'Lấy danh mục các Lớp học sinh hoạt' })
  async getClasses(@Query('facultyId') facultyId?: string) {
    return this.criteriaService.getClasses(facultyId);
  }
}
