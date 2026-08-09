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
const formatDate = (date: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

function PageFooter({ page }: { page: number }) {
  return (
    <footer className="mt-auto flex items-center justify-between border-t border-stone-300 pt-4 text-[9px] uppercase tracking-[0.18em] text-stone-400">
      <span>Cosmos Black Sea · KP Builder</span>
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
  const installment = proposalData?.installment;
  const schedule = proposalData?.schedule ?? [];
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
          disabled={!proposalData}
          onClick={() => setIsOpen(true)}
          className="mt-5 w-full rounded-xl bg-amber-100 px-4 py-3.5 text-sm font-medium text-stone-950 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Сформировать КП
        </button>
      </section>

      {isOpen && proposalData && room && layout && renderSet && installment && createPortal(
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
              <article className="proposal-page flex min-h-[1123px] flex-col overflow-hidden bg-[#f5f1e9] p-10 text-[#1c1915] shadow-2xl sm:p-14">
                <header className="flex items-start justify-between border-b border-stone-300 pb-7">
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.28em]">COSMOS BLACK SEA</p>
                    <h1 className="mt-4 font-serif text-4xl leading-none">Коммерческое предложение</h1>
                  </div>
                  <p className="text-right text-[9px] uppercase tracking-[0.18em] text-stone-500">Гостиничный номер<br />у Чёрного моря</p>
                </header>

                <div className="mt-8 grid grid-cols-[0.7fr_1.3fr] gap-8">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.2em] text-stone-500">Выбранный объект</p>
                    <p className="mt-3 font-serif text-6xl">№ {room.roomNumber.replace(/^№/, "")}</p>
                    <dl className="mt-8 divide-y divide-stone-300 border-y border-stone-300">
                      {[
                        ["Этаж", `${room.floor}`],
                        ["Площадь", `${room.area.toLocaleString("ru-RU")} м²`],
                        ["Цена за м²", formatCurrency(room.pricePerSqm)],
                        ["Полная стоимость", formatCurrency(room.price)],
                      ].map(([label, value]) => (
                        <div key={label} className="py-3">
                          <dt className="text-[9px] text-stone-500">{label}</dt>
                          <dd className="mt-1 text-sm font-medium">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <div className="relative min-h-80 overflow-hidden rounded-sm bg-stone-200">
                    <img src={renderSet.imagePaths[0]} alt={`Рендер номера ${room.roomNumber}`} loading="eager" decoding="sync" className="absolute inset-0 h-full w-full object-cover" />
                  </div>
                </div>

                <div className="mt-8 flex min-h-96 flex-1 flex-col rounded-sm border border-stone-300 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] uppercase tracking-[0.2em] text-stone-500">Планировка</p>
                    <p className="text-[9px] text-stone-400">{layout.id}</p>
                  </div>
                  <div className="relative flex-1">
                    <img src={layout.imagePath} alt={`Планировка номера ${room.roomNumber}`} loading="eager" decoding="sync" className="absolute inset-0 h-full w-full object-contain" />
                  </div>
                </div>
                <PageFooter page={1} />
              </article>

              <article className="proposal-page flex min-h-[1123px] flex-col bg-[#f5f1e9] p-10 text-[#1c1915] shadow-2xl sm:p-14">
                <header className="border-b border-stone-300 pb-6">
                  <p className="text-[10px] font-semibold tracking-[0.24em]">COSMOS BLACK SEA</p>
                  <h2 className="mt-4 font-serif text-4xl">Условия покупки</h2>
                </header>

                <dl className="mt-7 grid grid-cols-2 gap-x-8 gap-y-0">
                  {[
                    ["Цена по прайсу", formatCurrency(installment.listPrice)],
                    ["Скидка", `${installment.discountPercent}%`],
                    ["Цена после скидки", formatCurrency(installment.discountedPrice)],
                    ["Первоначальный взнос", `${installment.initialPaymentPercent}%`],
                    ["Первоначальный взнос, ₽", formatCurrency(installment.initialPayment)],
                    ["Ежемесячный платёж", formatCurrency(installment.monthlyPayment)],
                    ["Платежей первого периода", `${installment.firstPeriodPaymentCount}`],
                    ["Контрольный довнос до 50%", formatCurrency(installment.topUpPayment)],
                    ["11 платежей второго периода", formatCurrency(installment.secondPeriodPayments)],
                    ["Финальный остаток", formatCurrency(installment.finalPayment)],
                  ].map(([label, value]) => (
                    <div key={label} className="border-b border-stone-300 py-3">
                      <dt className="text-[9px] text-stone-500">{label}</dt>
                      <dd className="mt-1 text-sm font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-7">
                  <div className="flex items-end justify-between border-b border-stone-400 pb-3">
                    <h3 className="font-serif text-2xl">Календарь платежей</h3>
                    <p className="text-[9px] uppercase tracking-[0.14em] text-stone-400">Дата · сумма</p>
                  </div>
                  <ol className="mt-3 grid grid-cols-2 gap-x-7">
                    {schedule.map((payment) => (
                      <li key={payment.id} className={`flex items-center justify-between gap-3 border-b py-1.5 text-[9px] ${payment.type === "top-up" || payment.type === "final" ? "border-[#9a7747] bg-[#ece1cf] px-2 font-semibold" : "border-stone-200"}`}>
                        <span className="min-w-0 truncate"><span className="mr-2 text-stone-400">{formatDate(payment.date)}</span>{payment.label}</span>
                        <span className="shrink-0">{formatCurrency(payment.amount)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <PageFooter page={2} />
              </article>

              <article className="proposal-page flex min-h-[1123px] flex-col bg-[#171512] p-10 text-stone-100 shadow-2xl sm:p-14">
                <header className="flex items-end justify-between border-b border-white/15 pb-6">
                  <div>
                    <p className="text-[10px] tracking-[0.24em] text-amber-100/70">COSMOS BLACK SEA</p>
                    <h2 className="mt-4 font-serif text-4xl">Галерея номера</h2>
                  </div>
                  <p className="text-[9px] uppercase tracking-[0.18em] text-stone-500">№ {room.roomNumber.replace(/^№/, "")} · {renderSet.title}</p>
                </header>

                <div className="mt-8 grid flex-1 grid-cols-2 gap-3">
                  {galleryImages.map((imagePath, index) => (
                    <div key={imagePath} className={`relative min-h-0 overflow-hidden rounded-sm bg-stone-800 ${galleryImages.length === 3 && index === 0 ? "col-span-2" : ""}`}>
                      <img src={imagePath} alt={`Рендер номера ${room.roomNumber}, ${index + 1}`} loading="eager" decoding="sync" className="absolute inset-0 h-full w-full object-cover" />
                      <span className="absolute bottom-3 left-3 rounded-full bg-black/50 px-2 py-1 text-[8px] tracking-wider backdrop-blur">{String(index + 1).padStart(2, "0")}</span>
                    </div>
                  ))}
                </div>
                <footer className="mt-7 flex items-center justify-between border-t border-white/15 pt-4 text-[9px] uppercase tracking-[0.18em] text-stone-500">
                  <span>Cosmos Black Sea · KP Builder</span><span>3 / 3</span>
                </footer>
              </article>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
