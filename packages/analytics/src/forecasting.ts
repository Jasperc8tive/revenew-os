export interface ForecastPoint {
  period: string;
  value: number;
}

export function movingAverage(values: number[], windowSize: number): number[] {
  if (values.length === 0 || windowSize <= 0) {
    return [];
  }

  return values.map((_, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const window = values.slice(start, index + 1);
    return window.reduce((sum, value) => sum + value, 0) / window.length;
  });
}

export function extrapolateTrend(values: number[]): number {
  if (values.length <= 1) {
    return values[0] ?? 0;
  }

  const first = values[0];
  const last = values[values.length - 1];
  const periods = values.length - 1;
  return (last - first) / periods;
}

export function forecastRevenue(
  historicalData: ForecastPoint[],
  monthsToForecast: number,
): ForecastPoint[] {
  if (historicalData.length === 0 || monthsToForecast <= 0) {
    return [];
  }

  const values = historicalData.map((item) => item.value);
  const smoothed = movingAverage(values, Math.min(3, values.length));
  const trend = extrapolateTrend(smoothed);
  const latestPoint = historicalData[historicalData.length - 1];
  const latestDate = new Date(`${latestPoint.period}-01T00:00:00.000Z`);

  return Array.from({ length: monthsToForecast }).map((_, index) => {
    const projectedDate = new Date(latestDate);
    projectedDate.setUTCMonth(projectedDate.getUTCMonth() + index + 1);

    const latestSmoothed = smoothed[smoothed.length - 1] ?? latestPoint.value;
    const projectedValue = latestSmoothed + trend * (index + 1);

    return {
      period: projectedDate.toISOString().slice(0, 7),
      value: Math.max(0, Number(projectedValue.toFixed(2))),
    };
  });
}
