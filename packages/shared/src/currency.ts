// Nigerian Naira (₦) currency utilities
export const NGN = '₦';

export function formatNGN(amount: number): string {
  return `${NGN}${amount.toLocaleString('en-NG')}`;
}

export function parseNGN(formatted: string): number {
  return parseFloat(formatted.replace(NGN, '').replace(/,/g, ''));
}
