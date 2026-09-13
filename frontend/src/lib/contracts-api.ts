import { apiRequest } from './api-client';
import type { BillingFrequency, Contract, ContractStatus, Paginated, RateCard, RateCardComponentType } from './types';

export interface ContractListParams {
  page?: number;
  limit?: number;
  customerId?: string;
  status?: ContractStatus;
}

function buildQueryString(params: ContractListParams): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

export function listContracts(params: ContractListParams): Promise<Paginated<Contract>> {
  return apiRequest(`/contracts${buildQueryString(params)}`);
}

export function getContract(id: string): Promise<{ data: Contract }> {
  return apiRequest(`/contracts/${id}`);
}

export interface ContractFormValues {
  contractNumber: string;
  customerId: string;
  startDate: string;
  endDate?: string;
  billingFrequency: BillingFrequency;
  billingDayOfPeriod?: number;
  paymentTermsDays?: number;
  notes?: string;
}

export function createContract(dto: ContractFormValues): Promise<{ data: Contract }> {
  return apiRequest('/contracts', { method: 'POST', body: dto });
}

export function updateContractStatus(
  id: string,
  status: 'EXPIRED' | 'TERMINATED',
): Promise<{ data: Contract }> {
  return apiRequest(`/contracts/${id}/status`, { method: 'PATCH', body: { status } });
}

export interface RateCardComponentInput {
  componentType: RateCardComponentType;
  unitAmount: number;
  taxable?: boolean;
}

export interface RateCardFormValues {
  name: string;
  effectiveFrom: string;
  effectiveTo?: string;
  components: RateCardComponentInput[];
}

export function listRateCards(contractId: string): Promise<{ data: RateCard[] }> {
  return apiRequest(`/contracts/${contractId}/rate-cards`);
}

export function createRateCard(
  contractId: string,
  dto: RateCardFormValues,
): Promise<{ data: RateCard }> {
  return apiRequest(`/contracts/${contractId}/rate-cards`, { method: 'POST', body: dto });
}

export function activateRateCard(contractId: string, rateCardId: string): Promise<{ data: Contract }> {
  return apiRequest(`/contracts/${contractId}/activate-rate-card`, {
    method: 'PATCH',
    body: { rateCardId },
  });
}
