export interface PipelineVelocityInput {
  dealCount: number;
  averageDealValue: number;
  winRate: number;
  salesCycleLengthDays: number;
}

export function calculatePipelineVelocity(input: PipelineVelocityInput): number {
  if (input.salesCycleLengthDays <= 0) {
    return 0;
  }

  return (
    (input.dealCount * input.averageDealValue * input.winRate) /
    input.salesCycleLengthDays
  );
}