import { Module } from '@nestjs/common';
import { CriteriaService } from './criteria.service';
import { CriteriaController } from './criteria.controller';

@Module({
  controllers: [CriteriaController],
  providers: [CriteriaService],
  exports: [CriteriaService],
})
export class CriteriaModule {}
