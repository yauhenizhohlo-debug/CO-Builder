export type InstallmentInput = {
  price: number;
  initialPaymentPercent: number;
  monthlyPayment: number;
  discountPercent: number;
  firstPeriodPaymentCount: number;
};

export type InstallmentResult = {
  listPrice: number;
  discountPercent: number;
  discountedPrice: number;
  initialPaymentPercent: number;
  initialPayment: number;
  monthlyPayment: number;
  firstPeriodPaymentCount: number;
  paymentsBeforeTopUp: number;
  topUpPayment: number;
  targetEscrow: number;
  secondPeriodPayments: number;
  finalPayment: number;
};

const SECOND_PERIOD_PAYMENT_COUNT = 11;

export function calculateInstallment({
  price,
  initialPaymentPercent,
  monthlyPayment,
  discountPercent,
  firstPeriodPaymentCount,
}: InstallmentInput): InstallmentResult {
  const discountedPrice = price * (1 - discountPercent / 100);
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
    discountedPrice,
    initialPaymentPercent,
    initialPayment,
    monthlyPayment,
    firstPeriodPaymentCount,
    paymentsBeforeTopUp,
    topUpPayment,
    targetEscrow,
    secondPeriodPayments,
    finalPayment,
  };
}
