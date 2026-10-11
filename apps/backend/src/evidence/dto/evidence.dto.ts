import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateEvidenceDto {
  @ApiPropertyOptional({ description: 'ID Kỳ học (mặc định lấy kỳ ACTIVE)' })
  @IsOptional()
  @IsString()
  termId?: string;

  @ApiPropertyOptional({ description: 'ID Hoạt động nếu là hoạt động nội bộ' })
  @IsOptional()
  @IsString()
  activityId?: string;

  @ApiProperty({ example: 'Tham gia Cuộc thi Sinh viên NCKH 2026' })
  @IsString()
  @IsNotEmpty()
  declaredActivityName: string;

  @ApiPropertyOptional({ example: 'THAM_GIA_CHINH' })
  @IsOptional()
  @IsString()
  declaredRole?: string;

  @ApiProperty({ example: 'GIAY_KHEN' })
  @IsString()
  @IsNotEmpty()
  evidenceType: string;

  @ApiPropertyOptional({ example: '2026-10-10T00:00:00Z' })
  @IsOptional()
  @IsString()
  participationDate?: string;

  @ApiPropertyOptional({ example: '1', description: 'Mã tiêu chí đề xuất' })
  @IsOptional()
  @IsString()
  criterionCode?: string;

  @ApiPropertyOptional({ description: 'Danh sách URL file minh chứng' })
  @IsOptional()
  fileUrls?: string[];
}

export class UploadFileDto {
  @ApiProperty({ example: 'https://example.com/file.png' })
  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @ApiProperty({ example: 'image/png' })
  @IsString()
  @IsNotEmpty()
  fileType: string;
}
