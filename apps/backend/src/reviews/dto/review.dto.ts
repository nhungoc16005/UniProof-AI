import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, Min, Max, MinLength } from 'class-validator';
import { ReviewDecision } from '@prisma/client';

export class ReviewDecisionDto {
  @IsOptional() @IsInt() @Min(1) expectedVersion?: number;
  @ApiProperty({ enum: ReviewDecision, example: ReviewDecision.APPROVED })
  @IsEnum(ReviewDecision)
  action: ReviewDecision;

  @ApiPropertyOptional({ example: 10.0, description: 'Điểm phê duyệt chính thức' })
  @IsOptional()
  @IsNumber()
  approvedPoints?: number;

  @ApiPropertyOptional({ description: 'ID tiêu chí áp dụng' })
  @IsOptional()
  @IsString()
  criterionId?: string;

  @ApiProperty({ example: 'Đã đối chiếu khớp dữ liệu minh chứng hợp lệ' })
  @IsString()
  @IsNotEmpty()
  comment: string;

  @ApiPropertyOptional({ example: 'Căn cứ điều 5 quy chế ĐRL' })
  @IsOptional()
  @IsString()
  rejectBasis?: string;

  @ApiPropertyOptional({ example: 'Ảnh chụp mờ, cần bổ sung bản scan rõ dấu đỏ' })
  @IsOptional()
  @IsString()
  missingItem?: string;

  @ApiPropertyOptional({ example: '2026-11-01T00:00:00Z', description: 'Hạn chót sinh viên phải bổ sung' })
  @IsOptional()
  @IsString()
  @IsDateString()
  supplementDeadline?: string;
}

export class VerificationSourceDto {
  @IsString() @MinLength(3) sourceName: string;
  @IsOptional() @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) sourceUrl?: string;
  @IsString() @MinLength(3) note: string;
  @IsInt() @Min(1) @Max(4) level: number;
  @IsBoolean() confirmedActivity: boolean;
  @IsBoolean() confirmedStudent: boolean;
}
