'use client';

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import React from 'react';

interface LineChartProps {
  data: Array<Record<string, unknown>>;
  dataKey: string;
  name?: string;
  stroke?: string;
  height?: number;
  withLegend?: boolean;
}

export function LineChart({
  data,
  dataKey,
  // name is available for future tooltip formatting
  stroke = '#4f46e5',
  height = 300,
  withLegend = false,
}: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
        <XAxis
          dataKey="date"
          stroke="#94a3b8"
          className="dark:stroke-slate-500"
          style={{ fontSize: '12px' }}
        />
        <YAxis stroke="#94a3b8" className="dark:stroke-slate-500" style={{ fontSize: '12px' }} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '8px',
          }}
          labelStyle={{ color: '#f1f5f9' }}
          cursor={{ stroke: '#4f46e5', strokeWidth: 2 }}
        />
        {withLegend && <Legend />}
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={stroke}
          dot={false}
          strokeWidth={2}
          isAnimationActive={true}
        />
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
