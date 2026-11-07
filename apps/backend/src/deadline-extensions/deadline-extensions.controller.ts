import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsDateString, IsEnum, IsString, MinLength } from 'class-validator';
import { DeadlineExtensionTarget, DeadlineExtensionType, Role } from '@prisma/client';
import { DeadlineExtensionsService } from './deadline-extensions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class CreateExtensionDto {
  @IsString() termId: string;
  @IsEnum(DeadlineExtensionTarget) targetType: DeadlineExtensionTarget;
  @IsString() targetId: string;
  @IsEnum(DeadlineExtensionType) type: DeadlineExtensionType;
  @IsDateString() deadline: string;
  @IsString() @MinLength(3) reason: string;
}

@Controller('deadline-extensions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class DeadlineExtensionsController {
  constructor(private readonly service: DeadlineExtensionsService) {}
  @Get() list(@Query('termId') termId: string) { return this.service.list(termId); }
  @Post() create(@CurrentUser('id') actorId: string, @Body() body: CreateExtensionDto) { return this.service.create(actorId, body); }
  @Delete(':id') revoke(@CurrentUser('id') actorId: string, @Param('id') id: string) { return this.service.revoke(actorId, id); }
}
