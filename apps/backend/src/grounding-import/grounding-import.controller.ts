import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ImportBatchType, Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ConfirmGroundingImportDto, PreviewGroundingImportDto, RevokeBatchDto } from './dto/grounding-import.dto';
import { GroundingImportService } from './grounding-import.service';

@ApiTags('Grounding Import')
@Controller('grounding-import')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class GroundingImportController {
  constructor(private readonly groundingImportService: GroundingImportService) {}

  @Post('preview')
  @Roles(Role.STAFF, Role.ADMIN)
  @ApiOperation({ summary: 'Xem trước dữ liệu import Excel (Không ghi vào DB)' })
  async preview(@CurrentUser() actor: any, @Body() dto: PreviewGroundingImportDto) {
    return this.groundingImportService.preview(actor, dto);
  }

  @Post('confirm')
  @Roles(Role.STAFF, Role.ADMIN)
  @ApiOperation({ summary: 'Xác nhận nhập dữ liệu căn cứ từ file Excel vào hệ thống' })
  async confirm(@CurrentUser() actor: any, @Body() dto: ConfirmGroundingImportDto) {
    return this.groundingImportService.confirm(actor, dto);
  }

  @Get('batches')
  @Roles(Role.STAFF, Role.ADMIN)
  @ApiOperation({ summary: 'Lấy danh sách các lô đã nhập của Khoa' })
  async listBatches(
    @CurrentUser() actor: any,
    @Query('termId') termId: string,
    @Query('type') type?: ImportBatchType,
  ) {
    return this.groundingImportService.listBatches(actor, termId, type);
  }

  @Get('batches/:id')
  @Roles(Role.STAFF, Role.ADMIN)
  @ApiOperation({ summary: 'Xem chi tiết một lô import' })
  async getBatchDetails(@CurrentUser() actor: any, @Param('id') id: string) {
    return this.groundingImportService.getBatchDetails(actor, id);
  }

  @Post('batches/:id/revoke')
  @Roles(Role.STAFF, Role.ADMIN)
  @ApiOperation({ summary: 'Thu hồi toàn bộ lô import căn cứ (Có kiểm tra ràng buộc an toàn)' })
  async revokeBatch(
    @CurrentUser() actor: any,
    @Param('id') id: string,
    @Body() dto: RevokeBatchDto,
  ) {
    return this.groundingImportService.revokeBatch(actor, id, dto.reason);
  }
}
