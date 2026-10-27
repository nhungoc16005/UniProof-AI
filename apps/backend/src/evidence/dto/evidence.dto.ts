import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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

  @ApiPropertyOptional({ example: 'Giấy xác nhận tham gia chương trình tình nguyện do Đoàn trường cấp.' })
  @IsOptional()
  @IsString()
  description?: string;

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

  @ApiPropertyOptional({ description: 'ID Tiêu chí đánh giá sinh viên chọn' })
  @IsOptional()
  @IsString()
  criterionId?: string;

  @ApiPropertyOptional({ description: 'Lưu hồ sơ nháp cùng phiếu sinh viên' })
  @IsOptional()
  @IsBoolean()
  draft?: boolean;

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

export class UploadEvidenceFileDto {
  @ApiProperty({ example: 'minh-chung-hoat-dong.pdf' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  @IsNotEmpty()
  fileType: string;

  @ApiProperty({ description: 'Data URL từ file sinh viên chọn; Backend đưa lên Supabase Storage' })
  @IsString()
  @IsNotEmpty()
  fileData: string;
}
