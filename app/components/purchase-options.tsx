"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildPaymentSchedule,
  ESCROW_CONTROL_DATE,
  getFirstPeriodPaymentDates,
} from "../lib/build-payment-schedule";
import { calculateDiscount } from "../lib/calculate-discount";
import type { DiscountMode } from "../lib/calculate-discount";
import { calculateInstallment } from "../lib/calculate-installment";
import { useSelectedRoom } from "./selected-room-context";
import { useProposalContext } from "./proposal-context";
import { MortgageOptions } from "./mortgage-options";

type PlanId = "15" | "20" | "25" | "50" | "custom";
type DiscountOption = "0" | "1" | "2" | "3" | "custom";

const plans: Array<{
  id: PlanId;
  label: string;
  initialPaymentPercent: number;
  monthlyPayment: number;
  discountPercent: number;
}> = [
  { id: "15", label: "ПВ 15%", initialPaymentPercent: 15, monthlyPayment: 150000, discountPercent: 1 },
  { id: "20", label: "ПВ 20%", initialPaymentPercent: 20, monthlyPayment: 100000, discountPercent: 2 },
  { id: "25", label: "ПВ 25%", initialPaymentPercent: 25, monthlyPayment: 50000, discountPercent: 3 },
  { id: "50", label: "ПВ 50%", initialPaymentPercent: 50, monthlyPayment: 50000, discountPercent: 0 },
  { id: "custom", label: "Custom", initialPaymentPercent: 30, monthlyPayment: 100000, discountPercent: 0 },
];

const currency = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const formatCurrency = (value: number) => currency.format(value);
const formatPercent = (value: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 4 }).format(value);

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

const todayIso = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

