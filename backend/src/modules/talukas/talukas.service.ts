import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TalukasService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.taluka.findMany({
      orderBy: { name: 'asc' },
      include: { routes: { orderBy: { routeNumber: 'asc' } } },
    });
  }
}
