import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'sv3.cntt@sv.dut.udn.vn' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ enum: Role, example: Role.STUDENT })
  @IsEnum(Role)
  role: Role;

  @ApiPropertyOptional({ example: '102210003' })
  @IsOptional()
  @IsString()
  studentCode?: string;

  @ApiPropertyOptional({ example: 'Student@123' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ description: 'ID Lớp học' })
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiPropertyOptional({ description: 'ID Khoa' })
  @IsOptional()
  @IsString()
  facultyId?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Nguyễn Văn B' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  facultyId?: string;
}
