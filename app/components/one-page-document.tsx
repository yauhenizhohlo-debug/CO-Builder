"use client";

import { forwardRef } from "react";
import type { OnePageCalculation, OnePageDraft, OnePageFormat, OnePageTemplate } from "../lib/one-page";

const money = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

const themeTokens: Record<OnePageTemplate, { surface: string; panel: string; accent: string; line: string; muted: string; ink: string }> = {
  ivory: { surface: "#f2efe7", panel: "#fbfaf6", accent: "#8f6b3c", line: "#d5cfc1", muted: "#716c62", ink: "#1b1b18" },
  obsidian: { surface: "#151513", panel: "#23231f", accent: "#d5b57a", line: "#414038", muted: "#aaa69b", ink: "#f5f1e8" },
  "mission-control": { surface: "#eef1f3", panel: "#ffffff", accent: "#345a71", line: "#ccd4d9", muted: "#66747c", ink: "#1b1b18" },
  industrial: { surface: "#e8e5df", panel: "#d8d4cd", accent: "#b14f31", line: "#bdb7ad", muted: "#666159", ink: "#1b1b18" },
  "liquid-glass": { surface: "#eaf0ef", panel: "rgba(255,255,255,.72)", accent: "#2c6c69", line: "#c3d1cf", muted: "#607573", ink: "#1b1b18" },
};

type Layout = { width: number; height: number; padding: number; header: number; hero: number; finance: number; gallery: number; gap: number };

const formatLayouts: Record<Exclude<OnePageFormat, "social">, Layout> = {
  a4: { width: 794, height: 1123, padding: 36, header: 54, hero: 340, finance: 248, gallery: 302, gap: 16 },
  post: { width: 1080, height: 1350, padding: 48, header: 65, hero: 410, finance: 312, gallery: 372, gap: 18 },
  story: { width: 1080, height: 1920, padding: 64, header: 80, hero: 650, finance: 390, gallery: 520, gap: 24 },
  square: { width: 1080, height: 1080, padding: 42, header: 50, hero: 284, finance: 292, gallery: 270, gap: 12 },
};

function normalizedFormat(format: OnePageFormat): Exclude<OnePageFormat, "social"> {
  return format === "social" ? "post" : format;
}

function paymentSummary(calculation: OnePageCalculation) {
  const initial = calculation.payments.find((payment) => /первонач/i.test(payment.label));
  const remaining = calculation.payments.filter((payment) => payment.id !== initial?.id);
  const final = [...remaining].reverse().find((payment) => /финаль/i.test(payment.label));
  const topUp = remaining.find((payment) => /довнос|промежуточ/i.test(payment.label));
  const regular = remaining.filter((payment) => payment.id !== final?.id && payment.id !== topUp?.id);
  const firstAmount = regular[0]?.amount;
  const uniform = regular.length > 0 && regular.every((payment) => Math.abs(payment.amount - firstAmount) < 0.01);
  const isFullPayment = calculation.initialPayment >= calculation.dealPrice - 0.01;
  return {
    initialAmount: calculation.initialPayment,
    regularAmount: uniform ? firstAmount : null,
    regularCount: uniform ? regular.length : 0,
    isIndividual: !uniform && remaining.length > 0,
    isFullPayment,
    hasTopUp: Boolean(topUp),
    hasFinal: Boolean(final),
  };
}

