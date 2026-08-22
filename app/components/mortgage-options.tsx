"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calculateTrancheMortgage,
  type MortgageTrancheInput,
} from "../lib/calculate-tranche-mortgage";
import { calculateDiscount, type DiscountInput } from "../lib/calculate-discount";
import { calculateRefinance } from "../lib/calculate-refinance";
import { useProposalContext } from "./proposal-context";
import { useSelectedRoom } from "./selected-room-context";

type RateProgram = "base" | "custom";
type TrancheCount = 1 | 2 | 3;

const currency = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const formatCurrency = (value: number) => currency.format(value);
const formatPercent = (value: number) =>
  new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
const formatDate = (date: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
const formatYears = (years: number) => `${years} ${years === 1 ? "год" : years < 5 ? "года" : "лет"}`;

const todayIso = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

function distributeLoan(loanAmount: number, count: TrancheCount): MortgageTrancheInput[] {
  const weights = count === 1 ? [1] : count === 2 ? [0.3, 0.7] : [0.2, 0.3, 0.5];
  const issueMonths = [0, 24, 48];
  let allocated = 0;

  return weights.map((weight, index) => {
    const amount = index === weights.length - 1
      ? Math.max(0, loanAmount - allocated)
      : Math.round(loanAmount * weight);
    allocated += amount;
    return { id: `tranche-${index + 1}`, amount, issueMonth: issueMonths[index] };
  });
}

export function MortgageOptions({ discount }: { discount: DiscountInput }) {
  const room = useSelectedRoom();
  const { setProposalData } = useProposalContext();
  const [transactionDate, setTransactionDate] = useState(todayIso);
  const dealPrice = useMemo(
    () => calculateDiscount(room.price, discount).discountedPrice,
    [room.price, discount],
  );
  const [initialPayment, setInitialPayment] = useState(() => Math.round(dealPrice * 0.3));
  const [rateProgram, setRateProgram] = useState<RateProgram>("base");
  const [baseRate, setBaseRate] = useState(19.2);
  const [customRate, setCustomRate] = useState(18);
  const [termYears, setTermYears] = useState(30);
  const [trancheCount, setTrancheCount] = useState<TrancheCount>(2);
  const [refinanceEnabled, setRefinanceEnabled] = useState(false);
  const [refinanceAfterYears, setRefinanceAfterYears] = useState(2);
  const [refinanceRate, setRefinanceRate] = useState(10);
  const loanAmount = Math.max(0, dealPrice - initialPayment);
  const [tranches, setTranches] = useState<MortgageTrancheInput[]>(() =>
    distributeLoan(Math.max(0, dealPrice - Math.round(dealPrice * 0.3)), 2),
  );
  const annualRate = rateProgram === "base" ? baseRate : customRate;

  useEffect(() => {
    const nextInitialPayment = Math.round(dealPrice * 0.3);
    setInitialPayment(nextInitialPayment);
  }, [dealPrice]);

  useEffect(() => {
    setTranches(distributeLoan(loanAmount, trancheCount));
  }, [loanAmount, trancheCount]);

  const result = useMemo(
    () => calculateTrancheMortgage({
      price: room.price,
      discount,
      initialPayment,
      annualRate,
      termMonths: termYears * 12,
      transactionDate,
      tranches,
    }),
    [room.price, discount, initialPayment, annualRate, termYears, transactionDate, tranches],
  );

  const refinance = useMemo(
    () => calculateRefinance({
      enabled: refinanceEnabled,
      refinanceAfterMonths: refinanceAfterYears * 12,
      assumedAnnualRate: refinanceRate,
      transactionDate,
      mortgage: result,
    }),
    [refinanceEnabled, refinanceAfterYears, refinanceRate, transactionDate, result],
  );

  useEffect(() => {
    setProposalData({
      room,
      financingType: "mortgage",
      mortgage: result,
      refinance: refinance.enabled ? refinance : undefined,
    });
  }, [room, result, refinance, setProposalData]);

  const updateTranche = (
    index: number,
    field: "amount" | "issueMonth",
    value: number,
  ) => {
    setTranches((current) => current.map((tranche, trancheIndex) =>
      trancheIndex === index
        ? { ...tranche, [field]: Math.max(0, value) }
        : tranche,
    ));
  };

  return (
    <>
      <section className="mortgage-configuration panel p-6" aria-labelledby="mortgage-heading">
        <p className="eyebrow">02 · Условия покупки</p>
        <h2 id="mortgage-heading" className="mt-3 font-serif text-2xl">Траншевая ипотека</h2>
        <p className="mt-2 text-xs text-stone-500">Предварительный расчёт траншевой ипотеки</p>
        <p className="mt-1 text-xs text-stone-600">Номер {room.roomNumber.replace(/^№/, "")} · {formatCurrency(room.price)}</p>

        <label className="mt-6 block">
          <span className="text-xs text-stone-500">Дата сделки</span>
          <input
            type="date"
            value={transactionDate}
            onChange={(event) => setTransactionDate(event.target.value || todayIso())}
            className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-stone-950/30 px-3 py-3 text-base text-stone-100 outline-none transition focus:border-amber-200/50 sm:text-sm"
          />
        </label>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-stone-500">Первоначальный взнос, ₽</span>
            <input
              type="number"
              min="0"
              max={dealPrice}
              step="10000"
              value={initialPayment}
              onChange={(event) => setInitialPayment(Math.min(dealPrice, Math.max(0, Number(event.target.value) || 0)))}
              className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-stone-950/30 px-3 py-3 text-base text-stone-100 outline-none transition focus:border-amber-200/50 sm:text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-stone-500">Первоначальный взнос, %</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={Number(result.initialPaymentPercent.toFixed(2))}
              onChange={(event) => {
                const percent = Math.min(100, Math.max(0, Number(event.target.value) || 0));
                setInitialPayment(Math.round(dealPrice * percent / 100));
              }}
              className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-stone-950/30 px-3 py-3 text-base text-stone-100 outline-none transition focus:border-amber-200/50 sm:text-sm"
            />
          </label>
        </div>

        <dl className="mt-3 rounded-xl border border-white/10 bg-white/[0.025] p-4">
          <dt className="text-[10px] uppercase tracking-[0.14em] text-stone-600">Сумма кредита</dt>
          <dd className="mt-1.5 font-serif text-xl text-stone-100">{formatCurrency(result.loanAmount)}</dd>
        </dl>

        <div className="mt-6">
          <p className="text-xs text-stone-500">Тип ставки / программа</p>
          <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Программа ипотеки">
            {([[
              "base",
              "Базовая ставка",
            ], ["custom", "Своя ставка"]] as Array<[RateProgram, string]>).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={rateProgram === id}
                onClick={() => setRateProgram(id)}
                className={`rounded-xl border px-3 py-3 text-xs uppercase tracking-[0.08em] transition ${rateProgram === id ? "border-amber-200/60 bg-amber-100/[0.09] text-amber-100" : "border-white/10 bg-white/[0.02] text-stone-500"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="mt-3 block">
            <span className="text-xs text-stone-500">{rateProgram === "base" ? "Актуальная базовая ставка, %" : "Своя ставка, %"}</span>
            <input
              type="number"
              min="0.01"
              max="100"
              step="0.1"
              value={rateProgram === "base" ? baseRate : customRate}
              onChange={(event) => {
                const value = Math.max(0, Number(event.target.value) || 0);
                if (rateProgram === "base") setBaseRate(value);
                else setCustomRate(value);
              }}
              className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-stone-950/30 px-3 py-3 text-base text-stone-100 outline-none transition focus:border-amber-200/50 sm:text-sm"
            />
          </label>
          <p className="mt-2 text-[10px] leading-4 text-stone-600">Ставка вводится менеджером по актуальным условиям банка и не является зафиксированным предложением.</p>
        </div>

        <label className="mt-5 block">
          <span className="text-xs text-stone-500">Срок кредита, лет</span>
          <input
            type="number"
            min="1"
            max="30"
            step="1"
            value={termYears}
            onChange={(event) => setTermYears(Math.min(30, Math.max(1, Number(event.target.value) || 1)))}
            className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-stone-950/30 px-3 py-3 text-base text-stone-100 outline-none transition focus:border-amber-200/50 sm:text-sm"
          />
        </label>

        <div className="mt-6 border-t border-white/10 pt-5">
          <p className="text-sm text-stone-200">Количество траншей</p>
          <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Количество траншей">
            {([1, 2, 3] as TrancheCount[]).map((count) => (
              <button
                key={count}
                type="button"
                role="radio"
                aria-checked={trancheCount === count}
                onClick={() => setTrancheCount(count)}
                className={`rounded-xl border px-2 py-3 text-xs transition ${trancheCount === count ? "border-amber-200/60 bg-amber-100/[0.09] text-amber-100" : "border-white/10 bg-white/[0.02] text-stone-500"}`}
              >
                {count} {count === 1 ? "транш" : "транша"}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {tranches.map((tranche, index) => (
              <div key={tranche.id} className="rounded-xl border border-white/10 bg-stone-950/30 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-stone-200">Транш {index + 1}</p>
                  <p className="text-[10px] text-amber-100/65">
                    {index === 0 ? "В дату сделки" : formatDate(result.stages[index]?.issueDate ?? transactionDate)}
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label>
                    <span className="text-[10px] text-stone-500">Сумма, ₽</span>
                    <input
                      aria-label={`Сумма транша ${index + 1}`}
                      type="number"
                      min="0"
                      step="10000"
                      value={tranche.amount}
                      onChange={(event) => updateTranche(index, "amount", Number(event.target.value) || 0)}
                      inputMode="numeric"
                      className="mt-2 min-h-12 w-full rounded-lg border border-white/10 bg-stone-900 px-3 py-3 text-base text-stone-100 outline-none focus:border-amber-200/50 sm:text-sm"
                    />
                  </label>
                  <label>
                    <span className="text-[10px] text-stone-500">Выдача через, месяцев</span>
                    <input
                      aria-label={`Срок выдачи транша ${index + 1}`}
                      type="number"
                      min="0"
                      max={termYears * 12 - 1}
                      step="1"
                      value={tranche.issueMonth}
                      disabled={index === 0}
                      onChange={(event) => updateTranche(index, "issueMonth", Number(event.target.value) || 0)}
                      inputMode="numeric"
                      className="mt-2 min-h-12 w-full rounded-lg border border-white/10 bg-stone-900 px-3 py-3 text-base text-stone-100 outline-none focus:border-amber-200/50 disabled:cursor-not-allowed disabled:text-stone-600 sm:text-sm"
                    />
                  </label>
                </div>
                <p className="mt-3 text-[10px] leading-4 text-stone-600">
                  {index === 0
                    ? `Выдача ${formatDate(transactionDate)}`
                    : `Расчётная дата выдачи: ${formatDate(result.stages[index]?.issueDate ?? transactionDate)}`}
                </p>
              </div>
            ))}
          </div>

          <div className={`mt-4 rounded-xl border p-4 ${result.isBalanced ? "border-emerald-300/20 bg-emerald-300/[0.05]" : "border-amber-300/35 bg-amber-200/[0.07]"}`}>
            <p className={`text-xs ${result.isBalanced ? "text-emerald-100/80" : "text-amber-100"}`}>
              {result.isBalanced
                ? `Сумма траншей совпадает с суммой кредита: ${formatCurrency(result.trancheTotal)}`
                : result.validationMessages.join(" ")}
            </p>
          </div>
        </div>

        <div className="mt-6 border-t border-white/10 pt-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-stone-200">Рефинансирование</p>
              <p className="mt-1 text-[10px] leading-4 text-stone-600">Предварительный сценарий после выдачи ипотеки</p>
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-stone-300">
              <input
                type="checkbox"
                checked={refinanceEnabled}
                onChange={(event) => setRefinanceEnabled(event.target.checked)}
                className="size-4 accent-amber-100"
              />
              Рассчитать
            </label>
          </div>

          {refinanceEnabled && (
            <div className="mt-4 rounded-xl border border-white/10 bg-stone-950/30 p-4">
              <p className="text-[10px] text-stone-500">Рефинансирование через</p>
              <div className="mt-2 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Срок до рефинансирования">
                {[1, 2, 3, 5].map((years) => (
                  <button
                    key={years}
                    type="button"
                    role="radio"
                    aria-checked={refinanceAfterYears === years}
                    onClick={() => setRefinanceAfterYears(years)}
                    className={`min-h-11 rounded-lg border px-2 text-xs transition ${refinanceAfterYears === years ? "border-amber-200/60 bg-amber-100/[0.09] text-amber-100" : "border-white/10 text-stone-500"}`}
                  >
                    {formatYears(years)}
                  </button>
                ))}
              </div>

              <label className="mt-4 block">
                <span className="text-xs text-stone-500">Предполагаемая ставка, %</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={refinanceRate}
                  onChange={(event) => setRefinanceRate(Math.min(100, Math.max(0, Number(event.target.value) || 0)))}
                  className="mt-2 min-h-12 w-full rounded-lg border border-white/10 bg-stone-900 px-3 py-3 text-base text-stone-100 outline-none focus:border-amber-200/50 sm:text-sm"
                />
              </label>

              {refinance.isValid ? (
                <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-lg bg-white/[0.03] p-3">
                    <dt className="text-[10px] text-stone-600">Остаток долга к {formatDate(refinance.refinanceDate ?? transactionDate)}</dt>
                    <dd className="mt-1 text-sm text-stone-100">{formatCurrency(refinance.outstandingPrincipal ?? 0)}</dd>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] p-3">
                    <dt className="text-[10px] text-stone-600">Новый платёж</dt>
                    <dd className="mt-1 text-sm text-amber-50">{formatCurrency(refinance.paymentAfterRefinance ?? 0)} / мес.</dd>
                  </div>
                </dl>
              ) : (
                <p role="alert" className="mt-4 text-xs leading-5 text-amber-100">{refinance.validationMessages.join(" ")}</p>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="mortgage-calculation panel p-6" aria-labelledby="mortgage-calculation-heading">
        <p className="eyebrow">03 · Расчёт</p>
        <h2 id="mortgage-calculation-heading" className="mt-3 font-serif text-2xl">Траектория финансирования</h2>

        <dl className="mt-6 grid grid-cols-2 gap-2">
          {[
            ["Цена по прайсу", formatCurrency(result.basePrice)],
            ["Скидка", `${formatPercent(result.discountPercent)}% · ${formatCurrency(result.discountAmount)}`],
            ["Стоимость объекта", formatCurrency(result.price)],
            ["Первоначальный взнос", `${formatCurrency(result.initialPayment)} · ${formatPercent(result.initialPaymentPercent)}%`],
            ["Сумма кредита", formatCurrency(result.loanAmount)],
            ["Ставка", `${formatPercent(result.annualRate)}%`],
            ["Срок", `${result.termYears} лет`],
            ["Модель расчёта", "Траншевая · Actual/365"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <dt className="text-[10px] leading-4 text-stone-500">{label}</dt>
              <dd className="mt-1.5 text-sm text-stone-100">{value}</dd>
            </div>
          ))}
        </dl>

        <ol className="mt-7 space-y-0">
          <li className="relative border-l border-amber-200/35 pb-7 pl-6">
            <span className="absolute -left-1.5 top-0 size-3 rounded-full border border-amber-100 bg-stone-900" />
            <p className="text-[10px] uppercase tracking-[0.16em] text-amber-100/70">Сегодня · {formatDate(transactionDate)}</p>
            <p className="mt-2 text-xs text-stone-500">Первоначальный взнос</p>
            <p className="mt-1 font-serif text-xl text-stone-100">{formatCurrency(result.initialPayment)}</p>
          </li>
          {result.stages.map((stage, index) => (
            <li key={stage.trancheId} className={`relative pl-6 ${index < result.stages.length - 1 ? "border-l border-amber-200/35 pb-7" : ""}`}>
              <span className="absolute -left-1.5 top-0 size-3 rounded-full border border-amber-100 bg-stone-900" />
              <p className="text-[10px] uppercase tracking-[0.16em] text-amber-100/70">
                {stage.issueMonth === 0 ? "В дату сделки" : `С ${stage.startPaymentMonth} месяца`} · {formatDate(stage.issueDate)}
              </p>
                <p className="mt-2 text-sm text-stone-200">Этап {stage.trancheNumber} · транш {formatCurrency(stage.trancheAmount)}</p>
              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <p className="text-[10px] text-stone-500">Задолженность после выдачи</p>
                <p className="mt-1 text-sm text-stone-200">{formatCurrency(stage.outstandingAfterIssue)}</p>
                <p className="mt-3 text-[10px] text-stone-500">Платёж на этапе</p>
                <p className="mt-1 font-serif text-xl text-amber-50">{formatCurrency(stage.monthlyPayment)} / мес.</p>
                <p className="mt-2 text-[10px] text-stone-600">
                  {stage.paymentCount} мес. · месяцы {stage.startPaymentMonth}–{stage.endPaymentMonth}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {refinance.enabled && refinance.isValid && (
          <div className="mt-7 rounded-xl border border-white/10 bg-white/[0.025] p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-stone-500">Рефинансирование через {formatYears(refinance.refinanceAfterMonths / 12)}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <dt className="text-[10px] text-stone-600">Остаток долга</dt>
                <dd className="mt-1 text-sm text-stone-100">{formatCurrency(refinance.outstandingPrincipal ?? 0)}</dd>
              </div>
              <div>
                <dt className="text-[10px] text-stone-600">Новый платёж · {formatPercent(refinance.assumedAnnualRate)}%</dt>
                <dd className="mt-1 text-sm text-amber-50">{formatCurrency(refinance.paymentAfterRefinance ?? 0)} / мес.</dd>
              </div>
            </dl>
          </div>
        )}

        <p className="mt-7 text-[10px] leading-5 text-stone-600">
          Предварительный расчёт траншевой ипотеки. Финальные условия кредитования, процентная ставка, размер платежа и решение о выдаче кредита определяются банком.
        </p>
      </section>
    </>
  );
}
