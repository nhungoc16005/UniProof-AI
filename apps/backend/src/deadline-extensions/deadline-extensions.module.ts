import { Global, Module } from '@nestjs/common';
import { DeadlineExtensionsController } from './deadline-extensions.controller';
import { DeadlineExtensionsService } from './deadline-extensions.service';

@Global()
@Module({ controllers: [DeadlineExtensionsController], providers: [DeadlineExtensionsService], exports: [DeadlineExtensionsService] })
export class DeadlineExtensionsModule {}
