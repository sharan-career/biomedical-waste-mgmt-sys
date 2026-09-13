import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { ActivateRateCardDto } from './dto/activate-rate-card.dto';
import { ContractQueryDto } from './dto/contract-query.dto';
import { CreateContractDto } from './dto/create-contract.dto';
import { CreateRateCardDto } from './dto/create-rate-card.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { UpdateContractStatusDto } from './dto/update-contract-status.dto';
import { ContractsService } from './contracts.service';

const CAN_MANAGE = [RoleName.SUPER_ADMIN, RoleName.ACCOUNTS_MANAGER];

@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  findAll(@Query() query: ContractQueryDto) {
    return this.contractsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contractsService.findOneOrThrow(id);
  }

  @Post()
  @Roles(...CAN_MANAGE)
  create(
    @Body() dto: CreateContractDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.contractsService.create(dto, actor.id);
  }

  @Patch(':id')
  @Roles(...CAN_MANAGE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateContractDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.contractsService.update(id, dto, actor.id);
  }

  @Patch(':id/status')
  @Roles(...CAN_MANAGE)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateContractStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.contractsService.updateStatus(id, dto.status, actor.id);
  }

  @Get(':id/rate-cards')
  listRateCards(@Param('id') id: string) {
    return this.contractsService.listRateCards(id);
  }

  @Post(':id/rate-cards')
  @Roles(...CAN_MANAGE)
  createRateCard(
    @Param('id') id: string,
    @Body() dto: CreateRateCardDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.contractsService.createRateCard(id, dto, actor.id);
  }

  @Patch(':id/activate-rate-card')
  @Roles(...CAN_MANAGE)
  activateRateCard(
    @Param('id') id: string,
    @Body() dto: ActivateRateCardDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.contractsService.activateRateCard(id, dto, actor.id);
  }
}
