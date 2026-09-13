import { Controller, Param, Patch } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { CreditNotesService } from './credit-notes.service';

const CAN_MANAGE = [RoleName.SUPER_ADMIN, RoleName.ACCOUNTS_MANAGER];

@Controller('credit-notes')
export class CreditNotesController {
  constructor(private readonly creditNotesService: CreditNotesService) {}

  @Patch(':id/approve')
  @Roles(...CAN_MANAGE)
  approve(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.creditNotesService.approve(id, actor.id);
  }

  @Patch(':id/apply')
  @Roles(...CAN_MANAGE)
  apply(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.creditNotesService.apply(id, actor.id);
  }
}
