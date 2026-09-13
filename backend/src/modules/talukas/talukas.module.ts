import { Module } from '@nestjs/common';
import { TalukasController } from './talukas.controller';
import { TalukasService } from './talukas.service';

@Module({
  controllers: [TalukasController],
  providers: [TalukasService],
})
export class TalukasModule {}
