import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ActivityType } from '@prisma/client';

export class CreateActivityDto {
  @ApiProperty({ example: 'Ngày hội Hiến máu Nhân đạo ĐHBK 2026' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: ActivityType, example: ActivityType.INTERNAL })
  @IsEnum(ActivityType)
  type: ActivityType;

  @ApiProperty({ example: 'Đoàn Thanh niên - Hội Sinh viên' })
  @IsString()
  @IsNotEmpty()
  organizer: string;

  @ApiPropertyOptional({ example: '2026-10-15T00:00:00Z' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-10-16T00:00:00Z' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ example: 'Hội trường khu F' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 'Chương trình hiến máu tình nguyện vì cộng đồng' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class AddParticipantDto {
  @ApiProperty({ example: '102210001', description: 'Mã số sinh viên tham gia' })
  @IsString()
  @IsNotEmpty()
  studentCode: string;

  @ApiPropertyOptional({ example: 'THAM_GIA_CHINH' })
  @IsOptional()
  @IsString()
  formRole?: string;
}
