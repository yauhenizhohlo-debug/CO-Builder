import { PurchaseOptions } from "./components/purchase-options";
import { RoomSelector } from "./components/room-selector";
import { SelectedRoomProvider } from "./components/selected-room-context";
import { ProposalProvider } from "./components/proposal-context";
import { ProposalPreview } from "./components/proposal-preview";
import { ImportedInventoryContext } from "./components/imported-inventory-context";

export default async function Home({searchParams}:{searchParams:Promise<{context?:string}>}) {
  const contextId=(await searchParams).context;
  if(contextId)return <ImportedInventoryContext contextId={contextId}/>;
  return (
    <SelectedRoomProvider>
      <ProposalProvider>
        <main className="min-h-screen bg-stone-950 text-stone-100">
      <header className="border-b border-white/10 px-5 py-5 lg:px-10">
        <div className="mx-auto flex min-w-0 max-w-[1500px] items-center justify-between gap-4 sm:gap-6">
          <div className="flex items-center gap-4">
            <div className="grid size-10 place-items-center rounded-full border border-amber-200/40 text-lg text-amber-100">
              C
            </div>
            <div>
              <p className="font-serif text-lg tracking-[0.12em]">COSMOS</p>
              <p className="text-[10px] uppercase tracking-[0.32em] text-stone-500">Black Sea</p>
            </div>
          </div>
          <div className="min-w-0 text-right">
            <p className="text-xs uppercase tracking-[0.22em] text-amber-100/70">KP Builder</p>
            <p className="mt-1 hidden text-xs text-stone-500 sm:block">Инструмент отдела продаж</p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-5 pb-8 pt-10 lg:px-10 lg:pt-14">
        <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.28em] text-amber-200/70">Коммерческое предложение</p>
            <h1 className="max-w-3xl font-serif text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Выберите номер
            </h1>
          </div>
          <p className="max-w-md text-sm leading-6 text-stone-400">
            Соберите персональные условия покупки гостиничного номера в Cosmos Black Sea.
          </p>
        </div>

        <nav aria-label="Этапы подготовки предложения" className="mb-7 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 lg:grid-cols-4">
          {[
            ["01", "Выбор номера", "active"],
            ["02", "Условия покупки", "active"],
            ["03", "Расчёт", "active"],
            ["04", "Коммерческое предложение", "active"],
          ].map(([number, title, state]) => (
            <div key={number} className={`min-w-0 bg-stone-900 px-3 py-4 sm:px-5 ${state === "future" ? "text-stone-600" : "text-stone-200"}`}>
              <span className="mr-3 text-[10px] tracking-widest text-amber-200/60">{number}</span>
              <span className="break-words text-[11px] uppercase tracking-[0.08em] sm:text-sm sm:tracking-[0.12em]">{title}</span>
            </div>
          ))}
        </nav>

        <div className="grid min-w-0 gap-5 xl:grid-cols-[0.85fr_1.45fr_0.9fr]">
          <RoomSelector />

          <aside className="min-w-0 space-y-5">
            <PurchaseOptions />

            <ProposalPreview />
          </aside>
        </div>
      </section>
        </main>
      </ProposalProvider>
    </SelectedRoomProvider>
  );
}
