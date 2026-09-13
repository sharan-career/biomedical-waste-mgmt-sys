import { IsUUID } from 'class-validator';

export class ReassignFollowUpDto {
  @IsUUID()
  assignedToId: string;
}
