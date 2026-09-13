export type CustomerType = 'PRIVATE' | 'GOVERNMENT';
export type FacilityType = 'BEDDED_HOSPITAL' | 'CLINIC' | 'DENTAL_CLINIC' | 'LAB' | 'OTHER';
export type CustomerStatus = 'ACTIVE' | 'INACTIVE';
export type ContactType = 'PRIMARY' | 'ACCOUNTS' | 'OTHER';

export interface Route {
  id: string;
  routeNumber: number;
  name: string | null;
}

export interface Taluka {
  id: string;
  name: string;
  districtName: string;
  routes: Route[];
}

export interface CustomerContact {
  id: string;
  customerId: string;
  contactType: ContactType;
  name: string;
  phone: string | null;
  email: string | null;
}

export interface Customer {
  id: string;
  customerCode: string;
  organizationName: string;
  customerType: CustomerType;
  facilityType: FacilityType;
  bedCount: number | null;
  talukaId: string;
  routeId: string | null;
  address: string;
  city: string;
  state: string;
  pincode: string;
  gstNumber: string | null;
  panNumber: string | null;
  paymentTermsDays: number;
  status: CustomerStatus;
  taluka: Taluka;
  route: Route | null;
  contacts: CustomerContact[];
}

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number };
}
