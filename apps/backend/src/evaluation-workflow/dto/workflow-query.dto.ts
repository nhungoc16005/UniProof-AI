import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class WorkflowQueryDto {
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() facultyId?: string;
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  @IsOptional() @IsIn(['NOT_SUBMITTED', 'STUDENT_RETURNED', 'REVIEWING', 'READY', 'SENT', 'PUBLISHED', 'FACULTY_RETURNED', 'NOT_SUBMITTED_RECORDED', 'APPEALS', 'RETURNED']) state?: string;
  @IsOptional() @IsInt() @Min(1) page: number = 1;
  @IsOptional() @IsInt() @Min(1) @Max(100) pageSize: number = 25;
}
