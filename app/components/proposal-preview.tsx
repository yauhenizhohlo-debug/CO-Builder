"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getLayoutById } from "../data/layouts";
import { getRenderSetById } from "../data/render-sets";
import { downloadProposalPdf } from "../lib/download-proposal-pdf";
import { useProposalContext } from "./proposal-context";
import type { ProposalData } from "./proposal-context";

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
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
const PDF_PAGE_WIDTH = 794;
const PDF_PAGE_HEIGHT = 1123;
const PDF_PAGE_GAP = 24;

function PageFooter({ page, dark = false }: { page: number; dark?: boolean }) {
  return (
    <footer className={`mt-auto flex items-center justify-between border-t pt-4 text-[9px] uppercase tracking-[0.24em] ${dark ? "border-white/15 text-stone-500" : "border-stone-300 text-stone-400"}`}>
      <span>Cosmos Black Sea</span>
      <span>{page} / 3</span>
    </footer>
  );
}

function ProposalImage({ src, alt, className }: { src?: string; alt: string; className: string }) {
  const [failed, setFailed] = useState(!src);

  if (failed || !src) {
    return (
      <div className={`${className} grid place-items-center bg-stone-200 p-6 text-center text-[9px] uppercase tracking-[0.18em] text-stone-500`}>
        Изображение временно недоступно
      </div>
    );
  }

  return <img src={src} alt={alt} loading="eager" decoding="sync" onError={() => setFailed(true)} className={className} />;
}

