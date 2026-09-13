import { Controller, Get } from '@nestjs/common';
import { TalukasService } from './talukas.service';

// No @Roles() — a lookup list (for form dropdowns) any authenticated user can read.
@Controller('talukas')
export class TalukasController {
  constructor(private readonly talukasService: TalukasService) {}

  @Get()
  findAll() {
    return this.talukasService.findAll();
  }
}
