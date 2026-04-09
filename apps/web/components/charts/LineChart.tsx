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
  Brush,
} from 'recharts';
import React from 'react';
import type { ChartZoomRange } from '@/lib/store/dashboardStore';

interface LineChartProps {
  data: Array<Record<string, unknown>>;
  dataKey: string;
  name?: string;
  stroke?: string;
  height?: number;
  withLegend?: boolean;
  xAxisKey?: string;
  zoomRange?: ChartZoomRange | null;
  onZoomChange?: (range: ChartZoomRange | null) => void;
  onPointClick?: (payload: Record<string, unknown>) => void;
  hidden?: boolean;
}

export function LineChart({
  data,
  dataKey,
  // name is available for future tooltip formatting
  stroke = '#4f46e5',
  height = 300,
  withLegend = false,
  xAxisKey = 'date',
  zoomRange,
  onZoomChange,
  onPointClick,
  hidden = false,
}: LineChartProps) {
  const handlePointClick = React.useCallback(
    (point: unknown) => {
      if (!onPointClick || !point || typeof point !== 'object') {
        return;
      }

      const maybePayload = (point as { payload?: unknown }).payload;
      if (maybePayload && typeof maybePayload === 'object') {
        onPointClick(maybePayload as Record<string, unknown>);
      }
    },
    [onPointClick],
  );

  const handleBrushChange = React.useCallback(
    (range?: { startIndex?: number; endIndex?: number }) => {
      if (!onZoomChange) {
        return;
      }

      if (
        !range ||
        typeof range.startIndex !== 'number' ||
        typeof range.endIndex !== 'number'
      ) {
        onZoomChange(null);
        return;
      }

      onZoomChange({ startIndex: range.startIndex, endIndex: range.endIndex });
    },
    [onZoomChange],
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
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
          cursor={{ stroke: '#4f46e5', strokeWidth: 2 }}
        />
        {withLegend && <Legend />}
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={stroke}
          dot={false}
          strokeWidth={2}
          hide={hidden}
          onClick={handlePointClick}
          isAnimationActive={true}
        />
        {onZoomChange ? (
          <Brush
            dataKey={xAxisKey}
            startIndex={zoomRange?.startIndex}
            endIndex={zoomRange?.endIndex}
            height={20}
            travellerWidth={10}
            stroke="#4f46e5"
            onChange={handleBrushChange}
          />
        ) : null}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
