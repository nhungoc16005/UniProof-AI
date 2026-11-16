import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { DeadlineExtensionTarget, DeadlineExtensionType, Role } from '@prisma/client';
import { DeadlineExtensionsService } from './deadline-extensions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class CreateExtensionDto {
  @IsString({ message: 'termId phải là chuỗi' })
  @IsNotEmpty({ message: 'termId không được để trống' })
  termId: string;

  @IsEnum(DeadlineExtensionTarget, { message: 'targetType phải là STUDENT hoặc CLASS' })
  targetType: DeadlineExtensionTarget;

  @IsString({ message: 'targetId phải là chuỗi' })
  @IsNotEmpty({ message: 'targetId không được để trống' })
  targetId: string;

  @IsEnum(DeadlineExtensionType, { message: 'type phải là SUBMISSION, REVIEW hoặc APPEAL' })
  type: DeadlineExtensionType;

  @IsDateString({}, { message: 'deadline phải là chuỗi ISO 8601 hợp lệ' })
  deadline: string;

  @IsString({ message: 'reason phải là chuỗi' })
  @MinLength(3, { message: 'reason phải có ít nhất 3 ký tự' })
  reason: string;
}

export class DeadlineExtensionTargetsQueryDto {
  @IsString({ message: 'termId phải là chuỗi' })
  @IsNotEmpty({ message: 'termId là bắt buộc' })
  termId: string;

  @IsEnum(DeadlineExtensionTarget, { message: 'targetType phải là STUDENT hoặc CLASS' })
  targetType: DeadlineExtensionTarget;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page phải là số nguyên' })
  @Min(1, { message: 'page tối thiểu là 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize phải là số nguyên' })
  @Min(1, { message: 'pageSize tối thiểu là 1' })
  @Max(100, { message: 'pageSize tối đa là 100' })
  pageSize?: number = 25;
}

@Controller('deadline-extensions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class DeadlineExtensionsController {
  constructor(private readonly service: DeadlineExtensionsService) {}

  @Get()
  list(@Query('termId') termId: string) {
    return this.service.list(termId);
  }

  @Get('targets')
  targets(@Query() query: DeadlineExtensionTargetsQueryDto) {
    return this.service.targets({
      termId: query.termId,
      targetType: query.targetType,
      q: query.q,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 25,
    });
  }

  @Post()
  create(@CurrentUser('id') actorId: string, @Body() body: CreateExtensionDto) {
    return this.service.create(actorId, body);
  }

  @Delete(':id')
  revoke(@CurrentUser('id') actorId: string, @Param('id') id: string) {
    return this.service.revoke(actorId, id);
  }
}
