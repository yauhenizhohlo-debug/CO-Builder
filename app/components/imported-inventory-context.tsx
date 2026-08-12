"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProposalContextResponse } from "@cosmos/proposal-contract";
import { mapImportedProposal } from "../lib/map-imported-proposal";
import { formatRubles } from "../lib/proposal-money";
import { validateImportedContext } from "../lib/validate-imported-context";
import { safeInventoryReturnUrl } from "../lib/inventory-return-url";
import { ProposalProvider } from "./proposal-context";
import { ProposalPreview } from "./proposal-preview";

function paymentModeLabel(mode: ProposalContextResponse["data"]["payment"]["mode"]) {
  if (mode === "INSTALLMENT") return "Рассрочка";
  if (mode === "TRANCHE_MORTGAGE") return "Траншевая ипотека";
  return "Ипотека";
}

function ImportedContextContent({ contextId }: { contextId: string }) {
  const [value, setValue] = useState<ProposalContextResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/inventory-context/${encodeURIComponent(contextId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(response.status === 404
            ? "Расчёт не найден."
            : "Inventory временно недоступен.");
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => setValue(validateImportedContext(payload)))
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Не удалось загрузить расчёт.");
      });
    return () => controller.abort();
  }, [contextId]);

  const proposalData = useMemo(
    () => value ? mapImportedProposal(value.data) : null,
    [value],
  );

  if (error) {
    return (
      <main className="min-h-screen bg-stone-950 p-5 text-white sm:p-10">
        <h1 className="font-serif text-3xl sm:text-4xl">Не удалось загрузить КП</h1>
        <p className="mt-4 text-stone-400">{error}</p>
        <a className="mt-6 inline-block text-amber-100" href="/">Открыть Builder без context</a>
      </main>
    );
  }

  if (!value || !proposalData) {
    return <main className="min-h-screen bg-stone-950 p-5 text-white sm:p-10">Загружаем расчёт из COSMOS Inventory…</main>;
  }

  const { data, liveCheck } = value;
  const unit = data.unitSnapshot;
  const returnUrl = safeInventoryReturnUrl(data.returnUrl);

  return (
    <main className="min-h-screen bg-stone-950 p-5 text-white lg:p-10">
      <div className="mx-auto min-w-0 max-w-6xl">
        {returnUrl && <a className="mb-5 inline-block text-sm text-amber-100 hover:text-white" href={returnUrl}>← Вернуться к лоту №{unit.unitNumber.replace(/^№/, "")}</a>}
        <div className="rounded-xl border border-emerald-300/30 p-4 text-sm text-emerald-100">
          Лот и расчёты загружены из COSMOS Inventory · №{unit.unitNumber.replace(/^№/, "")} · {unit.area ?? "—"} м² · {formatRubles(unit.price)}
        </div>

        {(liveCheck.priceChanged || liveCheck.statusChanged) && (
          <div className="mt-3 rounded-xl border border-amber-300/30 p-4 text-sm text-amber-100">
            {liveCheck.priceChanged && <p>Цена лота изменилась. В КП используется зафиксированная snapshot-цена {formatRubles(unit.price)}.</p>}
            {liveCheck.statusChanged && <p>Статус лота изменился: {liveCheck.currentStatus}. Условия КП сохранены на дату snapshot.</p>}
          </div>
        )}

        <header className="py-10">
          <p className="eyebrow">Готовое коммерческое предложение</p>
          <h1 className="mt-3 font-serif text-4xl sm:text-5xl">Номер {unit.unitNumber.replace(/^№/, "")}</h1>
          <p className="mt-3 text-stone-400">{unit.floor} этаж · {unit.area ?? "—"} м²{unit.viewType ? ` · ${unit.viewType}` : ""}</p>
        </header>

        <div className="grid gap-5 md:grid-cols-2">
          <section className="panel p-6">
            <p className="eyebrow">Snapshot объекта</p>
            <dl className="mt-3">
              {[
                ["Стоимость", formatRubles(unit.price)],
                ["Цена за м²", formatRubles(unit.pricePerSqm)],
                ["Статус на дату snapshot", unit.status],
              ].map(([label, content]) => (
                <div key={label} className="flex min-w-0 flex-col gap-1 border-b border-white/10 py-3 min-[380px]:flex-row min-[380px]:justify-between min-[380px]:gap-3">
                  <dt className="text-stone-500">{label}</dt>
                  <dd>{content}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="panel p-6">
            <p className="eyebrow">Snapshot условий</p>
            <dl className="mt-3">
              <div className="flex min-w-0 flex-col gap-1 border-b border-white/10 py-3 min-[380px]:flex-row min-[380px]:justify-between min-[380px]:gap-3">
                <dt className="text-stone-500">Режим</dt>
                <dd>{paymentModeLabel(data.payment.mode)}</dd>
              </div>
              <div className="flex min-w-0 flex-col gap-1 border-b border-white/10 py-3 min-[380px]:flex-row min-[380px]:justify-between min-[380px]:gap-3">
                <dt className="text-stone-500">Версия расчёта</dt>
                <dd>{data.paymentEngineVersion}</dd>
              </div>
              <div className="flex min-w-0 flex-col gap-1 border-b border-white/10 py-3 min-[380px]:flex-row min-[380px]:justify-between min-[380px]:gap-3">
                <dt className="text-stone-500">Зафиксирован</dt>
                <dd>{new Date(data.createdAt).toLocaleDateString("ru-RU")}</dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="mt-5 w-full max-w-sm">
          <ProposalPreview importedProposalData={proposalData} />
        </div>
      </div>
    </main>
  );
}

export function ImportedInventoryContext({ contextId }: { contextId: string }) {
  return (
    <ProposalProvider>
      <ImportedContextContent contextId={contextId} />
    </ProposalProvider>
  );
}
