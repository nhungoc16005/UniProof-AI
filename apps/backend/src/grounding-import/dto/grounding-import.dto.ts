import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { ImportBatchType } from '@prisma/client';

export class AcademicRowDto {
  @ApiProperty({ example: '102210001' })
  @IsString()
  @IsNotEmpty()
  studentCode: string;

  @ApiProperty({ example: '1' })
  @IsString()
  @IsNotEmpty()
  criterionCode: string; // '1' | '3' | '7'

  @ApiProperty({ example: { examBans: 0, classWarnings: 1 } })
  @IsObject()
  data: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'Phòng Đào tạo' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ example: 'Cấm thi 0 môn, nhắc nhở 1 lần' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class ActivityParticipantRowDto {
  @ApiProperty({ example: '102210001' })
  @IsString()
  @IsNotEmpty()
  studentCode: string;

  @ApiPropertyOptional({ example: 'THAM_GIA_CHINH' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ example: 'Quét mã QR tại cổng' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class ClubLeadershipRowDto {
  @ApiProperty({ example: '102210001' })
  @IsString()
  @IsNotEmpty()
  studentCode: string;

  @ApiProperty({ example: '4' })
  @IsString()
  @IsNotEmpty()
  criterionCode: string; // '4' | '13'

  @ApiProperty({ example: 'CLB Tin học DUT' })
  @IsString()
  @IsNotEmpty()
  organizationName: string;

  @ApiProperty({ example: 'Thành viên chính thức' })
  @IsString()
  @IsNotEmpty()
  roleTitle: string;

  @ApiPropertyOptional({ example: 'Quyết định công nhận CLB số 12/QĐ-ĐTN' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ example: 'Tham gia sinh hoạt định kỳ' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class PreviewGroundingImportDto {
  @ApiProperty({ example: 'term-uuid' })
  @IsString()
  @IsNotEmpty()
  termId: string;

  @ApiProperty({ enum: ImportBatchType, example: ImportBatchType.ACADEMIC })
  @IsEnum(ImportBatchType)
  type: ImportBatchType;

  @ApiPropertyOptional({ example: 'HocVu_K21_HK1.xlsx' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ example: 'activity-uuid' })
  @IsOptional()
  @IsString()
  activityId?: string;

  @ApiProperty({ description: 'Dữ liệu các dòng thô được parse từ file Excel' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  rows: Record<string, unknown>[];
}

export class ConfirmGroundingImportDto {
  @ApiProperty({ example: 'term-uuid' })
  @IsString()
  @IsNotEmpty()
  termId: string;

  @ApiProperty({ description: 'Mã kỳ trong kết quả xem trước' })
  @IsString()
  @IsNotEmpty()
  previewTermId: string;

  @ApiProperty({ enum: ImportBatchType, example: ImportBatchType.ACADEMIC })
  @IsEnum(ImportBatchType)
  type: ImportBatchType;

  @ApiPropertyOptional({ example: 'HocVu_K21_HK1.xlsx' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ example: 'activity-uuid' })
  @IsOptional()
  @IsString()
  activityId?: string;

  @ApiPropertyOptional({ example: 'idemp-key-123' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiPropertyOptional({ description: 'Danh sách các dòng cần import' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2000)
  rows?: Record<string, unknown>[];

  @ApiPropertyOptional({ description: 'Danh sách các dòng hợp lệ cần commit vào database' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2000)
  validRows?: Record<string, unknown>[];
}

export class RevokeBatchDto {
  @ApiProperty({ example: 'Nhầm lẫn file dữ liệu học kỳ trước' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class BatchFinalizeAssessmentsDto {
  @ApiPropertyOptional({ example: 'term-uuid' })
  @IsOptional()
  @IsString()
  termId?: string;

  @ApiProperty({ example: ['student-uuid-1', 'student-uuid-2'], description: 'Tối đa 100 sinh viên/lần' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  studentIds: string[];
}
