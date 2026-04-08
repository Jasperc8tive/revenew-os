'use client';

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import React from 'react';

interface BarChartProps {
  data: Array<Record<string, unknown>>;
  dataKeys: Array<{ key: string; fill: string; name?: string }>;
  height?: number;
  withLegend?: boolean;
  xAxisKey?: string;
}

export function BarChart({
  data,
  dataKeys,
  height = 300,
  withLegend = true,
  xAxisKey = 'period',
}: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
        <XAxis
          dataKey={xAxisKey}
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
        />
        {withLegend && <Legend />}
        {dataKeys.map((item) => (
          <Bar
            key={item.key}
            dataKey={item.key}
            fill={item.fill}
            name={item.name || item.key}
            isAnimationActive={true}
          />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
