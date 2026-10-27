import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { AppealStatus } from '@prisma/client';

export class CreateAppealDto {
  @ApiProperty({ description: 'ID Hồ sơ minh chứng cần khiếu nại' })
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  evidenceId?: string;

  @IsOptional() @IsString() criterionAssessmentId?: string;

  @ApiProperty({ example: 'Em đã tham gia đầy đủ 2 ngày, xin cán bộ xem xét lại giấy xác nhận dấu đỏ' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ example: 8.0, description: 'Điểm mong muốn được công nhận' })
  @IsOptional()
  @IsNumber()
  requestedScore?: number;
}

export class ResolveAppealDto {
  @ApiProperty({ enum: [AppealStatus.ACCEPTED, AppealStatus.REJECTED], example: AppealStatus.ACCEPTED })
  @IsEnum(AppealStatus)
  status: AppealStatus;

  @ApiProperty({ example: 'Chấp thuận giải trình, mở lại hồ sơ để xem xét cập nhật điểm' })
  @IsString()
  @IsNotEmpty()
  resolutionNote: string;

  @ApiPropertyOptional({ example: 8.0 })
  @IsOptional()
  @IsNumber()
  adjustedScore?: number;
}