export function ProposalPreview({
  importedProposalData,
  actionLabel = "Сформировать КП",
}: {
  importedProposalData?: ProposalData;
  actionLabel?: string;
} = {}) {
  const context = useProposalContext();
  const proposalData = importedProposalData ?? context.proposalData;
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [previewScale, setPreviewScale] = useState(1);
  const proposalRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const updateScale = () => {
      const availableWidth = Math.max(280, window.innerWidth - 24);
      setPreviewScale(Math.min(1, availableWidth / PDF_PAGE_WIDTH));
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [isOpen]);

  const room = proposalData?.room;
  const layout = room ? getLayoutById(room.layoutId) : undefined;
  const renderSet = room ? getRenderSetById(room.renderSetId) : undefined;
  const installment = proposalData?.financingType === "installment" ? proposalData.installment : undefined;
  const mortgage = proposalData?.financingType === "mortgage" ? proposalData.mortgage : undefined;
  const standardMortgage=proposalData?.financingType==="mortgage"&&proposalData.mortgageKind==="standard";
  const standardMonthlyPayment=proposalData?.financingType==="mortgage"?proposalData.standardMonthlyPayment:undefined;
  const schedule = proposalData?.financingType === "installment" ? proposalData.schedule : [];
  const investmentOnly = proposalData?.financingType === "none" && Boolean(proposalData.investment);
  const galleryImages = renderSet?.imagePaths.slice(0, 6) ?? [];
  const financingLabel = installment ? "Рассрочка" : mortgage ? "Ипотека" : "Предложение";
  const initialPaymentPercent = installment?.initialPaymentPercent ?? mortgage?.initialPaymentPercent ?? 0;
  const pdfFilename = `${financingLabel} номер ${room?.roomNumber.replace(/^№/, "") ?? ""} ПВ ${formatPercent(initialPaymentPercent)}%.pdf`;

  const handleDownloadPdf = async () => {
    if (!proposalRootRef.current || isExporting) return;
    setIsExporting(true);
    setExportError("");
    try {
      await downloadProposalPdf(
        proposalRootRef.current,
        pdfFilename,
      );
    } catch (error) {
      console.error("proposal_pdf_export_failed", error);
      setExportError("Не удалось сформировать PDF. Повторите попытку.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <section className="panel p-6" aria-labelledby="offer-heading">
        <p className="eyebrow">04 · Финальный этап</p>
        <h2 id="offer-heading" className="mt-3 font-serif text-2xl">Коммерческое предложение</h2>
        <p className="mt-3 text-sm leading-6 text-stone-500">
          Три готовые к печати страницы с объектом, условиями и галереей.
        </p>
        <button
          type="button"
          disabled={!proposalData || (proposalData.financingType === "mortgage" && !proposalData.mortgage.isBalanced)}
          onClick={() => setIsOpen(true)}
          className="mt-5 w-full rounded-xl bg-amber-100 px-4 py-3.5 text-sm font-medium text-stone-950 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {actionLabel}
        </button>
      </section>

      {isOpen && proposalData && room && createPortal(
        <div ref={proposalRootRef} className="proposal-print-root">
          <div className="proposal-modal fixed inset-0 z-[70] overflow-y-auto bg-stone-950/95 backdrop-blur-sm">
            <div className="proposal-controls sticky top-0 z-20 border-b border-white/10 bg-stone-950/95 px-3 py-3 backdrop-blur sm:px-4">
              <div className="mx-auto flex max-w-[794px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.18em] text-amber-100/70">Preview КП</p>
                  <p className="mt-1 text-xs text-stone-500">Номер {room.roomNumber.replace(/^№/, "")}</p>
                </div>
                <div className="grid w-full grid-cols-[1fr_auto] gap-2 sm:flex sm:w-auto">
                  <button type="button" disabled={isExporting} onClick={handleDownloadPdf} className="relative z-10 min-h-11 rounded-lg bg-amber-100 px-4 py-2.5 text-sm font-medium text-stone-950 hover:bg-amber-50 disabled:cursor-wait disabled:opacity-60 sm:text-xs">
                    {isExporting ? "Формируем PDF…" : "Скачать PDF"}
                  </button>
                  <button type="button" disabled={isExporting} onClick={() => setIsOpen(false)} className="min-h-11 rounded-lg border border-white/15 px-4 py-2.5 text-sm text-stone-300 hover:border-white/30 disabled:opacity-40 sm:text-xs">
                    Закрыть
                  </button>
                </div>
                {exportError && <p aria-live="polite" className="text-xs text-red-300 sm:basis-full">{exportError}</p>}
              </div>
            </div>

            <div
              className="proposal-pages-viewport mx-auto my-4 sm:my-6"
              style={{
                width: PDF_PAGE_WIDTH * previewScale,
                height: (PDF_PAGE_HEIGHT * 3 + PDF_PAGE_GAP * 2) * previewScale,
              }}
            >
            <div className="proposal-pages flex w-[794px] flex-col gap-6" style={{ transform: `scale(${previewScale})`, transformOrigin: "top left" }}>
              <article data-pdf-page className="proposal-page flex h-[1123px] min-h-[1123px] w-[794px] min-w-[794px] flex-col overflow-hidden bg-[#f4f0e8] p-14 text-[#191713] shadow-2xl">
                <header className="border-b border-[#cec5b6] pb-6">
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.34em] text-[#7d6748]">COSMOS BLACK SEA</p>
                    <h1 className="mt-4 max-w-[520px] font-serif text-[42px] leading-none">Коммерческое предложение</h1>
                  </div>
                </header>

                <div className="mt-7 grid grid-cols-[0.72fr_1.28fr] gap-7">
                  <div className="flex flex-col">
                    <p className="text-[8px] uppercase tracking-[0.24em] text-stone-500">Ваш номер в Cosmos Black Sea</p>
                    <p className="mt-3 font-serif text-[64px] leading-none">№ {room.roomNumber.replace(/^№/, "")}</p>
                    <dl className="mt-6 grid grid-cols-2 gap-x-4 border-y border-[#cec5b6] py-3">
                      {[
                        ["Этаж", `${room.floor}`],
                        ["Площадь", `${room.area.toLocaleString("ru-RU")} м²`],
                        ["Цена за м²", formatCurrency(room.pricePerSqm)],
                      ].map(([label, value]) => (
                        <div key={label} className={label === "Цена за м²" ? "col-span-2 border-t border-[#ddd5c9] pt-3" : "pb-3"}>
                          <dt className="text-[8px] uppercase tracking-[0.14em] text-stone-500">{label}</dt>
                          <dd className="mt-1 text-[13px] font-medium">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-auto border-l-2 border-[#aa8551] bg-[#e9dfcf] px-4 py-4">
                      <p className="text-[8px] uppercase tracking-[0.2em] text-[#7d6748]">Полная стоимость</p>
                      <p className="mt-2 font-serif text-[27px] leading-none">{formatCurrency(room.price)}</p>
                      <p className="mt-4 text-[8px] uppercase tracking-[0.16em] text-stone-500">Первоначальный взнос от</p>
                      <p className="mt-1 text-sm font-semibold">{formatCurrency(installment?.initialPayment ?? mortgage?.initialPayment ?? 0)}</p>
                    </div>
                  </div>
                  <div className="relative min-h-[360px] overflow-hidden rounded-sm bg-stone-200">
                    <ProposalImage src={renderSet?.imagePaths[0]} alt={`Рендер номера ${room.roomNumber}`} className="absolute inset-0 h-full w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-5 pb-4 pt-12 text-[8px] uppercase tracking-[0.2em] text-white/80">Интерьер номера · визуализация</div>
                  </div>
                </div>

                <div className="relative mt-7 flex min-h-[390px] flex-1 flex-col overflow-hidden rounded-sm border border-[#d8d0c4] bg-[#faf8f4]">
                  <p className="absolute left-4 top-4 z-10 text-[8px] uppercase tracking-[0.24em] text-[#7d6748]">Планировка номера</p>
                  <div className="relative flex-1">
                    <ProposalImage src={layout?.imagePath} alt={`Планировка номера ${room.roomNumber}`} className="absolute inset-0 h-full w-full object-contain" />
                  </div>
                </div>
                <PageFooter page={1} />
              </article>

              <article data-pdf-page className="proposal-page flex h-[1123px] min-h-[1123px] w-[794px] min-w-[794px] flex-col overflow-hidden bg-[#f4f0e8] p-14 text-[#191713] shadow-2xl">
                <header className="flex items-end justify-between border-b border-[#cec5b6] pb-5">
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.34em] text-[#7d6748]">COSMOS BLACK SEA</p>
                    <h2 className="mt-3 font-serif text-[40px] leading-none">{investmentOnly ? "Инвестиционный прогноз" : "Условия покупки"}</h2>
                  </div>
                  <p className="text-[8px] uppercase tracking-[0.2em] text-stone-500">Номер {room.roomNumber.replace(/^№/, "")} · {room.area.toLocaleString("ru-RU")} м²</p>
                </header>

                {installment ? <>
                <dl className="mt-4 grid grid-cols-4 gap-3 border-y border-[#d8d0c4] py-3">
                  {[
                    ["Цена по прайсу", formatCurrency(installment.listPrice)],
                    ["Скидка", installment.discountPercent > 0 ? `${formatPercent(installment.discountPercent)}% · ${formatCurrency(installment.discountAmount)}` : formatCurrency(installment.discountAmount)],
                    ["Цена после скидки", formatCurrency(installment.discountedPrice)],
                    ["Условия", `ПВ ${installment.initialPaymentPercent}% · ${installment.firstPeriodPaymentCount + installment.secondPeriodPaymentCount} регулярных платежей`],
                  ].map(([label, value]) => (
                    <div key={label} className="border-l border-[#ddd5c9] pl-3 first:border-l-0 first:pl-0">
                      <dt className="text-[7px] uppercase leading-3 tracking-[0.12em] text-stone-500">{label}</dt>
                      <dd className="mt-1 text-[11px] font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-4 grid grid-cols-5 gap-1.5">
                  {[
                    ["01", "Первоначальный взнос", formatCurrency(installment.initialPayment), `${installment.initialPaymentPercent}% от стоимости`],
                    ["02", "До контрольной даты", `${installment.firstPeriodPaymentCount} × ${formatCurrency(installment.monthlyPayment)}`, `Всего ${formatCurrency(installment.paymentsBeforeTopUp)}`],
                    ["03", "Довнос до 50%", formatCurrency(installment.topUpPayment), "30.06.2027"],
                    ["04", "Второй период", `${installment.secondPeriodPaymentCount} × ${formatCurrency(installment.monthlyPayment)}`, `Всего ${formatCurrency(installment.secondPeriodPayments)}`],
                    ["05", "Финальный платёж", formatCurrency(installment.finalPayment), "Завершение расчётов"],
                  ].map(([step, label, value, note], index) => (
                    <div key={label} className={`min-h-[98px] border p-2.5 ${index === 0 || index === 2 || index === 4 ? "border-[#b59463] bg-[#e9dfcf]" : "border-[#d8d0c4] bg-[#faf8f4]"}`}>
                      <p className="text-[8px] tracking-[0.2em] text-[#9a7747]">{step}</p>
                      <p className="mt-2 text-[7px] uppercase leading-[10px] tracking-[0.1em] text-stone-500">{label}</p>
                      <p className="mt-2 font-serif text-[15px] font-medium leading-[17px]">{value}</p>
                      <p className="mt-1.5 text-[6.5px] leading-[9px] text-stone-500">{note}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 border-y border-[#d8d0c4] bg-[#faf8f4] px-3 py-2.5">
                  <p className="text-[6.5px] uppercase tracking-[0.18em] text-[#9a7747]">Траектория сделки</p>
                  <ol className="mt-2 flex items-center justify-between gap-1 text-center">
                    {[
                      ["ПВ", formatCurrency(installment.initialPayment)],
                      [`${installment.firstPeriodPaymentCount} платежей`, formatCurrency(installment.monthlyPayment)],
                      ["Довнос до 50%", formatCurrency(installment.topUpPayment)],
                      [`${installment.secondPeriodPaymentCount} платежей`, formatCurrency(installment.monthlyPayment)],
                      ["Финальный платёж", formatCurrency(installment.finalPayment)],
                    ].map(([label, value], index) => (
                      <li key={label} className="contents">
                        {index > 0 && <span aria-hidden="true" className="text-[11px] text-[#b59463]">→</span>}
                        <div className="min-w-0 flex-1">
                          <p className="text-[7px] font-semibold uppercase tracking-[0.08em] text-stone-600">{label}</p>
                          <p className="mt-0.5 truncate text-[7px] text-stone-500">{value}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="mt-3 min-h-0 flex-1">
                  <div className="flex items-end justify-between border-b border-[#9f9688] pb-2">
                    <div>
                      <p className="text-[7px] uppercase tracking-[0.2em] text-[#9a7747]">Персональный график</p>
                      <h3 className="mt-1 font-serif text-[23px] leading-none">Календарь платежей</h3>
                    </div>
                    <p className="text-[7px] text-stone-400">Все платежи в хронологическом порядке</p>
                  </div>
                  <div className="grid grid-cols-[76px_1fr_96px] border-b border-[#d8d0c4] py-1.5 text-[6.5px] uppercase tracking-[0.13em] text-stone-400">
                    <span>Дата</span>
                    <span>Назначение</span>
                    <span className="text-right">Сумма</span>
                  </div>
                  <ol>
                    {schedule.map((payment) => (
                      <li key={payment.id} className={`grid grid-cols-[76px_1fr_96px] items-center border-b py-[2.5px] text-[7px] leading-[10px] ${payment.type === "initial" || payment.type === "top-up" || payment.type === "final" ? "border-[#b59463] bg-[#e9dfcf] px-2 font-semibold" : "border-[#ddd6ca]"}`}>
                        <span className="text-stone-500">{formatDate(payment.date)}</span>
                        <span className="min-w-0 truncate pr-2">{payment.label}</span>
                        <span className="text-right">{formatCurrency(payment.amount)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                </> : mortgage ? <>
                  <div className="mt-5 flex items-end justify-between border-y border-[#d8d0c4] py-4">
                    <div>
                      <p className="text-[8px] uppercase tracking-[0.18em] text-[#9a7747]">Финансовая траектория</p>
                      <p className="mt-2 font-serif text-[25px]">{standardMortgage?"Предварительный расчёт стандартной ипотеки":"Предварительный расчёт траншевой ипотеки"}</p>
                    </div>
                  </div>

                  <dl className="mt-5 grid grid-cols-2 gap-2">
                    {[
                      ["Стоимость", formatCurrency(mortgage.price)],
                      ["Первоначальный взнос", formatCurrency(mortgage.initialPayment)],
                    ].map(([label, value], index) => (
                      <div key={label} className={`min-h-[112px] border border-[#b59463] p-4 ${index === 1 ? "bg-[#e9dfcf]" : "bg-[#faf8f4]"}`}>
                        <dt className="text-[8px] uppercase leading-3 tracking-[0.16em] text-stone-500">{label}</dt>
                        <dd className="mt-4 font-serif text-[27px] leading-tight">{value}</dd>
                      </div>
                    ))}
                  </dl>

                  <dl className="mt-2 grid grid-cols-3 border border-[#d8d0c4] bg-[#faf8f4] px-4 py-3">
                    {[
                      ["Сумма кредита", formatCurrency(mortgage.loanAmount)],
                      ["Ставка", `${formatPercent(mortgage.annualRate)}%`],
                      ["Срок", `${formatPercent(mortgage.termYears)} лет`],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-[7px] uppercase tracking-[0.12em] text-stone-500">{label}</dt>
                        <dd className="mt-1 text-[11px] font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-7 flex-1">
                    <p className="text-[7px] uppercase tracking-[0.2em] text-[#9a7747]">{standardMortgage?"Ежемесячный платёж":"График этапов"}</p>
                    {standardMortgage?<div className="mt-4 border border-[#b59463] bg-[#e9dfcf] p-6"><p className="text-[8px] uppercase tracking-[0.16em] text-stone-500">Платёж по сохранённому расчёту</p><p className="mt-3 font-serif text-[34px]">{formatCurrency(standardMonthlyPayment??0)} / мес.</p></div>:<ol className="mt-4">
                      <li className="relative border-l border-[#b59463] pb-6 pl-7">
                        <span className="absolute -left-[5px] top-0 size-[9px] rounded-full border border-[#9a7747] bg-[#f4f0e8]" />
                        <p className="text-[8px] uppercase tracking-[0.16em] text-stone-500">Сегодня</p>
                        <p className="mt-2 text-[9px] text-stone-500">Оплата в дату сделки</p>
                        <p className="mt-1 font-serif text-[22px]">{formatCurrency(mortgage.initialPayment)}</p>
                      </li>
                      {mortgage.stages.map((stage, index) => (
                        <li key={stage.trancheId} className={`relative pl-7 ${index < mortgage.stages.length - 1 ? "border-l border-[#b59463] pb-6" : ""}`}>
                          <span className="absolute -left-[5px] top-0 size-[9px] rounded-full border border-[#9a7747] bg-[#f4f0e8]" />
                          <div className="flex items-start justify-between gap-5">
                            <div>
                              <p className="text-[9px] uppercase tracking-[0.16em] text-stone-500">
                                {stage.issueMonth === 0 ? `1–${stage.endPaymentMonth} месяц` : `С ${stage.startPaymentMonth} месяца`}
                              </p>
                            </div>
                            <div className="min-w-[210px] border-l border-[#d5ccbf] pl-5">
                              <p className="text-[7px] uppercase tracking-[0.13em] text-stone-500">Ежемесячный платёж</p>
                              <p className="mt-1 font-serif text-[22px]">{formatCurrency(stage.monthlyPayment)} / мес.</p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>}
                  </div>

                  <div className="mt-7 border border-[#d0c5b5] bg-[#faf8f4] p-4">
                    <p className="text-[7px] leading-4 text-stone-500">Предварительный расчёт {standardMortgage?"стандартной":"траншевой"} ипотеки. Финальные условия кредитования, процентная ставка, размер платежа и решение о выдаче кредита определяются банком.</p>
                  </div>
                </> : !investmentOnly && <div className="mt-8 border border-[#b59463] bg-[#e9dfcf] p-8"><p className="text-[9px] uppercase tracking-[0.18em] text-stone-500">Предложение по объекту</p><h3 className="mt-4 font-serif text-[34px]">Условия покупки не включены</h3><p className="mt-4 text-[11px] leading-5 text-stone-600">Добавить финансовую схему можно в Sales Workspace, создав новую версию предложения.</p></div>}
                {proposalData.investment&&<div className="mt-5 border border-[#b59463] bg-[#faf8f4] p-5"><p className="text-[8px] uppercase tracking-[0.18em] text-[#9a7747]">Инвестиционный прогноз</p><div className="mt-3 grid grid-cols-3 gap-3">{[["Сценарий",proposalData.investment.scenarioLabel??"—"],["Доход, год 1",formatCurrency(proposalData.investment.firstYearIncome??0)],["Доходность",`${formatPercent(proposalData.investment.firstYearYield??0)}%`],["Рост стоимости",formatCurrency(proposalData.investment.capitalGain??0)],["Горизонт",`${proposalData.investment.horizonYears??"—"} лет`]].map(([label,value])=><div key={String(label)}><p className="text-[7px] uppercase tracking-[0.1em] text-stone-500">{label}</p><p className="mt-1 text-[12px]">{value}</p></div>)}</div></div>}
                <PageFooter page={2} />
              </article>

              <article data-pdf-page className="proposal-page flex h-[1123px] min-h-[1123px] w-[794px] min-w-[794px] flex-col overflow-hidden bg-[#151310] p-14 text-stone-100 shadow-2xl">
                <header className="flex items-end justify-between border-b border-white/15 pb-6">
                  <div>
                    <p className="text-[10px] tracking-[0.34em] text-[#c5a97e]">COSMOS BLACK SEA</p>
                    <h2 className="mt-4 font-serif text-[42px] leading-none">Галерея номера</h2>
                  </div>
                  <p className="text-[8px] uppercase tracking-[0.2em] text-stone-500">Номер {room.roomNumber.replace(/^№/, "")} · {room.area.toLocaleString("ru-RU")} м²</p>
                </header>

                <div className="mt-7 grid flex-1 grid-cols-12 grid-rows-3 gap-2.5">
                  {galleryImages.map((imagePath, index) => (
                    <div key={imagePath} className={`relative min-h-0 overflow-hidden rounded-sm bg-stone-800 ${galleryImages.length >= 6 ? (index === 0 || index === 3 ? "col-span-7" : index === 1 || index === 2 ? "col-span-5" : "col-span-6") : "col-span-6"}`}>
                      <ProposalImage src={imagePath} alt={`Рендер номера ${room.roomNumber}, ${index + 1}`} className="absolute inset-0 h-full w-full object-cover" />
                      <span className="absolute bottom-3 left-3 border border-white/25 bg-black/35 px-2 py-1 text-[7px] tracking-[0.18em] text-white/80 backdrop-blur">{String(index + 1).padStart(2, "0")}</span>
                    </div>
                  ))}
                  {galleryImages.length === 0 && (
                    <div className="col-span-12 row-span-3 grid place-items-center border border-white/10 text-[9px] uppercase tracking-[0.2em] text-stone-500">
                      Рендеры номера временно недоступны
                    </div>
                  )}
                </div>
                <PageFooter page={3} dark />
              </article>
            </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
