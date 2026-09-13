import { IsIn } from 'class-validator';

// Only terminal transitions are settable here — ACTIVE is only reachable by
// activating a rate card (see ContractsService.activateRateCard), and DRAFT is
// the only allowed starting status, never something you transition back into.
export class UpdateContractStatusDto {
  @IsIn(['EXPIRED', 'TERMINATED'])
  status: 'EXPIRED' | 'TERMINATED';
}