function InstallmentOptions() {
  const room = useSelectedRoom();
  const { setProposalData } = useProposalContext();
  const [planId, setPlanId] = useState<PlanId>("15");
  const [discountOption, setDiscountOption] = useState<DiscountOption>("1");
  const [discountOverridden, setDiscountOverridden] = useState(false);
  const [customDiscountMode, setCustomDiscountMode] = useState<DiscountMode>("percent");
  const [customDiscountAmount, setCustomDiscountAmount] = useState(
    () => calculateDiscount(room.price, { mode: "percent", value: 1 }).discountAmount,
  );
  const [customInitialPayment, setCustomInitialPayment] = useState(30);
  const [customMonthlyPayment, setCustomMonthlyPayment] = useState(100000);
  const [transactionDate, setTransactionDate] = useState(todayIso);

  const plan = plans.find((item) => item.id === planId) ?? plans[0];
  const isCustom = planId === "custom";
  const initialPaymentPercent = isCustom ? customInitialPayment : plan.initialPaymentPercent;
  const monthlyPayment = isCustom ? customMonthlyPayment : plan.monthlyPayment;
  const customDiscount = useMemo(
    () => calculateDiscount(room.price, { mode: "amount", value: customDiscountAmount }),
    [room.price, customDiscountAmount],
  );
  const discount = useMemo(
    () => discountOption === "custom"
      ? { mode: "amount" as const, value: customDiscount.discountAmount }
      : { mode: "percent" as const, value: Number(discountOption) },
    [discountOption, customDiscount.discountAmount],
  );
  const firstPeriodPaymentDates = useMemo(
    () => getFirstPeriodPaymentDates(transactionDate),
    [transactionDate],
  );

  const result = useMemo(
    () =>
      calculateInstallment({
        price: room.price,
        initialPaymentPercent,
        monthlyPayment,
        discount,
        firstPeriodPaymentCount: firstPeriodPaymentDates.length,
      }),
    [
      room.price,
      initialPaymentPercent,
      monthlyPayment,
      discount,
      firstPeriodPaymentDates.length,
    ],
  );

  const schedule = useMemo(
    () => buildPaymentSchedule(transactionDate, result, firstPeriodPaymentDates),
    [transactionDate, result, firstPeriodPaymentDates],
  );

  const summary = [
    ["Скидка", `${formatPercent(result.discountPercent)}% · ${formatCurrency(result.discountAmount)}`],
    ["Стоимость после скидки", formatCurrency(result.discountedPrice)],
    ["ПВ", formatCurrency(result.initialPayment)],
    ["Платежей до 30.06.2027", `${result.firstPeriodPaymentCount}`],
    ["Сумма до довноса", formatCurrency(result.paymentsBeforeTopUp)],
    ["Довнос до 50%", formatCurrency(result.topUpPayment)],
    ["11 платежей второго периода", formatCurrency(result.secondPeriodPayments)],
    ["Финальный остаток", formatCurrency(result.finalPayment)],
  ];

  useEffect(() => {
    setProposalData({ room, financingType: "installment", installment: result, schedule });
  }, [room, result, schedule, setProposalData]);

  const selectPlan = (nextPlan: (typeof plans)[number]) => {
    setPlanId(nextPlan.id);
    if (!discountOverridden) {
      setDiscountOption(String(nextPlan.discountPercent) as DiscountOption);
    }
  };

  const selectDiscount = (option: DiscountOption) => {
    if (option === "custom" && discountOption !== "custom") {
      const currentDiscount = calculateDiscount(room.price, {
        mode: "percent",
        value: Number(discountOption),
      });
      setCustomDiscountAmount(currentDiscount.discountAmount);
    }
    setDiscountOption(option);
    setDiscountOverridden(true);
  };

  const restoreStandardDiscount = () => {
    setDiscountOption(String(plan.discountPercent) as DiscountOption);
    setDiscountOverridden(false);
  };

  return (
    <>
      <section className="panel p-6" aria-labelledby="purchase-heading">
        <p className="eyebrow">02 · Условия покупки</p>
        <h2 id="purchase-heading" className="mt-3 font-serif text-2xl">Рассрочка</h2>
        <p className="mt-2 text-xs text-stone-500">Номер {room.roomNumber.replace(/^№/, "")} · {formatCurrency(room.price)}</p>

        <label className="mt-6 block">
          <span className="text-xs text-stone-500">Дата сделки / дата первого взноса</span>
          <input
            type="date"
            value={transactionDate}
            onChange={(event) => setTransactionDate(event.target.value || todayIso())}
            className="mt-2 w-full rounded-xl border border-white/10 bg-stone-950/30 px-3 py-3 text-sm text-stone-100 outline-none transition focus:border-amber-200/50"
          />
        </label>

        <div className="mt-6 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Первоначальный взнос">
          {plans.map((item) => {
            const active = planId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => selectPlan(item)}
                className={`rounded-xl border px-3 py-3 text-sm transition ${
                  active
                    ? "border-amber-200/60 bg-amber-100/[0.09] text-amber-100"
                    : "border-white/10 bg-white/[0.02] text-stone-400 hover:border-white/25"
                } ${item.id === "custom" ? "col-span-2" : ""}`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {isCustom && (
          <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-stone-950/30 p-4">
            <label className="block">
              <span className="text-xs text-stone-500">Первоначальный взнос, %</span>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={customInitialPayment}
                onChange={(event) => setCustomInitialPayment(Math.min(100, Math.max(0, Number(event.target.value))))}
                className="mt-2 w-full rounded-lg border border-white/10 bg-stone-900 px-3 py-2.5 text-sm text-stone-100 outline-none transition focus:border-amber-200/50"
              />
            </label>
            <label className="block">
              <span className="text-xs text-stone-500">Ежемесячный платёж, ₽</span>
              <input
                type="number"
                min="0"
                step="10000"
                value={customMonthlyPayment}
                onChange={(event) => setCustomMonthlyPayment(Math.max(0, Number(event.target.value)))}
                className="mt-2 w-full rounded-lg border border-white/10 bg-stone-900 px-3 py-2.5 text-sm text-stone-100 outline-none transition focus:border-amber-200/50"
              />
            </label>
          </div>
        )}

        <div className="mt-5 border-t border-white/10 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-stone-200">Скидка</p>
              <p className="mt-1 text-xs text-stone-500">
                Стандарт для выбранного ПВ — {plan.discountPercent}%
              </p>
            </div>
            {discountOverridden && (
              <button type="button" onClick={restoreStandardDiscount} className="text-right text-[10px] leading-4 text-amber-100/70 hover:text-amber-100">
                Вернуть стандартную
              </button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-5 gap-2" role="radiogroup" aria-label="Размер скидки">
            {([
              ["0", "Без скидки"],
              ["1", "1%"],
              ["2", "2%"],
              ["3", "3%"],
              ["custom", "Custom"],
            ] as Array<[DiscountOption, string]>).map(([option, label]) => {
              const active = discountOption === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => selectDiscount(option)}
                  className={`rounded-lg border px-2 py-2.5 text-[11px] transition ${active ? "border-amber-200/60 bg-amber-100/[0.09] text-amber-100" : "border-white/10 bg-white/[0.02] text-stone-500 hover:border-white/25"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {discountOption === "custom" && (
            <div className="mt-3 rounded-xl border border-white/10 bg-stone-950/30 p-4">
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Способ ввода скидки">
                {(["percent", "amount"] as DiscountMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={customDiscountMode === mode}
                    onClick={() => setCustomDiscountMode(mode)}
                    className={`rounded-lg border px-3 py-2 text-xs transition ${customDiscountMode === mode ? "border-amber-200/60 text-amber-100" : "border-white/10 text-stone-500"}`}
                  >
                    {mode === "percent" ? "Проценты" : "Рубли"}
                  </button>
                ))}
              </div>

              <label className="mt-3 block">
                <span className="text-xs text-stone-500">{customDiscountMode === "percent" ? "Скидка, %" : "Скидка, ₽"}</span>
                <input
                  type="number"
                  min="0"
                  max={customDiscountMode === "percent" ? 100 : room.price}
                  step={customDiscountMode === "percent" ? 0.1 : 10000}
                  value={customDiscountMode === "percent" ? Number(customDiscount.discountPercent.toFixed(4)) : customDiscount.discountAmount}
                  onChange={(event) => {
                    const value = Math.max(0, Number(event.target.value) || 0);
                    const nextDiscount = calculateDiscount(room.price, {
                      mode: customDiscountMode,
                      value,
                    });
                    setCustomDiscountAmount(nextDiscount.discountAmount);
                  }}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-stone-900 px-3 py-2.5 text-sm text-stone-100 outline-none transition focus:border-amber-200/50"
                />
              </label>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-white/[0.03] p-3">
                  <p className="text-stone-600">Эквивалент, %</p>
                  <p className="mt-1 text-stone-200">{formatPercent(customDiscount.discountPercent)}%</p>
                </div>
                <div className="rounded-lg bg-white/[0.03] p-3">
                  <p className="text-stone-600">Сумма скидки</p>
                  <p className="mt-1 text-stone-200">{formatCurrency(customDiscount.discountAmount)}</p>
                </div>
              </div>
              <p className="mt-3 text-[10px] text-stone-600">Цена после скидки: {formatCurrency(customDiscount.discountedPrice)}</p>
            </div>
          )}
        </div>
      </section>

      <section className="panel p-6" aria-labelledby="calculation-heading">
        <p className="eyebrow">03 · Расчёт</p>
        <h2 id="calculation-heading" className="mt-3 font-serif text-2xl">Календарь платежей</h2>
        <p className="mt-2 text-xs leading-5 text-stone-500">
          Контрольная дата escrow — {formatDate(ESCROW_CONTROL_DATE)}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-2">
          {summary.map(([label, value], index) => (
            <div key={label} className={`rounded-xl border border-white/10 bg-white/[0.025] p-3 ${index === 0 ? "col-span-2" : ""}`}>
              <dt className="text-[10px] leading-4 text-stone-500">{label}</dt>
              <dd className="mt-1.5 text-sm text-stone-100">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-7 overflow-hidden rounded-xl border border-white/10">
          <div className="grid grid-cols-[78px_1fr] gap-3 border-b border-white/10 bg-stone-950/35 px-3 py-2.5 text-[9px] uppercase tracking-[0.12em] text-stone-600">
            <span>Дата</span>
            <span>Платёж · сумма · накоплено</span>
          </div>
          <ol className="max-h-[620px] overflow-y-auto">
            {schedule.map((payment) => {
              const isTopUp = payment.type === "top-up";
              const isFinal = payment.type === "final";
              return (
                <li
                  key={payment.id}
                  className={`grid grid-cols-[78px_1fr] gap-3 border-b border-white/[0.07] px-3 py-3 last:border-0 ${
                    isTopUp
                      ? "border-y border-amber-200/30 bg-amber-100/[0.09]"
                      : isFinal
                        ? "bg-stone-800/80"
                        : "bg-stone-900/30"
                  }`}
                >
                  <time dateTime={payment.date} className={`pt-0.5 text-[10px] leading-4 ${isTopUp ? "text-amber-100" : "text-stone-500"}`}>
                    {formatDate(payment.date)}
                  </time>
                  <div className="min-w-0">
                    <p className={`text-xs leading-4 ${isTopUp || isFinal ? "font-medium text-amber-100" : "text-stone-300"}`}>
                      {payment.label}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <p className="text-xs text-stone-100">{formatCurrency(payment.amount)}</p>
                      <p className="text-[10px] text-stone-600">Σ {formatCurrency(payment.cumulativeAmount)}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    </>
  );
}

export function PurchaseOptions() {
  const [financingType, setFinancingType] = useState<"installment" | "mortgage">("installment");

  return (
    <>
      <section className="panel p-3" aria-label="Способ покупки">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Способ покупки">
          {([
            ["installment", "Рассрочка"],
            ["mortgage", "Траншевая ипотека"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={financingType === id}
              onClick={() => setFinancingType(id)}
              className={`rounded-xl border px-3 py-3 text-xs uppercase tracking-[0.08em] transition ${financingType === id ? "border-amber-200/60 bg-amber-100/[0.09] text-amber-100" : "border-white/10 bg-white/[0.02] text-stone-500 hover:border-white/25"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {financingType === "installment" ? <InstallmentOptions /> : <MortgageOptions />}
    </>
  );
}
