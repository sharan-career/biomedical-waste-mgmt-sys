'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { listTalukas } from '@/lib/customers-api';
import type { Customer } from '@/lib/types';

const customerFormSchema = z.object({
  customerCode: z.string().min(2, 'Required'),
  organizationName: z.string().min(2, 'Required'),
  customerType: z.enum(['PRIVATE', 'GOVERNMENT']),
  facilityType: z.enum(['BEDDED_HOSPITAL', 'CLINIC', 'DENTAL_CLINIC', 'LAB', 'OTHER']),
  bedCount: z.preprocess(
    (val) => (val === '' || val === undefined ? undefined : Number(val)),
    z.number().int().min(0).optional(),
  ),
  talukaId: z.string().uuid('Select a taluka'),
  routeId: z.string().optional(),
  address: z.string().min(2, 'Required'),
  city: z.string().min(2, 'Required'),
  state: z.string().min(2, 'Required'),
  pincode: z.string().min(4, 'Required'),
  gstNumber: z.string().optional(),
  panNumber: z.string().optional(),
  paymentTermsDays: z.preprocess(
    (val) => (val === '' || val === undefined ? undefined : Number(val)),
    z.number().int().min(0).optional(),
  ),
});

export type CustomerFormData = z.infer<typeof customerFormSchema>;

export function customerToFormDefaults(customer?: Customer): CustomerFormData {
  if (!customer) {
    return {
      customerCode: '',
      organizationName: '',
      customerType: 'PRIVATE',
      facilityType: 'CLINIC',
      bedCount: undefined,
      talukaId: '',
      routeId: undefined,
      address: '',
      city: '',
      state: '',
      pincode: '',
      gstNumber: undefined,
      panNumber: undefined,
      paymentTermsDays: 30,
    };
  }
  return {
    customerCode: customer.customerCode,
    organizationName: customer.organizationName,
    customerType: customer.customerType,
    facilityType: customer.facilityType,
    bedCount: customer.bedCount ?? undefined,
    talukaId: customer.talukaId,
    routeId: customer.routeId ?? undefined,
    address: customer.address,
    city: customer.city,
    state: customer.state,
    pincode: customer.pincode,
    gstNumber: customer.gstNumber ?? undefined,
    panNumber: customer.panNumber ?? undefined,
    paymentTermsDays: customer.paymentTermsDays,
  };
}

const inputClass =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
const labelClass = 'mb-1 block text-sm font-medium text-gray-700';
const errorClass = 'mt-1 text-xs text-red-600';

export function CustomerForm({
  defaultValues,
  onSubmit,
  submitLabel,
}: {
  defaultValues: CustomerFormData;
  onSubmit: (values: CustomerFormData) => Promise<void>;
  submitLabel: string;
}) {
  const { data: talukasResponse } = useQuery({
    queryKey: ['talukas'],
    queryFn: listTalukas,
  });
  const talukas = talukasResponse?.data ?? [];

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(customerFormSchema),
    defaultValues,
  });

  const selectedTalukaId = watch('talukaId');
  const routesForTaluka = talukas.find((t) => t.id === selectedTalukaId)?.routes ?? [];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Customer code</label>
          <input className={inputClass} {...register('customerCode')} />
          {errors.customerCode && <p className={errorClass}>{errors.customerCode.message}</p>}
        </div>
        <div>
          <label className={labelClass}>Organization name</label>
          <input className={inputClass} {...register('organizationName')} />
          {errors.organizationName && <p className={errorClass}>{errors.organizationName.message}</p>}
        </div>

        <div>
          <label className={labelClass}>Customer type</label>
          <select className={inputClass} {...register('customerType')}>
            <option value="PRIVATE">Private</option>
            <option value="GOVERNMENT">Government</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Facility type</label>
          <select className={inputClass} {...register('facilityType')}>
            <option value="BEDDED_HOSPITAL">Bedded Hospital</option>
            <option value="CLINIC">Clinic</option>
            <option value="DENTAL_CLINIC">Dental Clinic</option>
            <option value="LAB">Lab</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Bed count (if applicable)</label>
          <input type="number" className={inputClass} {...register('bedCount')} />
        </div>
        <div>
          <label className={labelClass}>Payment terms (days)</label>
          <input type="number" className={inputClass} {...register('paymentTermsDays')} />
        </div>

        <div>
          <label className={labelClass}>Taluka</label>
          <select className={inputClass} {...register('talukaId')}>
            <option value="">Select a taluka</option>
            {talukas.map((taluka) => (
              <option key={taluka.id} value={taluka.id}>
                {taluka.name}
              </option>
            ))}
          </select>
          {errors.talukaId && <p className={errorClass}>{errors.talukaId.message}</p>}
        </div>
        <div>
          <label className={labelClass}>Route (optional)</label>
          <select className={inputClass} disabled={!selectedTalukaId} {...register('routeId')}>
            <option value="">No route assigned yet</option>
            {routesForTaluka.map((route) => (
              <option key={route.id} value={route.id}>
                {route.routeNumber}
                {route.name ? ` — ${route.name}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Address</label>
          <input className={inputClass} {...register('address')} />
          {errors.address && <p className={errorClass}>{errors.address.message}</p>}
        </div>
        <div>
          <label className={labelClass}>City</label>
          <input className={inputClass} {...register('city')} />
          {errors.city && <p className={errorClass}>{errors.city.message}</p>}
        </div>
        <div>
          <label className={labelClass}>State</label>
          <input className={inputClass} {...register('state')} />
          {errors.state && <p className={errorClass}>{errors.state.message}</p>}
        </div>
        <div>
          <label className={labelClass}>Pincode</label>
          <input className={inputClass} {...register('pincode')} />
          {errors.pincode && <p className={errorClass}>{errors.pincode.message}</p>}
        </div>

        <div>
          <label className={labelClass}>GST number (optional)</label>
          <input className={inputClass} {...register('gstNumber')} />
        </div>
        <div>
          <label className={labelClass}>PAN number (optional)</label>
          <input className={inputClass} {...register('panNumber')} />
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
