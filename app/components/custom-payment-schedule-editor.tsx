"use client";

import { useId, useMemo } from "react";
import {
  balanceCustomSchedule,
  distributeScheduleRemainder,
  type EditablePayment,
  type ScheduleBalanceMode,
} from "../lib/custom-payment-schedule";

const currency = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2,
});

type Props = {
  rows: EditablePayment[];
  expectedTotal: number;
  balanceMode: ScheduleBalanceMode;
  balancerId: string | null;
  onRowsChange: (rows: EditablePayment[]) => void;
  onBalanceModeChange: (mode: ScheduleBalanceMode) => void;
  onBalancerChange: (id: string) => void;
  defaultDate?: string;
};

export function CustomPaymentScheduleEditor({
  rows,
  expectedTotal,
  balanceMode,
  balancerId,
  onRowsChange,
  onBalanceModeChange,
  onBalancerChange,
  defaultDate = "",
}: Props) {
  const groupId = useId();
  const balanced = useMemo(
    () => balanceCustomSchedule(rows, expectedTotal, { mode: balanceMode, balancerId }),
    [rows, expectedTotal, balanceMode, balancerId],
  );
  const visibleRows = balanceMode === "auto" ? balanced.rows : rows;

  const update = (id: string, patch: Partial<EditablePayment>) => {
    onRowsChange(rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  };
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    onRowsChange(next);
  };
  const add = () => {
    onRowsChange([...rows, {
      id: crypto.randomUUID(),
      date: rows.at(-1)?.date ?? defaultDate,
      label: `Этап ${rows.length + 1}`,
      amount: 0,
      type: "top-up",
    }]);
  };
  const remove = (id: string) => onRowsChange(rows.filter((row) => row.id !== id));
  const distribute = () => onRowsChange(distributeScheduleRemainder(rows, expectedTotal, balancerId));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 p-1" role="radiogroup" aria-label="Режим расчёта остатка">
        {([[
          "auto", "Автоостаток",
        ], ["manual", "Ручной режим"]] as const).map(([mode, label]) => (
          <button key={mode} type="button" role="radio" aria-checked={balanceMode === mode} onClick={() => onBalanceModeChange(mode)} className={`min-h-11 rounded-md px-3 text-xs transition ${balanceMode === mode ? "bg-amber-100 text-stone-950" : "text-stone-500 hover:text-stone-200"}`}>{label}</button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3"><p className="text-[10px] text-stone-500">Цена сделки</p><p className="mt-1 text-sm text-stone-100">{currency.format(expectedTotal)}</p></div>
        <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3"><p className="text-[10px] text-stone-500">Сумма платежей</p><p className="mt-1 text-sm text-stone-100">{currency.format(balanced.validation.total)}</p></div>
        <div className={`rounded-lg border p-3 ${balanced.remaining === 0 ? "border-emerald-300/20 bg-emerald-300/[0.06]" : "border-amber-200/20 bg-amber-100/[0.05]"}`}><p className="text-[10px] text-stone-500">{balanced.remaining < 0 ? "Превышение" : "Остаток к распределению"}</p><p className={`mt-1 text-sm ${balanced.remaining < 0 ? "text-red-200" : "text-stone-100"}`}>{currency.format(Math.abs(balanced.remaining))}</p></div>
      </div>

      <p className="text-[10px] leading-4 text-stone-500">В авто-режиме назначенный платёж пересчитывается без изменения дат и порядка этапов.</p>

      {visibleRows.map((payment, index) => {
        const isBalancer = balanced.balancerId === payment.id;
        return (
          <div key={payment.id} className={`rounded-lg border p-3 ${isBalancer ? "border-amber-200/30 bg-amber-100/[0.035]" : "border-white/10"}`}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="flex min-h-10 cursor-pointer items-center gap-2 text-[10px] text-stone-400">
                <input type="radio" name={`balancer-${groupId}`} checked={isBalancer} onChange={() => onBalancerChange(payment.id)} className="size-4 accent-amber-200" />
                Балансирующий платёж
              </label>
              <div className="flex gap-1">
                <button type="button" aria-label={`Переместить этап ${index + 1} выше`} disabled={index === 0} onClick={() => move(index, -1)} className="size-10 rounded-md border border-white/10 disabled:opacity-25">↑</button>
                <button type="button" aria-label={`Переместить этап ${index + 1} ниже`} disabled={index === rows.length - 1} onClick={() => move(index, 1)} className="size-10 rounded-md border border-white/10 disabled:opacity-25">↓</button>
                <button type="button" aria-label={`Удалить этап ${index + 1}`} onClick={() => remove(payment.id)} className="min-h-10 rounded-md border border-red-300/20 px-3 text-red-200">×</button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-[122px_1fr_140px]">
              <input aria-label={`Дата этапа ${index + 1}`} type="date" value={payment.date} onChange={(event) => update(payment.id, { date: event.target.value })} className="min-h-11 rounded-md border border-white/10 bg-stone-900 px-2 text-xs" />
              <input aria-label={`Название этапа ${index + 1}`} value={payment.label} onChange={(event) => update(payment.id, { label: event.target.value })} className="min-h-11 rounded-md border border-white/10 bg-stone-900 px-2 text-xs" />
              <input aria-label={`Сумма этапа ${index + 1}`} type="number" min="0" step="0.01" value={payment.amount} disabled={balanceMode === "auto" && isBalancer} onChange={(event) => update(payment.id, { amount: Math.max(0, Number(event.target.value) || 0) })} className="min-h-11 rounded-md border border-white/10 bg-stone-900 px-2 text-xs disabled:cursor-not-allowed disabled:text-amber-100 disabled:opacity-100" />
            </div>
          </div>
        );
      })}

      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={add} className="min-h-11 rounded-lg border border-dashed border-white/20 text-xs">Добавить этап</button>
        {balanceMode === "manual" && <button type="button" onClick={distribute} disabled={!balanced.balancerId || balanced.excess > 0} className="min-h-11 rounded-lg border border-amber-200/30 text-xs text-amber-100 disabled:opacity-35">Распределить остаток</button>}
      </div>

      {balanced.validation.errors.length > 0 && <ul className="list-disc space-y-1 pl-5 text-[10px] leading-4 text-red-200">{balanced.validation.errors.map((error) => <li key={error}>{error}</li>)}</ul>}
    </div>
  );
}
