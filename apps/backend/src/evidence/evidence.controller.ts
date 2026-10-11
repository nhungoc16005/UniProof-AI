import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EvidenceService } from './evidence.service';
import { CreateEvidenceDto, UploadFileDto } from './dto/evidence.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EvidenceStatus } from '@prisma/client';

@ApiTags('Evidence')
@Controller('evidence')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EvidenceController {
  constructor(private evidenceService: EvidenceService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách hồ sơ minh chứng (Lọc theo kỳ, trạng thái)' })
  async findAll(
    @CurrentUser() user: any,
    @Query('studentId') studentId?: string,
    @Query('termId') termId?: string,
    @Query('status') status?: EvidenceStatus,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.evidenceService.findAll(user, { studentId, termId, status, page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết hồ sơ minh chứng' })
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.evidenceService.findOne(id, user);
  }

  @Post()
  @ApiOperation({ summary: 'Tạo hồ sơ minh chứng mới (Sinh viên)' })
  async create(@CurrentUser('id') studentId: string, @Body() dto: CreateEvidenceDto) {
    return this.evidenceService.create(studentId, dto);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Nộp hồ sơ xét duyệt chính thức' })
  async submit(@Param('id') id: string, @CurrentUser('id') studentId: string) {
    return this.evidenceService.submit(id, studentId);
  }

  @Post(':id/withdraw')
  @ApiOperation({ summary: 'Rút hồ sơ minh chứng đã nộp' })
  async withdraw(@Param('id') id: string, @CurrentUser('id') studentId: string) {
    return this.evidenceService.withdraw(id, studentId);
  }

  @Post(':id/files')
  @ApiOperation({ summary: 'Thêm file minh chứng vào hồ sơ' })
  async addFile(
    @Param('id') id: string,
    @CurrentUser('id') studentId: string,
    @Body() dto: UploadFileDto,
  ) {
    return this.evidenceService.addFile(id, studentId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa hồ sơ nháp' })
  async deleteDraft(@Param('id') id: string, @CurrentUser('id') studentId: string) {
    return this.evidenceService.deleteDraft(id, studentId);
  }
}