export const OnePageDocument = forwardRef<HTMLDivElement, { draft: OnePageDraft; calculation: OnePageCalculation }>(function OnePageDocument({ draft, calculation }, ref) {
  const tokens = themeTokens[draft.template];
  const format = normalizedFormat(draft.format);
  const layout = formatLayouts[format];
  const summary = paymentSummary(calculation);
  const scale = format === "a4" ? 1 : format === "story" ? 1.35 : format === "post" ? 1.18 : 1.05;
  const hero = draft.renderPaths[0];
  const gallery = draft.projectRenderPaths.slice(0, 3);

  return (
    <div
      ref={ref}
      className="one-page-document relative mx-auto overflow-hidden"
      style={{ width: layout.width, height: layout.height, padding: layout.padding, background: tokens.surface, color: tokens.ink, fontSize: 12 * scale }}
      data-one-page-format={format}
    >
      <header className="flex items-start justify-between border-b" style={{ height: layout.header, borderColor: tokens.line }}>
        <div className="flex items-center gap-3">
          <div className="grid aspect-square w-8 place-items-center rounded-full border font-semibold" style={{ borderColor: tokens.accent, color: tokens.accent }}>C</div>
          <div><p className="font-semibold tracking-[.28em]">COSMOS</p><p className="mt-0.5 text-[.72em] uppercase tracking-[.2em]" style={{ color: tokens.muted }}>Black Sea · Hotel 4*</p></div>
        </div>
        <div className="text-right"><p className="text-[.75em] uppercase tracking-[.18em]" style={{ color: tokens.muted }}>Персональное предложение</p><p className="mt-1 text-[1.25em] font-medium">Номер № {draft.room.roomNumber}</p></div>
      </header>

      <div className="grid grid-cols-[1.65fr_.75fr]" style={{ height: layout.hero, gap: layout.gap, marginTop: layout.gap }}>
        <div className="relative overflow-hidden rounded-[10px]" style={{ background: tokens.panel }}>
          {hero ? <img src={hero} alt={`Интерьер номера ${draft.room.roomNumber}`} className="absolute inset-0 h-full w-full object-cover object-[center_46%] brightness-[1.02] contrast-[1.01]" /> : null}
        </div>
        <section className="flex min-h-0 flex-col rounded-[10px] border" style={{ borderColor: tokens.line, background: tokens.panel, padding: 14 * scale }}>
          <p className="text-[.72em] font-medium uppercase tracking-[.18em]" style={{ color: tokens.muted }}>Параметры объекта</p>
          <p className="mt-2 font-serif text-[2.75em] leading-none">{draft.room.area.toLocaleString("ru-RU")} м²</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[.9em] leading-4">
            <dt style={{ color: tokens.muted }}>Этаж</dt><dd className="text-right">{draft.room.floor}</dd>
            <dt style={{ color: tokens.muted }}>Номер</dt><dd className="text-right">{draft.room.roomNumber}</dd>
            <dt style={{ color: tokens.muted }}>Цена за м²</dt><dd className="text-right">{money.format(Math.round(calculation.dealPrice / draft.room.area))}</dd>
          </dl>
          <div className="relative mt-3 min-h-0 flex-1 overflow-hidden rounded-md bg-white">
            {draft.layoutPath ? <img src={draft.layoutPath} alt={`Планировка номера ${draft.room.roomNumber}`} className="absolute inset-0 h-full w-full scale-[1.22] object-contain p-1" /> : null}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-[.9fr_1.1fr]" style={{ height: layout.finance, gap: layout.gap, marginTop: layout.gap }}>
        <section className="min-h-0 rounded-[10px] border" style={{ borderColor: tokens.line, background: tokens.panel, padding: 18 * scale }}>
          <p className="text-[.72em] font-medium uppercase tracking-[.18em]" style={{ color: tokens.muted }}>Стоимость объекта</p>
          <p className="mt-3 font-serif text-[3em] leading-none tracking-[-.035em]">{money.format(calculation.dealPrice)}</p>
          {calculation.discountAmount > 0 ? <p className="mt-3 text-[1.25em] font-semibold" style={{ color: tokens.accent }}>Скидка {percent.format(calculation.discountPercent)}% · {money.format(calculation.discountAmount)}</p> : null}
          <div className="mt-4 border-t pt-3 text-[.86em]" style={{ borderColor: tokens.line }}><span style={{ color: tokens.muted }}>Цена по прайсу</span><span className="float-right">{money.format(calculation.basePrice)}</span></div>
        </section>

        <section className="min-h-0 rounded-[10px] border" style={{ borderColor: tokens.line, background: tokens.panel, padding: 18 * scale }}>
          <p className="text-[.72em] font-medium uppercase tracking-[.18em]" style={{ color: tokens.muted }}>Условия покупки</p>
          <p className="mt-2 text-[1.35em] font-medium">{draft.scenarioLabel}</p>
          {summary.isFullPayment ? (
            <div className="mt-5 border-t pt-4" style={{ borderColor: tokens.accent }}><p className="text-[.78em] uppercase tracking-[.12em]" style={{ color: tokens.muted }}>Оплата стоимости</p><p className="mt-1 text-[1.7em] font-semibold">{money.format(calculation.dealPrice)}</p></div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="border-t pt-3" style={{ borderColor: tokens.accent }}><p className="text-[.78em] uppercase tracking-[.12em]" style={{ color: tokens.muted }}>Первоначальный взнос · {percent.format(calculation.initialPaymentPercent)}%</p><p className="mt-1 text-[1.65em] font-semibold">{money.format(summary.initialAmount)}</p></div>
              <div className="border-t pt-3" style={{ borderColor: tokens.line }}><p className="text-[.78em] uppercase tracking-[.12em]" style={{ color: tokens.muted }}>{summary.isIndividual ? "График платежей" : `${summary.regularCount} регулярных платежей`}</p><p className="mt-1 text-[1.65em] font-semibold">{summary.isIndividual ? "Индивидуальный график" : money.format(summary.regularAmount ?? 0)}</p></div>
            </div>
          )}
          {!summary.isFullPayment && (summary.hasTopUp || summary.hasFinal) ? <p className="mt-4 border-t pt-3 text-[.82em] leading-5" style={{ borderColor: tokens.line, color: tokens.muted }}>{summary.hasTopUp ? "Предусмотрен контрольный довнос. " : ""}{summary.hasFinal ? "Предусмотрен финальный платёж." : ""}</p> : null}
          {draft.specialConditions ? <p className="mt-3 line-clamp-2 text-[.78em] leading-4" style={{ color: tokens.muted }}>{draft.specialConditions}</p> : null}
        </section>
      </div>

      <section className="grid grid-cols-3" style={{ height: layout.gallery, gap: layout.gap, marginTop: layout.gap }}>
        {gallery.map((path, index) => <div key={`${path}-${index}`} className="relative overflow-hidden rounded-[9px]" style={{ background: tokens.panel }}><img src={path} alt={`Cosmos Black Sea, изображение ${index + 1}`} className="absolute inset-0 h-full w-full object-cover" /></div>)}
      </section>

      {draft.managerName || draft.managerPhone ? <footer className="absolute flex items-end justify-between border-t pt-2" style={{ left: layout.padding, right: layout.padding, bottom: layout.padding * .65, borderColor: tokens.line }}><div><p className="font-medium">{draft.managerName || "Менеджер проекта"}</p>{draft.managerPhone ? <p className="mt-1 text-[.82em]" style={{ color: tokens.muted }}>{draft.managerPhone}</p> : null}</div><p className="text-[.68em] uppercase tracking-[.13em]" style={{ color: tokens.muted }}>COSMOS BLACK SEA</p></footer> : null}
    </div>
  );
});
