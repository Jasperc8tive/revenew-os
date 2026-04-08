// Mock data for dashboard
export const mockRevenueData = [
  { date: 'Mar 1', revenue: 850000, trend: -2 },
  { date: 'Mar 2', revenue: 920000, trend: 8 },
  { date: 'Mar 3', revenue: 880000, trend: -4 },
  { date: 'Mar 4', revenue: 1050000, trend: 19 },
  { date: 'Mar 5', revenue: 1120000, trend: 7 },
  { date: 'Mar 6', revenue: 980000, trend: -12 },
  { date: 'Mar 7', revenue: 1250000, trend: 27 },
  { date: 'Mar 8', revenue: 1180000, trend: -5 },
  { date: 'Mar 9', revenue: 1450000, trend: 22 },
  { date: 'Mar 10', revenue: 1320000, trend: -8 },
  { date: 'Mar 11', revenue: 1580000, trend: 19 },
  { date: 'Mar 12', revenue: 1680000, trend: 6 },
  { date: 'Mar 13', revenue: 1550000, trend: -7 },
  { date: 'Mar 14', revenue: 1820000, trend: 17 },
  { date: 'Mar 15', revenue: 1750000, trend: -3 },
  { date: 'Mar 16', revenue: 2050000, trend: 17 },
  { date: 'Mar 17', revenue: 1950000, trend: -4 },
  { date: 'Mar 18', revenue: 2180000, trend: 11 },
  { date: 'Mar 19', revenue: 2340000, trend: 7 },
  { date: 'Mar 20', revenue: 2280000, trend: -2 },
  { date: 'Mar 21', revenue: 2520000, trend: 10 },
  { date: 'Mar 22', revenue: 2450000, trend: -2 },
  { date: 'Mar 23', revenue: 2680000, trend: 9 },
  { date: 'Mar 24', revenue: 2750000, trend: 2 },
  { date: 'Mar 25', revenue: 2820000, trend: 2 },
  { date: 'Mar 26', revenue: 2980000, trend: 5 },
  { date: 'Mar 27', revenue: 3050000, trend: 2 },
  { date: 'Mar 28', revenue: 3180000, trend: 4 },
  { date: 'Mar 29', revenue: 3250000, trend: 2 },
  { date: 'Mar 30', revenue: 3380000, trend: 4 },
];

export const mockCACLTVData = [
  { period: 'Week 1', cac: 45000, ltv: 180000, ratio: 4.0 },
  { period: 'Week 2', cac: 48000, ltv: 195000, ratio: 4.06 },
  { period: 'Week 3', cac: 52000, ltv: 210000, ratio: 4.04 },
  { period: 'Week 4', cac: 50000, ltv: 225000, ratio: 4.5 },
];

export const mockMetrics = {
  revenue: {
    value: '₦3,380,000',
    trend: { value: 23, direction: 'up' as const, period: 'vs last month' },
  },
  cac: {
    value: '₦50,000',
    trend: { value: 4, direction: 'down' as const, period: 'vs last month' },
  },
  ltv: {
    value: '₦225,000',
    trend: { value: 18, direction: 'up' as const, period: 'vs last month' },
  },
  churn: {
    value: '2.8%',
    trend: { value: 0.2, direction: 'up' as const, period: 'vs last month' },
  },
  arpu: {
    value: '₦42,500',
    trend: { value: 8, direction: 'up' as const, period: 'vs last month' },
  },
  customerCount: {
    value: '847',
    trend: { value: 12, direction: 'up' as const, period: 'vs last month' },
  },
};

export const mockInsights = [
  {
    id: 1,
    title: 'CAC is trending down 👇',
    description:
      'Your Customer Acquisition Cost decreased by 4% this month. This indicates improved marketing efficiency and could be an opportunity to increase ad spend.',
    impact: 'low' as const,
    confidenceScore: 92,
    action: { label: 'View Details', onClick: () => {} },
  },
  {
    id: 2,
    title: 'Churn rate elevated ⚠️',
    description:
      'Your churn rate has increased to 2.8% (from 2.6%). Monitor this closely. This could impact LTV significantly if not addressed.',
    impact: 'high' as const,
    confidenceScore: 88,
    action: { label: 'Take Action', onClick: () => {} },
  },
  {
    id: 3,
    title: 'LTV/CAC ratio healthy ✅',
    description:
      'Your LTV:CAC ratio remains strong at 4.5:1, well above the 3:1 benchmark. Your business unit economics are solid.',
    impact: 'low' as const,
    confidenceScore: 95,
    action: { label: 'Explore', onClick: () => {} },
  },
  {
    id: 4,
    title: 'Revenue acceleration detected 📈',
    description:
      'Daily revenue is growing at an accelerating rate (23% MoM). At this pace, you could reach ₦4M monthly run rate next month.',
    impact: 'medium' as const,
    confidenceScore: 85,
    action: { label: 'Forecast', onClick: () => {} },
  },
];

export const mockPipelineData = [
  { stage: 'Lead', count: 285, value: 3200000 },
  { stage: 'Negotiation', count: 48, value: 680000 },
  { stage: 'Proposal', count: 32, value: 920000 },
  { stage: 'Closed-Won', count: 24, value: 1250000 },
];

export const mockCohortData = {
  headers: ['Cohort', 'Month 0', 'Month 1', 'Month 2', 'Month 3', 'Month 4'],
  rows: [
    { cohort: 'Jan 2026', data: [100, 85, 72, 65, 58] },
    { cohort: 'Feb 2026', data: [100, 82, 70, 62] },
    { cohort: 'Mar 2026', data: [100, 88, 76] },
    { cohort: 'Apr 2026', data: [100, 90] },
    { cohort: 'May 2026', data: [100] },
  ],
};

export const mockChannelPerformance = [
  { channel: 'Direct Sales', customers: 340, cac: 35000, ltv: 280000 },
  { channel: 'Social Media', customers: 285, cac: 12000, ltv: 150000 },
  { channel: 'Referral', customers: 142, cac: 8000, ltv: 220000 },
  { channel: 'Organic Search', customers: 80, cac: 5000, ltv: 180000 },
];
