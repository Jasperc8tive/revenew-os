export interface ChurnInput {
  customersAtStart: number;
  customersLost: number;
}

export function calculateChurnRate(input: ChurnInput): number {
  if (input.customersAtStart <= 0) {
    return 0;
  }

  return input.customersLost / input.customersAtStart;
}

export function calculateMonthlyChurnRates(
  monthlySeries: Array<{ month: string; customersAtStart: number; customersLost: number }>,
): Array<{ month: string; churnRate: number }> {
  return monthlySeries.map((entry) => ({
    month: entry.month,
    churnRate: calculateChurnRate({
      customersAtStart: entry.customersAtStart,
      customersLost: entry.customersLost,
    }),
  }));
}
