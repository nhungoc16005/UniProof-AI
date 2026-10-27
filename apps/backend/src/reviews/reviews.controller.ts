import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { ReviewDecisionDto } from './dto/review.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Reviews & Officer Queue')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Get('reviews/queue')
  @Roles(Role.STAFF)
  @ApiOperation({ summary: 'Lấy hàng đợi hồ sơ cần xét duyệt (Cán bộ Khoa)' })
  async getQueue(
    @CurrentUser() officer: any,
    @Query('status') status?: string,
    @Query('termId') termId?: string,
    @Query('classId') classId?: string,
    @Query('search') search?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.reviewsService.getQueue(officer, {
      status,
      termId,
      classId,
      search,
      sortOrder,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Post('evidence/:id/claim')
  @Roles(Role.STAFF)
  @ApiOperation({ summary: 'Khóa hồ sơ để bắt đầu duyệt (Chống xung đột 409 Conflict)' })
  async claimEvidence(@Param('id') id: string, @CurrentUser() officer: any) {
    return this.reviewsService.claimEvidence(id, officer);
  }

  @Post('evidence/:id/release')
  @Roles(Role.STAFF)
  @ApiOperation({ summary: 'Mở khóa hồ sơ khi cán bộ thoát hoặc hoàn thành' })
  async releaseEvidence(@Param('id') id: string, @CurrentUser() officer: any) {
    return this.reviewsService.releaseEvidence(id, officer);
  }

  @Post('evidence/:id/review')
  @Roles(Role.STAFF)
  @ApiOperation({ summary: 'Ra quyết định phê duyệt/sửa điểm/từ chối/yêu cầu bổ sung' })
  async submitDecision(
    @Param('id') id: string,
    @CurrentUser() officer: any,
    @Body() dto: ReviewDecisionDto,
  ) {
    return this.reviewsService.submitDecision(id, officer, dto);
  }
}
