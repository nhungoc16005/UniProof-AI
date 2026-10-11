import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ReviewDecision } from '@prisma/client';

export class ReviewDecisionDto {
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
  supplementDeadline?: string;
}
