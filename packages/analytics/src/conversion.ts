export interface ConversionInput {
  visitors: number;
  leads: number;
  customers: number;
  activatedCustomers: number;
}

export interface ConversionMetrics {
  visitorToLeadRate: number;
  leadToCustomerRate: number;
  customerActivationRate: number;
}

export function calculateVisitorToLeadRate(visitors: number, leads: number): number {
  if (visitors <= 0) {
    return 0;
  }

  return leads / visitors;
}

export function calculateLeadToCustomerRate(leads: number, customers: number): number {
  if (leads <= 0) {
    return 0;
  }

  return customers / leads;
}

export function calculateCustomerActivationRate(
  customers: number,
  activatedCustomers: number,
): number {
  if (customers <= 0) {
    return 0;
  }

  return activatedCustomers / customers;
}

export function calculateConversionMetrics(input: ConversionInput): ConversionMetrics {
  return {
    visitorToLeadRate: calculateVisitorToLeadRate(input.visitors, input.leads),
    leadToCustomerRate: calculateLeadToCustomerRate(input.leads, input.customers),
    customerActivationRate: calculateCustomerActivationRate(
      input.customers,
      input.activatedCustomers,
    ),
  };
}