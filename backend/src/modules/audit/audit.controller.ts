import { Controller, Get, Query } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AuditService } from './audit.service';

@Controller('audit-logs')
@Roles(RoleName.SUPER_ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async findAll(@Query() query: PaginationQueryDto) {
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
      this.auditService.findMany({ skip, take: query.limit }),
      this.auditService.count({}),
    ]);
    return { data, meta: { total, page: query.page, limit: query.limit } };
  }
}
