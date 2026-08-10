import type { Money } from "@cosmos/proposal-contract";

const rubleFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export function moneyToRubles(value: Money | null | undefined) {
  return value == null ? null : value / 100;
}

export function formatMoney(value: Money | null | undefined, fallback = "—") {
  const rubles = moneyToRubles(value);
  return rubles == null ? fallback : rubleFormatter.format(rubles);
}
