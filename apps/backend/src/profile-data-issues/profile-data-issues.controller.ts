import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ProfileDataIssueStatus, Role } from '@prisma/client';
import { ProfileDataIssuesService } from './profile-data-issues.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class CreateIssueDto {
  @IsString() @MinLength(2) category: string;
  @IsString() @MinLength(10) content: string;
}

class ResolveIssueDto {
  @IsIn(['RESOLVED', 'REJECTED']) status: 'RESOLVED' | 'REJECTED';
  @IsString() @MinLength(3) resolution: string;
}

@Controller('profile-data-issues')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProfileDataIssuesController {
  constructor(private readonly service: ProfileDataIssuesService) {}

  @Post()
  create(@CurrentUser() actor: any, @Body() body: CreateIssueDto) { return this.service.create(actor, body); }

  @Get('mine')
  mine(@CurrentUser('id') userId: string) { return this.service.mine(userId); }

  @Get()
  @Roles(Role.ADMIN)
  list(@Query('status') status?: ProfileDataIssueStatus, @Query('page') page?: string) {
    return this.service.list(status, Number(page) || 1);
  }

  @Patch(':id/resolve')
  @Roles(Role.ADMIN)
  resolve(@CurrentUser('id') actorId: string, @Param('id') id: string, @Body() body: ResolveIssueDto) {
    return this.service.resolve(actorId, id, body);
  }
}
