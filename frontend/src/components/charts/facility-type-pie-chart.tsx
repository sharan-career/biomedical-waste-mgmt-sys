'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { CATEGORICAL_COLORS } from '@/lib/chart-colors';

const FACILITY_LABELS: Record<string, string> = {
  BEDDED_HOSPITAL: 'Bedded Hospital',
  CLINIC: 'Clinic',
  DENTAL_CLINIC: 'Dental Clinic',
  LAB: 'Lab',
  OTHER: 'Other',
};

export function FacilityTypePieChart({ data }: { data: { facilityType: string; count: number }[] }) {
  const rows = data.map((d) => ({ name: FACILITY_LABELS[d.facilityType] ?? d.facilityType, value: d.count }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={rows}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
          label={({ name, value }) => `${name}: ${value}`}
        >
          {rows.map((_, index) => (
            <Cell key={index} fill={CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend verticalAlign="bottom" height={36} />
      </PieChart>
    </ResponsiveContainer>
  );
}
