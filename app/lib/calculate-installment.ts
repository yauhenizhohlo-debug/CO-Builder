import { calculateDiscount } from "./calculate-discount";
import type { DiscountInput } from "./calculate-discount";

export type InstallmentInput = {
  price: number;
  initialPaymentPercent: number;
  monthlyPayment: number;
  discount: DiscountInput;
  firstPeriodPaymentCount: number;
};

export type InstallmentResult = {
  listPrice: number;
  discountPercent: number;
  discountAmount: number;
  discountedPrice: number;
  initialPaymentPercent: number;
  initialPayment: number;
  monthlyPayment: number;
  firstPeriodPaymentCount: number;
  paymentsBeforeTopUp: number;
  topUpPayment: number;
  targetEscrow: number;
  secondPeriodPaymentCount: number;
  secondPeriodPayments: number;
  finalPayment: number;
};

const SECOND_PERIOD_PAYMENT_COUNT = 11;

export function calculateInstallment({
  price,
  initialPaymentPercent,
  monthlyPayment,
  discount,
  firstPeriodPaymentCount,
}: InstallmentInput): InstallmentResult {
  const { discountPercent, discountAmount, discountedPrice } = calculateDiscount(
    price,
    discount,
  );
  const initialPayment = discountedPrice * (initialPaymentPercent / 100);
  const paymentsBeforeTopUp = monthlyPayment * firstPeriodPaymentCount;
  const targetEscrow = discountedPrice * 0.5;
  const topUpPayment = Math.max(
    0,
    targetEscrow - initialPayment - paymentsBeforeTopUp,
  );
  const secondPeriodPayments = monthlyPayment * SECOND_PERIOD_PAYMENT_COUNT;
  const finalPayment = Math.max(
    0,
    discountedPrice - targetEscrow - secondPeriodPayments,
  );

  return {
    listPrice: price,
    discountPercent,
    discountAmount,
    discountedPrice,
    initialPaymentPercent,
    initialPayment,
    monthlyPayment,
    firstPeriodPaymentCount,
    paymentsBeforeTopUp,
    topUpPayment,
    targetEscrow,
    secondPeriodPaymentCount: SECOND_PERIOD_PAYMENT_COUNT,
    secondPeriodPayments,
    finalPayment,
  };
}
