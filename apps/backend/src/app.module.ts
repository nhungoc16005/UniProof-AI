import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CriteriaModule } from './criteria/criteria.module';
import { ActivitiesModule } from './activities/activities.module';
import { EvidenceModule } from './evidence/evidence.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ConductScoresModule } from './conduct-scores/conduct-scores.module';
import { AppealsModule } from './appeals/appeals.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { AuditLogModule } from './audit-log/audit-log.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CriteriaModule,
    ActivitiesModule,
    EvidenceModule,
    ReviewsModule,
    ConductScoresModule,
    AppealsModule,
    NotificationsModule,
    ReportsModule,
    AuditLogModule,
  ],
})
export class AppModule {}
