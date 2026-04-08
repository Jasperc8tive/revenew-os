export interface CACInput {
  totalMarketingSpend: number;
  newCustomers: number;
}

export interface CACSegment {
  key: string;
  spend: number;
  newCustomers: number;
  cac: number;
}

export function calculateCAC(input: CACInput): number {
  if (input.newCustomers <= 0) {
    return 0;
  }

  return input.totalMarketingSpend / input.newCustomers;
}

export function calculateCACBySegments(segments: Array<Omit<CACSegment, 'cac'>>): CACSegment[] {
  return segments.map((segment) => ({
    ...segment,
    cac: calculateCAC({
      totalMarketingSpend: segment.spend,
      newCustomers: segment.newCustomers,
    }),
  }));
}
