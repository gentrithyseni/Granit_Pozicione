export type PricingInput = {
  quantity: number;
  materialPrice: number;
  laborPrice: number;
  days: number;
  foodPrice: number;
  transportPrice: number;
  otherPrice: number;
  profitPercent: number;
  vatPercent: number;
};

export type PricingBreakdown = {
  materialTotal: number;
  laborTotal: number;
  foodTotal: number;
  transportTotal: number;
  otherTotal: number;
  subtotal: number;
  profitAmount: number;
  vatBase: number;
  vatAmount: number;
  total: number;
  unitPrice: number;
};

/** Llogarit koston e një pozicioni paramase. */
export function calculatePositionPrice(input: PricingInput): PricingBreakdown {
  const quantity = Number(input.quantity) || 0;
  const days = Number(input.days) || 0;

  // Material & puna: për çdo njësi pune (m², komplet, copë…) × sasia
  const materialTotal = quantity * (Number(input.materialPrice) || 0);
  const laborTotal = quantity * (Number(input.laborPrice) || 0);

  // Ushqim & transport: vetëm ditët e punës × çmimi ditor (JO × sasia)
  const foodTotal = days * (Number(input.foodPrice) || 0);
  const transportTotal = days * (Number(input.transportPrice) || 0);

  // Tjera: shumë fikse për këtë pozicion (pa shumëzim me ditë apo sasi)
  const otherTotal = Number(input.otherPrice) || 0;

  const subtotal = materialTotal + laborTotal + foodTotal + transportTotal + otherTotal;
  const profitAmount = subtotal * ((Number(input.profitPercent) || 0) / 100);
  const vatBase = subtotal + profitAmount;
  const vatAmount = vatBase * ((Number(input.vatPercent) || 18) / 100);
  const total = vatBase + vatAmount;
  const unitPrice = quantity > 0 ? total / quantity : total;

  return {
    materialTotal,
    laborTotal,
    foodTotal,
    transportTotal,
    otherTotal,
    subtotal,
    profitAmount,
    vatBase,
    vatAmount,
    total,
    unitPrice,
  };
}
