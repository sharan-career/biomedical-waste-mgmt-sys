import { apiRequest } from './api-client';
import type {
  Customer,
  CustomerStatus,
  CustomerType,
  ContactType,
  FacilityType,
  Paginated,
  Taluka,
} from './types';

export interface CustomerListParams {
  page?: number;
  limit?: number;
  search?: string;
  talukaId?: string;
  routeId?: string;
  facilityType?: FacilityType;
  customerType?: CustomerType;
  status?: CustomerStatus;
}

function buildQueryString(params: CustomerListParams): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

export function listCustomers(params: CustomerListParams): Promise<Paginated<Customer>> {
  return apiRequest(`/customers${buildQueryString(params)}`);
}

export function getCustomer(id: string): Promise<{ data: Customer }> {
  return apiRequest(`/customers/${id}`);
}

export interface CustomerFormValues {
  customerCode: string;
  organizationName: string;
  customerType: CustomerType;
  facilityType: FacilityType;
  bedCount?: number;
  talukaId: string;
  routeId?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  gstNumber?: string;
  panNumber?: string;
  paymentTermsDays?: number;
}

export function createCustomer(dto: CustomerFormValues): Promise<{ data: Customer }> {
  return apiRequest('/customers', { method: 'POST', body: dto });
}

export function updateCustomer(
  id: string,
  dto: Partial<CustomerFormValues>,
): Promise<{ data: Customer }> {
  return apiRequest(`/customers/${id}`, { method: 'PATCH', body: dto });
}

export function updateCustomerStatus(
  id: string,
  status: CustomerStatus,
): Promise<{ data: Customer }> {
  return apiRequest(`/customers/${id}/status`, { method: 'PATCH', body: { status } });
}

export interface ContactFormValues {
  contactType: ContactType;
  name: string;
  phone?: string;
  email?: string;
}

export function addCustomerContact(customerId: string, dto: ContactFormValues) {
  return apiRequest(`/customers/${customerId}/contacts`, { method: 'POST', body: dto });
}

export function updateCustomerContact(
  customerId: string,
  contactId: string,
  dto: Partial<ContactFormValues>,
) {
  return apiRequest(`/customers/${customerId}/contacts/${contactId}`, {
    method: 'PATCH',
    body: dto,
  });
}

export function removeCustomerContact(customerId: string, contactId: string) {
  return apiRequest(`/customers/${customerId}/contacts/${contactId}`, { method: 'DELETE' });
}

export function listTalukas(): Promise<{ data: Taluka[] }> {
  return apiRequest('/talukas');
}
