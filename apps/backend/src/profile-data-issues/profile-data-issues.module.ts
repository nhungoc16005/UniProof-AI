import { Module } from '@nestjs/common';
import { ProfileDataIssuesController } from './profile-data-issues.controller';
import { ProfileDataIssuesService } from './profile-data-issues.service';

@Module({ controllers: [ProfileDataIssuesController], providers: [ProfileDataIssuesService] })
export class ProfileDataIssuesModule {}
