'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART_INK, SEQUENTIAL_BLUE_ORDINAL } from '@/lib/chart-colors';
import type { DashboardSummary } from '@/lib/dashboard-api';

const TIERS: { key: keyof DashboardSummary['talukaAgingBreakdown'][number]; label: string }[] = [
  { key: 'current', label: 'Current' },
  { key: 'days1To30', label: '1-30 days' },
  { key: 'days31To60', label: '31-60 days' },
  { key: 'days61To90', label: '61-90 days' },
  { key: 'days90Plus', label: '90+ days' },
];

export function TalukaAgingStackedChart({ data }: { data: DashboardSummary['talukaAgingBreakdown'] }) {
  const rows = data.map((row) => ({
    taluka: row.taluka,
    Current: Number(row.current),
    '1-30 days': Number(row.days1To30),
    '31-60 days': Number(row.days31To60),
    '61-90 days': Number(row.days61To90),
    '90+ days': Number(row.days90Plus),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_INK.gridline} vertical={false} />
        <XAxis dataKey="taluka" stroke={CHART_INK.muted} tick={{ fill: CHART_INK.secondary, fontSize: 12 }} />
        <YAxis stroke={CHART_INK.muted} tick={{ fill: CHART_INK.secondary, fontSize: 12 }} />
        <Tooltip />
        <Legend />
        {TIERS.map((tier, index) => (
          <Bar
            key={tier.label}
            dataKey={tier.label}
            stackId="aging"
            fill={SEQUENTIAL_BLUE_ORDINAL[index]}
            radius={index === TIERS.length - 1 ? [4, 4, 0, 0] : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
