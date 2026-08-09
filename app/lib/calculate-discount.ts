export type DiscountMode = "percent" | "amount";

export type DiscountInput = {
  mode: DiscountMode;
  value: number;
};

export type DiscountResult = {
  discountPercent: number;
  discountAmount: number;
  discountedPrice: number;
};

export function calculateDiscount(
  price: number,
  discount: DiscountInput,
): DiscountResult {
  const safePrice = Math.max(0, price);
  const safeValue = Number.isFinite(discount.value)
    ? Math.max(0, discount.value)
    : 0;

  const discountAmount = discount.mode === "percent"
    ? safePrice * (Math.min(100, safeValue) / 100)
    : Math.min(safePrice, safeValue);
  const discountPercent = safePrice > 0
    ? (discountAmount / safePrice) * 100
    : 0;

  return {
    discountPercent,
    discountAmount,
    discountedPrice: safePrice - discountAmount,
  };
}
