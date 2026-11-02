import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl } from 'class-validator';
import { TermStatus } from '@prisma/client';

export class CreateTermDto {
  @ApiProperty({ example: 'Học kỳ 2 (2026-2027)' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '2026_2' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: '2027-02-01T00:00:00Z' })
  @IsString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ example: '2027-06-30T00:00:00Z' })
  @IsString()
  @IsNotEmpty()
  endDate: string;

  @ApiProperty({ example: '2027-07-05T00:00:00Z' })
  @IsString()
  @IsNotEmpty()
  submissionDeadline: string;

  @ApiProperty({ example: '2027-07-20T00:00:00Z' })
  @IsString()
  @IsNotEmpty()
  reviewDeadline: string;

  @ApiProperty({ example: '2027-07-30T00:00:00Z' })
  @IsString()
  @IsNotEmpty()
  appealDeadline: string;

  @ApiPropertyOptional({ enum: TermStatus })
  @IsOptional()
  @IsEnum(TermStatus)
  status?: TermStatus;

  @ApiPropertyOptional({ enum: ['DEFAULT', 'TERM'], default: 'DEFAULT' })
  @IsOptional()
  @IsIn(['DEFAULT', 'TERM'])
  rubricSourceType?: 'DEFAULT' | 'TERM';

  @ApiPropertyOptional({ description: 'ID của kỳ nguồn khi rubricSourceType=TERM' })
  @IsOptional()
  @IsString()
  sourceTermId?: string;
}

export class UpdateTermDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  submissionDeadline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewDeadline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appealDeadline?: string;

  @ApiPropertyOptional({ enum: TermStatus })
  @IsOptional()
  @IsEnum(TermStatus)
  status?: TermStatus;
}

export class CreateCriterionDto {
  @ApiProperty({ example: '1' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Kết quả học tập' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Điểm TBC học tập trong kỳ' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 10.0 })
  @IsNumber()
  maxScore: number;

  @ApiPropertyOptional({ example: 'KHUNG_I' })
  @IsOptional()
  @IsString()
  category?: string;
}

export class UpdateCriterionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxScore?: number;
}

export class FacultyDto {
  @IsString() @IsNotEmpty() code: string;
  @IsString() @IsNotEmpty() name: string;
}
export class UpdateFacultyDto {
  @IsOptional() @IsString() @IsNotEmpty() code?: string;
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
}
export class ClassDto {
  @IsString() @IsNotEmpty() code: string;
  @IsOptional() @IsString() name?: string;
  @IsString() @IsNotEmpty() cohort: string;
  @IsString() @IsNotEmpty() facultyId: string;
}
export class UpdateClassDto {
  @IsOptional() @IsString() @IsNotEmpty() code?: string;
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @IsString() @IsNotEmpty() cohort?: string;
  @IsOptional() @IsString() @IsNotEmpty() facultyId?: string;
}
export class RegulationDto {
  @IsString() @IsNotEmpty() title: string;
  @IsString() @IsNotEmpty() version: string;
  @IsString() @IsNotEmpty() @IsUrl({ protocols: ['http','https'], require_protocol: true }) fileUrl: string;
  @IsOptional() @IsDateString() effectiveDate?: string;
}
export class RegulationStatusDto {
  @IsIn(['ACTIVE','EXPIRED']) status: 'ACTIVE' | 'EXPIRED';
}
