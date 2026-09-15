'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CATEGORICAL_COLORS, CHART_INK } from '@/lib/chart-colors';

export function MonthlyCollectionChart({ data }: { data: { month: string; totalCollected: string }[] }) {
  const rows = data.map((d) => ({ month: d.month, Collected: Number(d.totalCollected) }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_INK.gridline} vertical={false} />
        <XAxis dataKey="month" stroke={CHART_INK.muted} tick={{ fill: CHART_INK.secondary, fontSize: 12 }} />
        <YAxis stroke={CHART_INK.muted} tick={{ fill: CHART_INK.secondary, fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="Collected" fill={CATEGORICAL_COLORS[0]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
