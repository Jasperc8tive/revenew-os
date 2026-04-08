import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface AreaChartProps {
  data: Record<string, unknown>[];
  dataKey: string;
  stroke?: string;
  fill?: string;
  xAxisKey?: string;
  height?: number;
  showGrid?: boolean;
  showTooltip?: boolean;
}

export function AreaChart({
  data,
  dataKey,
  stroke = '#4f46e5',
  fill = '#4f46e5',
  xAxisKey = 'name',
  height = 300,
  showGrid = true,
  showTooltip = true,
}: AreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={data}>
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(203, 213, 225, 0.5)"
          />
        )}
        <XAxis
          dataKey={xAxisKey}
          stroke="rgb(148, 163, 184)"
          style={{ fontSize: '12px' }}
        />
        <YAxis stroke="rgb(148, 163, 184)" style={{ fontSize: '12px' }} />
        {showTooltip && (
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgb(30, 41, 59)',
              border: '1px solid rgb(71, 85, 105)',
              borderRadius: '8px',
              color: 'white',
            }}
          />
        )}
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={stroke}
          fill={fill}
          strokeWidth={2}
          dot={false}
          isAnimationActive={true}
          animationDuration={800}
        />
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
}
