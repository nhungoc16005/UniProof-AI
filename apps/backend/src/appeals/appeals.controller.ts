import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AppealsService } from './appeals.service';
import { CreateAppealDto, ResolveAppealDto } from './dto/appeal.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AppealStatus, Role } from '@prisma/client';

@ApiTags('Appeals')
@Controller('appeals')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AppealsController {
  constructor(private appealsService: AppealsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách các đơn khiếu nại' })
  async findAll(
    @CurrentUser() user: any,
    @Query('status') status?: AppealStatus,
    @Query('termId') termId?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.appealsService.findAll(user, { termId, status, page: page ? Number(page) : 1, pageSize: pageSize ? Number(pageSize) : 20 });
  }

  @Post()
  @Roles(Role.STUDENT)
  @ApiOperation({ summary: 'Gửi đơn khiếu nại kết quả xét duyệt hồ sơ (Sinh viên)' })
  async create(@CurrentUser('id') studentId: string, @Body() dto: CreateAppealDto) {
    return this.appealsService.create(studentId, dto);
  }

  @Post(':id/resolve')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Giải quyết đơn khiếu nại (Chấp thuận mở lại / Bác bỏ) (Cán bộ)' })
  async resolve(
    @Param('id') id: string,
    @CurrentUser() officer: any,
    @Body() dto: ResolveAppealDto,
  ) {
    return this.appealsService.resolve(id, officer, dto);
  }
}
