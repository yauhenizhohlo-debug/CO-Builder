"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getLayoutById } from "../data/layouts";
import { selectProjectRenders } from "../data/project-renders";
import { getRenderSetById } from "../data/render-sets";
import { calculateOnePage, type OnePageDraft, type OnePageFormat, type OnePageTemplate } from "../lib/one-page";
import { getDefaultBalancerId, type EditablePayment } from "../lib/custom-payment-schedule";
import { CustomPaymentScheduleEditor } from "./custom-payment-schedule-editor";
import { OnePageDocument } from "./one-page-document";
import { useProposalContext } from "./proposal-context";
import { useSelectedRoom } from "./selected-room-context";

const money = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });
const imageDataUrlCache = new Map<string, Promise<string>>();

function imageAsDataUrl(source: string) {
  const existing = imageDataUrlCache.get(source);
  if (existing) return existing;
  const pending = fetch(source)
    .then((response) => {
      if (!response.ok) throw new Error("IMAGE_NOT_AVAILABLE");
      return response.blob();
    })
    .then((blob) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    }));
  imageDataUrlCache.set(source, pending);
  return pending;
}
const templates: Array<{ id: OnePageTemplate; title: string; note: string }> = [
  { id: "ivory", title: "Ivory Editorial", note: "Светлая редакционная подача" },
  { id: "obsidian", title: "Obsidian Core", note: "Тёмная премиальная подача" },
];

const formatDimensions: Record<OnePageFormat, { width: number; height: number; label: string; description: string }> = {
  a4: { width: 794, height: 1123, label: "A4 PDF", description: "Для коммерческого предложения и печати" },
  social: { width: 1080, height: 1350, label: "1080×1350", description: "Для постов Telegram и Instagram" },
  post: { width: 1080, height: 1350, label: "1080×1350", description: "Для постов Telegram и Instagram" },
  story: { width: 1080, height: 1920, label: "1080×1920", description: "Для сторис, статусов WhatsApp и обложки Reels" },
  square: { width: 1080, height: 1080, label: "1080×1080", description: "Для квадратных публикаций и пересылки" },
};

function initialDraft(room: ReturnType<typeof useSelectedRoom>, proposal: ReturnType<typeof useProposalContext>["proposalData"]): OnePageDraft {
  const layout = getLayoutById(room.layoutId);
  const renders = getRenderSetById(room.renderSetId)?.imagePaths ?? [];
  const installment = proposal?.financingType === "installment" && proposal.room.roomNumber === room.roomNumber ? proposal : null;
  const projectRenderPaths = selectProjectRenders(`${room.roomNumber}:0`).map((item) => item.imagePath);
  return {
    room: structuredClone(room), basePrice: room.price, individualPrice: null,
    discount: { mode: "percent", value: installment?.installment.discountPercent ?? 0 },
    initialPaymentMode: "percent", initialPaymentValue: installment?.installment.initialPaymentPercent ?? 15,
    paymentMode: installment ? "calculated" : "custom",
    calculatedSchedule: installment?.schedule ?? [],
    customPayments: [], customScheduleBalanceMode: "auto", customScheduleBalancerId: null,
    specialConditions: "", guaranteedIncome: null, guaranteedIncomeSource: "",
    managerName: "", managerPhone: "", scenarioLabel: installment ? "Рассрочка" : "Индивидуальные условия",
    template: "ivory", format: "a4", layoutPath: layout?.imagePath ?? null, renderPaths: renders.slice(0, 1), projectRenderPaths,
  };
}

