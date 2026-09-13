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

export type BillingFrequency = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY' | 'CUSTOM';
export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED';
export type RateCardStatus = 'DRAFT' | 'ACTIVE' | 'SUPERSEDED';
export type RateCardComponentType =
  | 'FIXED_FEE'
  | 'PER_PICKUP'
  | 'PER_BED'
  | 'SERVICE_CHARGE'
  | 'DISCOUNT';

export interface RateCardComponent {
  id: string;
  rateCardId: string;
  componentType: RateCardComponentType;
  unitAmount: string;
  taxable: boolean;
}

export interface RateCard {
  id: string;
  name: string;
  customerId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: RateCardStatus;
  components: RateCardComponent[];
}

export interface Contract {
  id: string;
  contractNumber: string;
  customerId: string;
  startDate: string;
  endDate: string | null;
  billingFrequency: BillingFrequency;
  billingDayOfPeriod: number | null;
  paymentTermsDays: number | null;
  status: ContractStatus;
  activeRateCardId: string | null;
  notes: string | null;
  customer: { id: string; customerCode: string; organizationName: string };
  activeRateCard: RateCard | null;
}

export type InvoiceStatus = 'DRAFT' | 'APPROVED' | 'SENT' | 'CANCELLED';
export type CreditNoteStatus = 'DRAFT' | 'APPROVED' | 'APPLIED';

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  lineType: RateCardComponentType;
  quantity: string;
  unitAmount: string;
  lineAmount: string;
  taxableAmount: string;
  cgstRatePercent: string;
  cgstAmount: string;
  sgstRatePercent: string;
  sgstAmount: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  contractId: string;
  invoiceDate: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  dueDate: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  status: InvoiceStatus;
  cancelledReason: string | null;
  notes: string | null;
  customer: { id: string; customerCode: string; organizationName: string };
  contract: { id: string; contractNumber: string };
  lineItems: InvoiceLineItem[];
}

export interface CreditNoteLineItem {
  id: string;
  creditNoteId: string;
  description: string;
  amount: string;
}

export interface CreditNote {
  id: string;
  invoiceId: string;
  customerId: string;
  reason: string;
  amount: string;
  status: CreditNoteStatus;
  lineItems: CreditNoteLineItem[];
}

export interface OrgProfile {
  name: string;
  address: string;
  mobile: string;
  email: string;
  gstin: string;
  stateName: string;
  stateCode: string;
  bankName: string;
  bankAccountNo: string;
  bankBranchIfsc: string;
}
