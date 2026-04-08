export function calculateMRR(recurringRevenueForMonth: number): number {
  return recurringRevenueForMonth;
}

export function calculateARR(monthlyRecurringRevenue: number): number {
  return monthlyRecurringRevenue * 12;
}

export function calculateRevenueGrowthRate(currentRevenue: number, previousRevenue: number): number {
  if (previousRevenue === 0) {
    return 0;
  }

  return (currentRevenue - previousRevenue) / previousRevenue;
}

export function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(amount);
}
