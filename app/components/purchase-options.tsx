"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildPaymentSchedule,
  ESCROW_CONTROL_DATE,
  getFirstPeriodPaymentDates,
} from "../lib/build-payment-schedule";
import { calculateInstallment } from "../lib/calculate-installment";
import { useSelectedRoom } from "./selected-room-context";
import { useProposalContext } from "./proposal-context";

type PlanId = "15" | "20" | "25" | "50" | "custom";

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

export function PurchaseOptions() {
  const room = useSelectedRoom();
  const { setProposalData } = useProposalContext();
  const [planId, setPlanId] = useState<PlanId>("15");
  const [applyDiscount, setApplyDiscount] = useState(true);
  const [customInitialPayment, setCustomInitialPayment] = useState(30);
  const [customMonthlyPayment, setCustomMonthlyPayment] = useState(100000);
  const [transactionDate, setTransactionDate] = useState(todayIso);
  const plan = plans.find((item) => item.id === planId) ?? plans[0];
  const isCustom = planId === "custom";
  const initialPaymentPercent = isCustom ? customInitialPayment : plan.initialPaymentPercent;
  const monthlyPayment = isCustom ? customMonthlyPayment : plan.monthlyPayment;
  const discountPercent = applyDiscount && !isCustom ? plan.discountPercent : 0;
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
        discountPercent,
        firstPeriodPaymentCount: firstPeriodPaymentDates.length,
      }),
    [
      room.price,
      initialPaymentPercent,
      monthlyPayment,
      discountPercent,
      firstPeriodPaymentDates.length,
    ],
  );

  const schedule = useMemo(
    () => buildPaymentSchedule(transactionDate, result, firstPeriodPaymentDates),
    [transactionDate, result, firstPeriodPaymentDates],
  );

  const summary = [
    ["Стоимость после скидки", formatCurrency(result.discountedPrice)],
    ["ПВ", formatCurrency(result.initialPayment)],
    ["Платежей до 30.06.2027", `${result.firstPeriodPaymentCount}`],
    ["Сумма до довноса", formatCurrency(result.paymentsBeforeTopUp)],
    ["Довнос до 50%", formatCurrency(result.topUpPayment)],
    ["11 платежей второго периода", formatCurrency(result.secondPeriodPayments)],
    ["Финальный остаток", formatCurrency(result.finalPayment)],
  ];

  useEffect(() => {
    setProposalData({ room, installment: result, schedule });
  }, [room, result, schedule, setProposalData]);

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
                onClick={() => setPlanId(item.id)}
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

        <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 border-t border-white/10 pt-5">
          <span>
            <span className="block text-sm text-stone-200">Применить скидку</span>
            <span className="mt-1 block text-xs text-stone-500">
              {plan.discountPercent > 0 && !isCustom ? `${plan.discountPercent}% для выбранного ПВ` : "Автоскидка не предусмотрена"}
            </span>
          </span>
          <input
            type="checkbox"
            checked={applyDiscount}
            onChange={(event) => setApplyDiscount(event.target.checked)}
            className="peer sr-only"
          />
          <span className="relative h-7 w-12 shrink-0 rounded-full bg-stone-700 transition peer-checked:bg-amber-200 after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
        </label>
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
