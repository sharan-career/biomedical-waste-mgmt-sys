import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { CustomersService } from './customers.service';
import { CreateCustomerContactDto } from './dto/create-customer-contact.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { UpdateCustomerContactDto } from './dto/update-customer-contact.dto';
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

const CAN_MANAGE = [RoleName.SUPER_ADMIN, RoleName.ACCOUNTS_MANAGER];

@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  // No @Roles() — any authenticated user (Collection Executives, Management) can view.
  @Get()
  findAll(@Query() query: CustomerQueryDto) {
    return this.customersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customersService.findOneOrThrow(id);
  }

  @Post()
  @Roles(...CAN_MANAGE)
  create(
    @Body() dto: CreateCustomerDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.customersService.create(dto, actor.id);
  }

  @Patch(':id')
  @Roles(...CAN_MANAGE)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.customersService.update(id, dto, actor.id);
  }

  @Patch(':id/status')
  @Roles(...CAN_MANAGE)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.customersService.updateStatus(id, dto.status, actor.id);
  }

  @Post(':id/contacts')
  @Roles(...CAN_MANAGE)
  addContact(
    @Param('id') id: string,
    @Body() dto: CreateCustomerContactDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.customersService.addContact(id, dto, actor.id);
  }

  @Patch(':id/contacts/:contactId')
  @Roles(...CAN_MANAGE)
  updateContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateCustomerContactDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.customersService.updateContact(id, contactId, dto, actor.id);
  }

  @Delete(':id/contacts/:contactId')
  @Roles(...CAN_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.customersService.removeContact(id, contactId, actor.id);
  }
}
