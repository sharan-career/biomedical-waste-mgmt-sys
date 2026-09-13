'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { RequireAuth } from '@/components/require-auth';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import {
  approveCreditNote,
  applyCreditNote,
  approveInvoice,
  cancelInvoice,
  createCreditNote,
  getInvoice,
  getOrgProfile,
  listCreditNotes,
  sendInvoice,
} from '@/lib/billing-api';
import { amountInWordsIndia } from '@/lib/number-to-words';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

function InvoiceDetailContent() {
  const params = useParams<{ id: string }>();
  const invoiceId = params.id;
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [showCreditNoteForm, setShowCreditNoteForm] = useState(false);
  const [creditReason, setCreditReason] = useState('');
  const [creditAmount, setCreditAmount] = useState('');

  const { data: invoiceData, isLoading } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => getInvoice(invoiceId),
  });
  const { data: orgData } = useQuery({ queryKey: ['org-profile'], queryFn: getOrgProfile });
  const { data: creditNotesData } = useQuery({
    queryKey: ['invoice-credit-notes', invoiceId],
    queryFn: () => listCreditNotes(invoiceId),
  });

  const canManage = hasRole('SUPER_ADMIN', 'ACCOUNTS_MANAGER');
  const invoice = invoiceData?.data;
  const org = orgData?.data;
  const creditNotes = creditNotesData?.data ?? [];

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
    await queryClient.invalidateQueries({ queryKey: ['invoice-credit-notes', invoiceId] });
  };

  const handleApprove = async () => {
    setError(null);
    try {
      await approveInvoice(invoiceId);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to approve invoice.');
    }
  };

  const handleSend = async () => {
    setError(null);
    try {
      await sendInvoice(invoiceId);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send invoice.');
    }
  };

  const handleCancel = async () => {
    const reason = window.prompt('Reason for cancelling this invoice?');
    if (!reason) return;
    setError(null);
    try {
      await cancelInvoice(invoiceId, reason);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to cancel invoice.');
    }
  };

  const handleCreateCreditNote = async () => {
    const amount = Number(creditAmount);
    if (!creditReason.trim() || !amount) return;
    setError(null);
    try {
      await createCreditNote(invoiceId, { reason: creditReason, amount });
      setCreditReason('');
      setCreditAmount('');
      setShowCreditNoteForm(false);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create credit note.');
    }
  };

  if (isLoading) return <div className="p-8 text-sm text-gray-500">Loading…</div>;
  if (!invoice) return <div className="p-8 text-sm text-red-600">Invoice not found.</div>;

  const cgstTotal = invoice.lineItems.reduce((sum, l) => sum + Number(l.cgstAmount), 0);
  const sgstTotal = invoice.lineItems.reduce((sum, l) => sum + Number(l.sgstAmount), 0);

  return (
    <div className="min-h-screen bg-gray-50 p-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-3xl space-y-4 print:max-w-none">
        <div className="flex items-center justify-between print:hidden">
          <Link href={`/contracts/${invoice.contractId}`} className="text-sm text-blue-600 hover:underline">
            ← {invoice.contract.contractNumber}
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Print
            </button>
            {canManage && invoice.status === 'DRAFT' && (
              <button
                onClick={() => void handleApprove()}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
              >
                Approve
              </button>
            )}
            {canManage && invoice.status === 'APPROVED' && (
              <button
                onClick={() => void handleSend()}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
              >
                Mark Sent
              </button>
            )}
            {canManage && invoice.status !== 'CANCELLED' && (
              <button
                onClick={() => void handleCancel()}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 print:hidden">{error}</p>}

        {/* Tax Invoice — layout mirrors the company's real invoice format */}
        <div className="rounded-lg border border-gray-300 bg-white p-6 text-sm shadow-sm print:border-black print:shadow-none">
          <h1 className="text-center text-base font-semibold">Tax Invoice</h1>
          <p className="text-center text-xs text-gray-600">COMMON BIO-MEDICAL WASTE TREATMENT FACILITY</p>

          <div className="mt-4 grid grid-cols-2 gap-4 border border-gray-300">
            <div className="border-r border-gray-300 p-3">
              <p className="font-semibold">{org?.name}</p>
              <p className="whitespace-pre-line text-xs text-gray-700">{org?.address}</p>
              <p className="text-xs text-gray-700">Mobile No: {org?.mobile}</p>
              <p className="text-xs text-gray-700">GSTIN/UIN: {org?.gstin}</p>
              <p className="text-xs text-gray-700">
                State Name: {org?.stateName}, Code: {org?.stateCode}
              </p>
            </div>
            <div className="p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Invoice No.</span>
                <span className="font-medium">{invoice.invoiceNumber}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-gray-500">Dated</span>
                <span className="font-medium">{formatDate(invoice.invoiceDate)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-gray-500">Due Date</span>
                <span className="font-medium">{formatDate(invoice.dueDate)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-gray-500">Billing Period</span>
                <span className="font-medium">
                  {formatDate(invoice.billingPeriodStart)} – {formatDate(invoice.billingPeriodEnd)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-2 border border-gray-300 p-3 text-xs">
            <p className="text-gray-500">Buyer (Bill to)</p>
            <p className="font-semibold">{invoice.customer.organizationName}</p>
            <p className="text-gray-700">Customer Code: {invoice.customer.customerCode}</p>
          </div>

          <table className="mt-2 w-full border border-gray-300 text-xs">
            <thead>
              <tr className="border-b border-gray-300 bg-gray-50">
                <th className="border-r border-gray-300 p-2 text-left">Particulars</th>
                <th className="border-r border-gray-300 p-2 text-right">Qty</th>
                <th className="border-r border-gray-300 p-2 text-right">Rate</th>
                <th className="p-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((line) => (
                <tr key={line.id} className="border-b border-gray-200">
                  <td className="border-r border-gray-300 p-2">
                    {line.description}
                    {Number(line.cgstAmount) > 0 && (
                      <div className="mt-1 text-gray-500">
                        CGST {line.cgstRatePercent}% + SGST {line.sgstRatePercent}%
                      </div>
                    )}
                  </td>
                  <td className="border-r border-gray-300 p-2 text-right">{line.quantity}</td>
                  <td className="border-r border-gray-300 p-2 text-right">₹{line.unitAmount}</td>
                  <td className="p-2 text-right">₹{line.lineAmount}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="border-r border-t border-gray-300 p-2 text-right font-semibold">
                  Total
                </td>
                <td className="border-t border-gray-300 p-2 text-right font-semibold">
                  ₹{invoice.totalAmount}
                </td>
              </tr>
            </tfoot>
          </table>

          <p className="mt-2 text-xs">
            <span className="text-gray-500">Amount Chargeable (in words): </span>
            {amountInWordsIndia(Number(invoice.totalAmount))}
          </p>

          <table className="mt-2 w-full border border-gray-300 text-xs">
            <thead>
              <tr className="border-b border-gray-300 bg-gray-50">
                <th className="border-r border-gray-300 p-2 text-right">Taxable Value</th>
                <th className="border-r border-gray-300 p-2 text-right">CGST</th>
                <th className="border-r border-gray-300 p-2 text-right">SGST</th>
                <th className="p-2 text-right">Total Tax</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border-r border-gray-300 p-2 text-right">₹{invoice.subtotal}</td>
                <td className="border-r border-gray-300 p-2 text-right">₹{cgstTotal.toFixed(2)}</td>
                <td className="border-r border-gray-300 p-2 text-right">₹{sgstTotal.toFixed(2)}</td>
                <td className="p-2 text-right">₹{invoice.taxAmount}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-gray-500">Company&apos;s Bank Details</p>
              <p>Bank Name: {org?.bankName}</p>
              <p>A/c No.: {org?.bankAccountNo}</p>
              <p>Branch &amp; IFSC: {org?.bankBranchIfsc}</p>
            </div>
            <div className="text-right">
              <p className="mb-8">for {org?.name}</p>
              <p className="text-gray-500">Authorised Signatory</p>
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-gray-500">This is a Computer Generated Invoice</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm print:hidden">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Credit Notes</h2>
            {canManage && invoice.status !== 'CANCELLED' && (
              <button
                onClick={() => setShowCreditNoteForm((v) => !v)}
                className="text-sm text-blue-600 hover:underline"
              >
                {showCreditNoteForm ? 'Cancel' : '+ New Credit Note'}
              </button>
            )}
          </div>

          {showCreditNoteForm && (
            <div className="mb-4 grid grid-cols-1 gap-2 rounded-md bg-gray-50 p-3 sm:grid-cols-3">
              <input
                placeholder="Reason"
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm sm:col-span-2"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Amount"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
                <button
                  onClick={() => void handleCreateCreditNote()}
                  className="whitespace-nowrap rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </div>
          )}

          <ul className="divide-y divide-gray-100 text-sm">
            {creditNotes.length === 0 && <li className="py-2 text-gray-500">No credit notes.</li>}
            {creditNotes.map((cn) => (
              <li key={cn.id} className="flex items-center justify-between py-2">
                <div>
                  <span className="text-gray-900">{cn.reason}</span>{' '}
                  <span className="text-gray-500">₹{cn.amount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                    {cn.status}
                  </span>
                  {canManage && cn.status === 'DRAFT' && (
                    <button
                      onClick={() => void approveCreditNote(cn.id).then(refresh)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Approve
                    </button>
                  )}
                  {canManage && cn.status === 'APPROVED' && (
                    <button
                      onClick={() => void applyCreditNote(cn.id).then(refresh)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Apply
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function InvoiceDetailPage() {
  return (
    <RequireAuth>
      <InvoiceDetailContent />
    </RequireAuth>
  );
}
