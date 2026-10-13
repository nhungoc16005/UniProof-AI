import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto, AddParticipantDto } from './dto/activity.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, ActivityType } from '@prisma/client';

@ApiTags('Activities & Attendance')
@Controller('activities')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ActivitiesController {
  constructor(private activitiesService: ActivitiesService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách các hoạt động (Nội bộ & Ngoài trường)' })
  async findAll(@Query('type') type?: ActivityType, @Query('search') search?: string) {
    return this.activitiesService.findAll(type, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết hoạt động' })
  async findOne(@Param('id') id: string) {
    return this.activitiesService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Tạo hoạt động mới (Cán bộ, Admin)' })
  async create(@Body() dto: CreateActivityDto) {
    return this.activitiesService.create(dto);
  }

  @Post(':id/attendance')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Ghi nhận điểm danh sinh viên tham gia hoạt động (Cán bộ)' })
  async addParticipant(@Param('id') id: string, @Body() dto: AddParticipantDto) {
    return this.activitiesService.addParticipant(id, dto);
  }

  @Post(':id/attendance/batch')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Điểm danh hàng loạt bằng danh sách MSSV (Cán bộ)' })
  async batchAddParticipants(
    @Param('id') id: string,
    @Body() dto: { studentCodes: string[]; formRole?: string },
  ) {
    return this.activitiesService.batchAddParticipants(id, dto);
  }

  @Get(':id/attendance')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Lấy danh sách điểm danh của hoạt động (Cán bộ)' })
  async getParticipants(@Param('id') id: string) {
    return this.activitiesService.getParticipants(id);
  }

  @Delete(':id/attendance/:participantId')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Xóa sinh viên khỏi danh sách điểm danh (Cán bộ)' })
  async deleteParticipant(
    @Param('id') id: string,
    @Param('participantId') participantId: string,
  ) {
    return this.activitiesService.deleteParticipant(id, participantId);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Cập nhật hoạt động (Cán bộ, Admin)' })
  async update(@Param('id') id: string, @Body() dto: any) {
    return this.activitiesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Xóa hoạt động (Cán bộ, Admin)' })
  async delete(@Param('id') id: string) {
    return this.activitiesService.delete(id);
  }
}
