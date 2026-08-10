"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getLayoutById } from "../data/layouts";
import { getRenderSetById } from "../data/render-sets";
import { useProposalContext } from "./proposal-context";

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

function PageFooter({ page, dark = false }: { page: number; dark?: boolean }) {
  return (
    <footer className={`mt-auto flex items-center justify-between border-t pt-4 text-[9px] uppercase tracking-[0.24em] ${dark ? "border-white/15 text-stone-500" : "border-stone-300 text-stone-400"}`}>
      <span>Cosmos Black Sea</span>
      <span>{page} / 3</span>
    </footer>
  );
}

export function ProposalPreview() {
  const { proposalData } = useProposalContext();
  const [isOpen, setIsOpen] = useState(false);

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

  const room = proposalData?.room;
  const layout = room ? getLayoutById(room.layoutId) : undefined;
  const renderSet = room ? getRenderSetById(room.renderSetId) : undefined;
  const installment = proposalData?.financingType === "installment" ? proposalData.installment : undefined;
  const mortgage = proposalData?.financingType === "mortgage" ? proposalData.mortgage : undefined;
  const schedule = proposalData?.financingType === "installment" ? proposalData.schedule : [];
  const galleryImages = renderSet?.imagePaths.slice(0, 6) ?? [];

  const handlePrint = async () => {
    const proposal = document.querySelector<HTMLElement>(".proposal-print-root");
    const images = proposal ? Array.from(proposal.querySelectorAll("img")) : [];

    await Promise.all(
      images.map((image) => {
        if (image.complete) {
          return image.decode?.().catch(() => undefined) ?? Promise.resolve();
        }

        return new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
      }),
    );

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    window.print();
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
          Сформировать КП
        </button>
      </section>

      {isOpen && proposalData && room && layout && renderSet && createPortal(
        <div className="proposal-print-root">
          <div className="proposal-modal fixed inset-0 z-[70] overflow-y-auto bg-stone-950/95 backdrop-blur-sm">
            <div className="proposal-controls sticky top-0 z-20 border-b border-white/10 bg-stone-950/90 px-4 py-3 backdrop-blur">
              <div className="mx-auto flex max-w-[794px] items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-amber-100/70">Preview КП</p>
                  <p className="mt-1 text-xs text-stone-500">Номер {room.roomNumber.replace(/^№/, "")}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={handlePrint} className="relative z-10 rounded-lg bg-amber-100 px-4 py-2.5 text-xs font-medium text-stone-950 hover:bg-amber-50">
                    Сохранить PDF
                  </button>
                  <button type="button" onClick={() => setIsOpen(false)} className="rounded-lg border border-white/15 px-4 py-2.5 text-xs text-stone-300 hover:border-white/30">
                    Закрыть
                  </button>
                </div>
              </div>
            </div>

            <div className="proposal-pages mx-auto flex max-w-[794px] flex-col gap-6 py-6">
              <article className="proposal-page flex min-h-[1123px] flex-col overflow-hidden bg-[#f4f0e8] p-10 text-[#191713] shadow-2xl sm:p-14">
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
                    <img src={renderSet.imagePaths[0]} alt={`Рендер номера ${room.roomNumber}`} loading="eager" decoding="sync" className="absolute inset-0 h-full w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-5 pb-4 pt-12 text-[8px] uppercase tracking-[0.2em] text-white/80">Интерьер номера · визуализация</div>
                  </div>
                </div>

                <div className="relative mt-7 flex min-h-[390px] flex-1 flex-col overflow-hidden rounded-sm border border-[#d8d0c4] bg-[#faf8f4]">
                  <p className="absolute left-4 top-4 z-10 text-[8px] uppercase tracking-[0.24em] text-[#7d6748]">Планировка номера</p>
                  <div className="relative flex-1">
                    <img src={layout.imagePath} alt={`Планировка номера ${room.roomNumber}`} loading="eager" decoding="sync" className="absolute inset-0 h-full w-full object-contain" />
                  </div>
                </div>
                <PageFooter page={1} />
              </article>

              <article className="proposal-page flex min-h-[1123px] flex-col bg-[#f4f0e8] p-10 text-[#191713] shadow-2xl sm:p-14">
                <header className="flex items-end justify-between border-b border-[#cec5b6] pb-5">
                  <div>
                    <p className="text-[10px] font-semibold tracking-[0.34em] text-[#7d6748]">COSMOS BLACK SEA</p>
                    <h2 className="mt-3 font-serif text-[40px] leading-none">Условия покупки</h2>
                  </div>
                  <p className="text-[8px] uppercase tracking-[0.2em] text-stone-500">Номер {room.roomNumber.replace(/^№/, "")} · {room.area.toLocaleString("ru-RU")} м²</p>
                </header>

                {installment ? <>
                <dl className="mt-5 grid grid-cols-6 gap-2 border-y border-[#d8d0c4] py-3">
                  {[
                    ["Цена по прайсу", formatCurrency(installment.listPrice)],
                    ["Скидка, %", `${formatPercent(installment.discountPercent)}%`],
                    ["Скидка, ₽", formatCurrency(installment.discountAmount)],
                    ["Цена после скидки", formatCurrency(installment.discountedPrice)],
                    ["Первоначальный взнос", `${installment.initialPaymentPercent}%`],
                    ["Платежей до довноса", `${installment.firstPeriodPaymentCount}`],
                  ].map(([label, value]) => (
                    <div key={label} className="px-2 first:pl-0 last:pr-0">
                      <dt className="text-[7px] uppercase leading-3 tracking-[0.12em] text-stone-500">{label}</dt>
                      <dd className="mt-1 text-[11px] font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-5 grid grid-cols-4 gap-2">
                  {[
                    ["01", "Первоначальный взнос", formatCurrency(installment.initialPayment), `${installment.initialPaymentPercent}% от стоимости`],
                    ["02", "Ежемесячный платёж", formatCurrency(installment.monthlyPayment), `${installment.firstPeriodPaymentCount} платежей до 30.06.2027`],
                    ["03", "Довнос до 50%", formatCurrency(installment.topUpPayment), "Довнос до 50% оплаты"],
                    ["04", "Финальный остаток", formatCurrency(installment.finalPayment), `После 11 платежей на ${formatCurrency(installment.secondPeriodPayments)}`],
                  ].map(([step, label, value, note], index) => (
                    <div key={label} className={`min-h-[126px] border border-[#b59463] p-3 ${index === 0 || index === 2 ? "bg-[#e9dfcf]" : "bg-[#faf8f4]"}`}>
                      <p className="text-[8px] tracking-[0.2em] text-[#9a7747]">{step}</p>
                      <p className="mt-4 text-[8px] uppercase leading-3 tracking-[0.12em] text-stone-500">{label}</p>
                      <p className="mt-2 font-serif text-[20px] font-medium leading-none">{value}</p>
                      <p className="mt-3 text-[7px] leading-3 text-stone-500">{note}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <div className="flex items-end justify-between border-b border-[#9f9688] pb-2">
                    <div>
                      <p className="text-[7px] uppercase tracking-[0.2em] text-[#9a7747]">Персональный график</p>
                      <h3 className="mt-1 font-serif text-[25px] leading-none">Календарь платежей</h3>
                    </div>
                    <p className="text-[7px] uppercase tracking-[0.14em] text-stone-400">Дата · назначение · сумма</p>
                  </div>
                  <ol className="mt-2 grid grid-cols-2 gap-x-6">
                    {schedule.map((payment) => (
                      <li key={payment.id} className={`flex items-center justify-between gap-2 border-b py-[5px] text-[7.5px] ${payment.type === "top-up" || payment.type === "final" ? "border-[#b59463] bg-[#e9dfcf] px-2 font-semibold" : "border-[#ddd6ca]"}`}>
                        <span className="min-w-0 truncate"><span className="mr-2 text-stone-400">{formatDate(payment.date)}</span>{payment.label}</span>
                        <span className="shrink-0">{formatCurrency(payment.amount)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                </> : mortgage ? <>
                  <div className="mt-5 flex items-center justify-between border-y border-[#d8d0c4] py-4">
                    <div>
                      <p className="text-[8px] uppercase tracking-[0.18em] text-[#9a7747]">Траншевая ипотека</p>
                      <p className="mt-2 font-serif text-[25px]">Финансовый сценарий покупки</p>
                    </div>
                    <p className="max-w-[180px] text-right text-[7px] leading-3 text-stone-500">Аннуитетный платёж рассчитывается только на фактически выданную сумму кредита.</p>
                  </div>

                  <dl className="mt-5 grid grid-cols-4 gap-2">
                    {[
                      ["Стоимость номера", formatCurrency(mortgage.price)],
                      ["Первоначальный взнос", formatCurrency(mortgage.initialPayment)],
                      ["Сумма кредита", formatCurrency(mortgage.loanAmount)],
                      ["Ставка · срок", `${formatPercent(mortgage.annualRate)}% · ${formatPercent(mortgage.termYears)} лет`],
                    ].map(([label, value], index) => (
                      <div key={label} className={`min-h-[94px] border border-[#b59463] p-3 ${index === 1 ? "bg-[#e9dfcf]" : "bg-[#faf8f4]"}`}>
                        <dt className="text-[7px] uppercase leading-3 tracking-[0.12em] text-stone-500">{label}</dt>
                        <dd className="mt-3 font-serif text-[17px] leading-tight">{value}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-7 flex-1">
                    <p className="text-[7px] uppercase tracking-[0.2em] text-[#9a7747]">Сценарий финансирования</p>
                    <ol className="mt-4">
                      <li className="relative border-l border-[#b59463] pb-6 pl-7">
                        <span className="absolute -left-[5px] top-0 size-[9px] rounded-full border border-[#9a7747] bg-[#f4f0e8]" />
                        <p className="text-[8px] uppercase tracking-[0.16em] text-stone-500">Сегодня</p>
                        <p className="mt-2 text-[9px] text-stone-500">Первоначальный взнос</p>
                        <p className="mt-1 font-serif text-[22px]">{formatCurrency(mortgage.initialPayment)}</p>
                      </li>
                      {mortgage.stages.map((stage, index) => (
                        <li key={stage.trancheId} className={`relative pl-7 ${index < mortgage.stages.length - 1 ? "border-l border-[#b59463] pb-6" : ""}`}>
                          <span className="absolute -left-[5px] top-0 size-[9px] rounded-full border border-[#9a7747] bg-[#f4f0e8]" />
                          <div className="flex items-start justify-between gap-5">
                            <div>
                              <p className="text-[8px] uppercase tracking-[0.16em] text-stone-500">{stage.issueMonth === 0 ? "В дату сделки" : `С ${stage.startPaymentMonth} месяца`}</p>
                              <p className="mt-2 text-[10px]">Транш №{stage.trancheNumber} · {formatCurrency(stage.trancheAmount)}</p>
                            </div>
                            <div className="min-w-[210px] border-l border-[#d5ccbf] pl-5">
                              <p className="text-[7px] uppercase tracking-[0.13em] text-stone-500">Расчётный платёж</p>
                              <p className="mt-1 font-serif text-[22px]">{formatCurrency(stage.monthlyPayment)} / мес.</p>
                              <p className="mt-1 text-[7px] text-stone-500">Месяцы {stage.startPaymentMonth}–{stage.endPaymentMonth}</p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="mt-7 border border-[#d0c5b5] bg-[#faf8f4] p-4">
                    <p className="text-[7px] leading-4 text-stone-500">Расчёт является предварительным и носит информационный характер. Финальные условия кредитования, процентная ставка, размер платежа и решение о выдаче кредита определяются банком.</p>
                  </div>
                </> : null}
                <PageFooter page={2} />
              </article>

              <article className="proposal-page flex min-h-[1123px] flex-col bg-[#151310] p-10 text-stone-100 shadow-2xl sm:p-14">
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
                      <img src={imagePath} alt={`Рендер номера ${room.roomNumber}, ${index + 1}`} loading="eager" decoding="sync" className="absolute inset-0 h-full w-full object-cover" />
                      <span className="absolute bottom-3 left-3 border border-white/25 bg-black/35 px-2 py-1 text-[7px] tracking-[0.18em] text-white/80 backdrop-blur">{String(index + 1).padStart(2, "0")}</span>
                    </div>
                  ))}
                </div>
                <PageFooter page={3} dark />
              </article>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