export function OnePageGenerator() {
  const room = useSelectedRoom();
  const { proposalData } = useProposalContext();
  const [open, setOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(() => initialDraft(room, proposalData));
  const [message, setMessage] = useState("");
  const [projectRenderSeed, setProjectRenderSeed] = useState(0);
  const documentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setPendingOpen(true);
    window.addEventListener("open-one-page", handler);
    return () => window.removeEventListener("open-one-page", handler);
  }, []);

  useEffect(() => {
    if (!pendingOpen || proposalData?.room.roomNumber !== room.roomNumber) return;
    setDraft(initialDraft(room, proposalData));
    setStep(1);
    setProjectRenderSeed(0);
    setMessage("");
    setOpen(true);
    setPendingOpen(false);
  }, [pendingOpen, proposalData, room]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  const calculation = useMemo(() => calculateOnePage(draft), [draft]);
  if (!open || typeof document === "undefined") return null;

  const set = <K extends keyof OnePageDraft>(key: K, value: OnePageDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const editablePayments: EditablePayment[] = draft.customPayments.map((payment) => ({ ...payment, type: payment.type ?? "regular-first" }));
  const updateCustomPayments = (rows: EditablePayment[]) => set("customPayments", rows.map(({ id, date, label, amount, type }) => ({ id, date, label, amount, type })));
  const choosePaymentMode = (mode: OnePageDraft["paymentMode"]) => {
    setDraft((current) => {
      if (mode !== "custom" || current.customPayments.length > 0) return { ...current, paymentMode: mode };
      const customPayments = current.calculatedSchedule
        .filter((payment) => payment.type !== "initial")
        .map(({ id, date, label, amount, type }) => ({ id, date, label, amount, type }));
      return {
        ...current,
        paymentMode: mode,
        customPayments,
        customScheduleBalanceMode: "auto",
        customScheduleBalancerId: getDefaultBalancerId(customPayments),
      };
    });
  };
  const rotateProjectRenders = () => {
    const nextSeed = projectRenderSeed + 1;
    setProjectRenderSeed(nextSeed);
    set("projectRenderPaths", selectProjectRenders(`${room.roomNumber}:${nextSeed}`).map((item) => item.imagePath));
  };

  const save = async () => {
    setMessage("");
    if (!calculation.isBalanced) return setMessage(calculation.errors.join(" · "));
    const response = await fetch("/api/one-pages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
    const data = await response.json();
    setMessage(response.ok ? `Сохранено: ${data.snapshot.id}` : data.error || "Ошибка сохранения");
  };

  const renderPng = async () => {
    if (!documentRef.current) throw new Error("PREVIEW_NOT_READY");
    await document.fonts.ready;
    const captureNode = documentRef.current;
    const dimensions = formatDimensions[draft.format];
    const originalStyle = captureNode.style.cssText;
    const images = Array.from(captureNode.querySelectorAll("img"));
    const originalSources = images.map((image) => image.getAttribute("src") ?? "");
    const inlinedSources = await Promise.all(originalSources.map((source) => imageAsDataUrl(source)));
    images.forEach((image, index) => { image.src = inlinedSources[index]; });
    Object.assign(captureNode.style, {
      position: "fixed", inset: "0 auto auto 0", zIndex: "2147483647", margin: "0",
      width: `${dimensions.width}px`, height: `${dimensions.height}px`, transform: "none", pointerEvents: "none",
    });
    try {
      await Promise.all(images.map((image) => image.complete ? image.decode().catch(() => undefined) : new Promise<void>((resolve) => { image.onload = () => resolve(); image.onerror = () => resolve(); })));
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const { toPng } = await import("html-to-image");
      return await toPng(captureNode, { cacheBust: true, width: dimensions.width, height: dimensions.height, canvasWidth: dimensions.width, canvasHeight: dimensions.height, pixelRatio: 1 });
    } finally {
      captureNode.style.cssText = originalStyle;
      images.forEach((image, index) => { image.src = originalSources[index]; });
    }
  };

  const download = async () => {
    setMessage("");
    if (!calculation.isBalanced) return setMessage(calculation.errors.join(" · "));
    try {
      const dataUrl = await renderPng();
      const themeName = draft.template === "ivory" ? "Ivory" : draft.template === "obsidian" ? "Obsidian" : draft.template;
      const baseName = `One Page номер ${room.roomNumber.replace(/^№/, "")} ${themeName}`;
      if (draft.format === "a4") {
        const { jsPDF } = await import("jspdf");
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
        pdf.addImage(dataUrl, "PNG", 0, 0, 210, 297, undefined, "FAST");
        pdf.save(`${baseName}.pdf`);
      } else {
        const link = document.createElement("a");
        link.download = `${baseName} ${formatDimensions[draft.format].label}.png`;
        link.href = dataUrl;
        link.click();
      }
      setMessage(draft.format === "a4" ? "PDF сформирован: 1 страница A4" : `PNG ${formatDimensions[draft.format].label} сформирован`);
    } catch { setMessage("Не удалось сформировать файл"); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-stone-950/95 text-stone-100" role="dialog" aria-modal="true" aria-label="Генератор One Page">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-stone-950/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4"><div><p className="eyebrow">One Page Generator</p><p className="mt-1 text-sm">Номер {room.roomNumber} · шаг {step} из 4</p></div><button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-lg border border-white/15 px-4 text-sm">Закрыть</button></div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-5 p-4 lg:grid-cols-[420px_1fr] lg:p-6">
        <aside className="space-y-4">
          <nav className="grid grid-cols-4 gap-1 rounded-xl border border-white/10 p-1">{[1,2,3,4].map((item) => <button key={item} type="button" onClick={() => setStep(item)} className={`min-h-11 rounded-lg text-xs ${step === item ? "bg-amber-100 text-stone-950" : "text-stone-500"}`}>{String(item).padStart(2,"0")}</button>)}</nav>
          <section className="panel p-5">
            {step === 1 && <div><h2 className="font-serif text-2xl">Номер и базовые данные</h2><dl className="mt-5 space-y-3 text-sm"><div className="flex justify-between"><dt className="text-stone-500">Номер</dt><dd>{room.roomNumber}</dd></div><div className="flex justify-between"><dt className="text-stone-500">Площадь</dt><dd>{room.area.toLocaleString("ru-RU")} м²</dd></div><div className="flex justify-between"><dt className="text-stone-500">Базовая цена</dt><dd>{money.format(room.price)}</dd></div></dl><p className="mt-5 text-xs leading-5 text-stone-500">Базовая цена фиксируется в snapshot и не меняется индивидуальными условиями.</p></div>}
            {step === 2 && <div className="space-y-4"><h2 className="font-serif text-2xl">Коммерческие условия</h2>
              <label className="block text-xs text-stone-400">Индивидуальная цена, ₽ (необязательно)<input type="number" value={draft.individualPrice ?? ""} onChange={(e) => set("individualPrice", e.target.value ? Number(e.target.value) : null)} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-stone-950 px-3 text-base" /></label>
              <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => set("discount", { mode:"percent", value:draft.discount.value })} className={`min-h-11 rounded-lg border ${draft.discount.mode === "percent" ? "border-amber-200" : "border-white/10"}`}>Скидка, %</button><button type="button" onClick={() => set("discount", { mode:"amount", value:draft.discount.value })} className={`min-h-11 rounded-lg border ${draft.discount.mode === "amount" ? "border-amber-200" : "border-white/10"}`}>Скидка, ₽</button></div>
              <input aria-label="Размер скидки" type="number" min="0" value={draft.discount.value} onChange={(e) => set("discount", { ...draft.discount, value:Number(e.target.value) })} className="min-h-12 w-full rounded-xl border border-white/10 bg-stone-950 px-3 text-base" />
              <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => set("initialPaymentMode", "percent")} className={`min-h-11 rounded-lg border ${draft.initialPaymentMode === "percent" ? "border-amber-200" : "border-white/10"}`}>ПВ, %</button><button type="button" onClick={() => set("initialPaymentMode", "amount")} className={`min-h-11 rounded-lg border ${draft.initialPaymentMode === "amount" ? "border-amber-200" : "border-white/10"}`}>ПВ, ₽</button></div>
              <input aria-label="Первоначальный взнос" type="number" min="0" value={draft.initialPaymentValue} onChange={(e) => set("initialPaymentValue", Number(e.target.value))} className="min-h-12 w-full rounded-xl border border-white/10 bg-stone-950 px-3 text-base" />
              <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => choosePaymentMode("calculated")} className={`min-h-11 rounded-lg border ${draft.paymentMode === "calculated" ? "border-amber-200" : "border-white/10"}`}>Текущий график</button><button type="button" onClick={() => choosePaymentMode("custom")} className={`min-h-11 rounded-lg border ${draft.paymentMode === "custom" ? "border-amber-200" : "border-white/10"}`}>Свои этапы</button></div>
              {draft.paymentMode === "custom" && <CustomPaymentScheduleEditor rows={editablePayments} expectedTotal={calculation.dealPrice - calculation.initialPayment} balanceMode={draft.customScheduleBalanceMode ?? "auto"} balancerId={draft.customScheduleBalancerId ?? getDefaultBalancerId(editablePayments)} onRowsChange={updateCustomPayments} onBalanceModeChange={(mode) => set("customScheduleBalanceMode", mode)} onBalancerChange={(id) => set("customScheduleBalancerId", id)} />}
              <label className="block text-xs text-stone-400">Специальные условия<textarea rows={3} value={draft.specialConditions} onChange={(e) => set("specialConditions",e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-stone-950 p-3 text-base"/></label>
            </div>}
            {step === 3 && <div><h2 className="font-serif text-2xl">Тема и контент</h2><p className="mt-2 text-xs leading-5 text-stone-500">Единый master-template и две актуальные визуальные темы. Старые snapshots продолжают поддерживаться.</p><div className="mt-4 space-y-2">{templates.map((item) => <button key={item.id} type="button" onClick={() => set("template",item.id)} className={`w-full rounded-xl border p-3 text-left ${draft.template===item.id?"border-amber-200 bg-amber-100/[.08]":"border-white/10"}`}><span className="text-sm">{item.title}</span><span className="mt-1 block text-xs text-stone-500">{item.note}</span></button>)}</div><div className="mt-4 rounded-xl border border-white/10 p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm">Project renders · Auto</p><p className="mt-1 text-xs text-stone-500">Экстерьер + территория + инфраструктура</p></div><button type="button" onClick={rotateProjectRenders} className="min-h-11 rounded-lg border border-white/15 px-3 text-xs">Обновить подбор</button></div><div className="mt-3 grid grid-cols-3 gap-2">{draft.projectRenderPaths.map((path)=><div key={path} className="aspect-[4/3] overflow-hidden rounded"><img src={path} alt="Выбранный проектный рендер" className="h-full w-full object-cover"/></div>)}</div></div><div className="mt-4 space-y-3"><input placeholder="Имя менеджера (необязательно)" value={draft.managerName} onChange={(e)=>set("managerName",e.target.value)} className="min-h-12 w-full rounded-xl border border-white/10 bg-stone-950 px-3 text-base"/><input placeholder="Телефон / мессенджер" value={draft.managerPhone} onChange={(e)=>set("managerPhone",e.target.value)} className="min-h-12 w-full rounded-xl border border-white/10 bg-stone-950 px-3 text-base"/><input type="number" min="0" placeholder="Подтверждённый доход, ₽ (необязательно)" value={draft.guaranteedIncome ?? ""} onChange={(e)=>set("guaranteedIncome",e.target.value?Number(e.target.value):null)} className="min-h-12 w-full rounded-xl border border-white/10 bg-stone-950 px-3 text-base"/>{draft.guaranteedIncome ? <input placeholder="Источник подтверждённых данных" value={draft.guaranteedIncomeSource} onChange={(e)=>set("guaranteedIncomeSource",e.target.value)} className="min-h-12 w-full rounded-xl border border-white/10 bg-stone-950 px-3 text-base"/> : null}</div></div>}
            {step === 4 && <div><h2 className="font-serif text-2xl">Сохранение и экспорт</h2><div className="mt-5 grid gap-2">{(["a4","post","story","square"] as const).map((format)=><button key={format} type="button" onClick={() => set("format",format)} className={`min-h-14 rounded-lg border px-3 py-2 text-left ${draft.format===format?"border-amber-200 bg-amber-100/[0.05]":"border-white/10"}`}><span className="block text-sm">{formatDimensions[format].label}</span><span className="mt-0.5 block text-[11px] leading-4 text-stone-500">{formatDimensions[format].description}</span></button>)}</div><div className="mt-4 space-y-2"><button type="button" onClick={save} className="min-h-12 w-full rounded-xl border border-white/15">Сохранить snapshot</button><button type="button" onClick={download} className="min-h-12 w-full rounded-xl bg-amber-100 font-medium text-stone-950">{draft.format==="a4"?"Скачать PDF":"Скачать PNG"}</button></div></div>}
            {calculation.errors.length > 0 && <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-red-300">{calculation.errors.map((error)=><li key={error}>{error}</li>)}</ul>}
            {message && <p role="status" className="mt-4 text-xs text-amber-100">{message}</p>}
            <div className="mt-6 flex justify-between"><button type="button" disabled={step===1} onClick={()=>setStep(step-1)} className="min-h-11 rounded-lg border border-white/10 px-4 disabled:opacity-30">Назад</button><button type="button" disabled={step===4} onClick={()=>setStep(step+1)} className="min-h-11 rounded-lg border border-white/10 px-4 disabled:opacity-30">Далее</button></div>
          </section>
        </aside>
        <main className="min-w-0 overflow-auto rounded-2xl bg-stone-800 p-3 sm:p-6" aria-label="Предпросмотр One Page">
          <OnePageDocument ref={documentRef} draft={draft} calculation={calculation} />
        </main>
      </div>
    </div>, document.body,
  );
}
