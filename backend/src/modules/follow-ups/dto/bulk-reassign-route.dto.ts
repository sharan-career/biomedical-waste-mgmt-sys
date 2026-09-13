import { IsUUID } from 'class-validator';

export class BulkReassignRouteDto {
  @IsUUID()
  routeId: string;

  @IsUUID()
  assignedToId: string;
}
