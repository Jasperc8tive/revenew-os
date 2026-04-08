export interface LTVInput {
  averageRevenuePerCustomer: number;
  averageCustomerLifetimeMonths: number;
}

export function calculateLTV(input: LTVInput): number {
  return input.averageRevenuePerCustomer * input.averageCustomerLifetimeMonths;
}

export function calculateAverageRevenuePerCustomer(totalRevenue: number, customerCount: number): number {
  if (customerCount <= 0) {
    return 0;
  }

  return totalRevenue / customerCount;
}

export function calculateAverageCustomerLifetimeMonths(
  lifetimeMonthValues: number[],
): number {
  if (lifetimeMonthValues.length === 0) {
    return 0;
  }

  const totalMonths = lifetimeMonthValues.reduce((sum, months) => sum + months, 0);
  return totalMonths / lifetimeMonthValues.length;
}
