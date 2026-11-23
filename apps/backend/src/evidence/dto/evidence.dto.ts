import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateEvidenceDto {
  @ApiPropertyOptional({ description: 'ID Kỳ học (mặc định lấy kỳ ACTIVE)' })
  @IsOptional()
  @IsString()
  termId?: string;

  @ApiPropertyOptional({ description: 'ID Hoạt động nếu là hoạt động nội bộ' })
  @IsOptional()
  @IsString()
  activityId?: string;

  @ApiPropertyOptional({ example: 'Tham gia Cuộc thi Sinh viên NCKH 2026', description: 'Không bắt buộc — có thể để trống' })
  @IsOptional()
  @IsString()
  declaredActivityName?: string;

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

export class SubmitSupplementDto {
  @IsOptional() @IsString() explanation?: string;
  @IsOptional() @IsString() verificationUrl?: string;
  @IsOptional() @IsString() fileName?: string;
  @IsOptional() @IsString() fileType?: string;
  @IsOptional() @IsString() fileData?: string;
}

export class InspectAiDto {
  @ApiPropertyOptional({ example: 'Ngày hội tình nguyện DUT 2025', description: 'Không bắt buộc — bỏ trống để AI tự trích xuất từ tệp' })
  @IsOptional()
  @IsString()
  activityName?: string;

  @ApiProperty({ example: 'GIAY_KHEN', description: 'GIAY_KHEN | GIAY_XAC_NHAN | GIAY_HIEN_MAU | VE_CHECKIN | ANH_SU_KIEN | OTHER' })
  @IsString()
  @IsNotEmpty()
  evidenceType: string;

  @ApiProperty({ example: { fullName: 'Nguyễn Văn A', studentCode: '102210001' } })
  @IsObject()
  declaredStudent: { fullName: string; studentCode?: string; citizenId?: string };

  @ApiPropertyOptional({ example: '2025-11-26T00:00:00Z' })
  @IsOptional()
  @IsString()
  participationDate?: string;

  @ApiPropertyOptional({ example: '2025-09-01T00:00:00Z' })
  @IsOptional()
  @IsString()
  termStartDate?: string;

  @ApiPropertyOptional({ example: '2025-12-31T00:00:00Z' })
  @IsOptional()
  @IsString()
  termEndDate?: string;

  @ApiPropertyOptional({ description: 'Bật Luồng 2 tra cứu nguồn công khai', default: false })
  @IsOptional()
  @IsBoolean()
  enableWebSearch?: boolean;

  @ApiPropertyOptional({ description: 'Data URL của tệp minh chứng (data:image/...;base64,...)' })
  @IsOptional()
  @IsString()
  fileData?: string;

  @ApiPropertyOptional({ description: 'URL tệp minh chứng công khai (thay thế cho fileData)' })
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional({ example: 'giay-khen.jpg' })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional({ example: 'image/jpeg' })
  @IsOptional()
  @IsString()
  fileType?: string;

  @ApiPropertyOptional({ description: 'Danh sách {sha256, pHash} đã lưu để kiểm tra trùng lặp' })
  @IsOptional()
  @IsArray()
  previousHashes?: Array<{ sha256: string; pHash: string }>;

  @ApiPropertyOptional({ description: 'ID tiêu chí Rubric của kỳ để gợi ý điểm tiêu chí (tùy chọn)' })
  @IsOptional()
  @IsString()
  criterionId?: string;

  @ApiPropertyOptional({ description: 'Engine OCR: auto | rapidocr_vietocr | rapidocr | tesseract' })
  @IsOptional()
  @IsString()
  ocrEngine?: string;
}
