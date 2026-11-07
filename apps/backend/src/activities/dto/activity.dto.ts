import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ActivityType } from '@prisma/client';

export class CreateActivityDto {
  @IsString() @IsNotEmpty() termId: string;
  @IsString() @IsNotEmpty() criterionId: string;
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
  @IsString()
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '2026-10-16T00:00:00Z' })
  @IsOptional()
  @IsString()
  @IsDateString()
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
  @IsIn(['THAM_GIA_CHINH','BAN_TO_CHUC','CO_VU','PARTICIPANT','ORGANIZER','CHEERLEADER'])
  formRole?: string;
}

export class UpdateActivityDto extends PartialType(OmitType(CreateActivityDto, ['termId', 'criterionId', 'type'] as const)) {}
export class BatchAttendanceDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1000) @IsString({ each: true }) studentCodes: string[];
  @IsOptional() @IsIn(['THAM_GIA_CHINH','BAN_TO_CHUC','CO_VU','PARTICIPANT','ORGANIZER','CHEERLEADER']) formRole?: string;
}

export class ConfirmAttendanceDto {
  @IsOptional() @IsArray() @ArrayMaxSize(1000) @IsString({ each: true }) participantIds?: string[];
}

export class RevokeAttendanceDto {
  @IsString() @MinLength(5) reason: string;
}
