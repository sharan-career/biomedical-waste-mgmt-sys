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

export type InvoiceStatus = 'DRAFT' | 'APPROVED' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
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
  paidAmount: string;
  outstandingAmount: string;
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

export type PaymentMode = 'BANK_TRANSFER' | 'UPI' | 'CHEQUE' | 'CASH' | 'OTHER';
export type PaymentStatus = 'RECORDED' | 'REVERSED';

export interface PaymentAllocation {
  id: string;
  paymentId: string;
  invoiceId: string | null;
  allocatedAmount: string;
  invoice: { id: string; invoiceNumber: string } | null;
}

export interface Payment {
  id: string;
  customerId: string;
  amount: string;
  paymentMode: PaymentMode;
  paymentDate: string;
  referenceNumber: string | null;
  bankDetails: string | null;
  notes: string | null;
  status: PaymentStatus;
  reversalOfPaymentId: string | null;
  customer: { id: string; customerCode: string; organizationName: string };
  allocations: PaymentAllocation[];
}

export interface AgingBuckets {
  current: string;
  days1To30: string;
  days31To60: string;
  days61To90: string;
  days90Plus: string;
}

export interface AgingInvoiceItem {
  invoiceId: string;
  invoiceNumber: string;
  customer: { id: string; customerCode: string; organizationName: string };
  dueDate: string;
  outstandingAmount: string;
  daysPastDue: number;
  bucket: keyof AgingBuckets;
}

export interface AgingReport {
  buckets: AgingBuckets;
  invoices: AgingInvoiceItem[];
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

export type FollowUpType = 'PHONE_CALL' | 'WHATSAPP' | 'EMAIL' | 'VISIT' | 'OTHER';
export type FollowUpStatus =
  | 'OPEN'
  | 'FOLLOW_UP_REQUIRED'
  | 'PROMISE_TO_PAY'
  | 'DISPUTED'
  | 'ESCALATED'
  | 'CLOSED';

export interface FollowUp {
  id: string;
  customerId: string;
  invoiceId: string | null;
  assignedToId: string;
  previousAssignedToId: string | null;
  followUpDate: string;
  followUpType: FollowUpType;
  contactPerson: string | null;
  discussionNotes: string | null;
  customerResponse: string | null;
  promiseAmount: string | null;
  promisePaymentDate: string | null;
  nextFollowUpDate: string | null;
  status: FollowUpStatus;
  previousFollowUpId: string | null;
  isSystemGenerated: boolean;
  customer: { id: string; customerCode: string; organizationName: string; routeId: string | null };
  invoice: { id: string; invoiceNumber: string; outstandingAmount: string } | null;
  assignedTo: { id: string; fullName: string };
}

export type ReminderTriggerType = 'DAYS_BEFORE_DUE' | 'ON_DUE_DATE' | 'DAYS_AFTER_DUE';
export type ReminderChannel = 'WHATSAPP' | 'EMAIL' | 'SMS';
export type ReminderDeliveryStatus = 'SENT' | 'FAILED' | 'DELIVERED' | 'READ';

export interface ReminderRule {
  id: string;
  name: string;
  triggerType: ReminderTriggerType;
  triggerOffsetDays: number;
  channel: ReminderChannel;
  messageTemplate: string;
  active: boolean;
}

export interface ReminderLog {
  id: string;
  ruleId: string;
  customerId: string;
  invoiceId: string;
  channel: ReminderChannel;
  message: string;
  sentAt: string | null;
  deliveryStatus: ReminderDeliveryStatus;
  retryCount: number;
  lastError: string | null;
  rule: { id: string; name: string };
  customer: { id: string; customerCode: string; organizationName: string };
  invoice: { id: string; invoiceNumber: string };
}
