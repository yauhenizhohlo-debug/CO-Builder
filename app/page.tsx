import { PurchaseOptions } from "./components/purchase-options";
import { RoomSelector } from "./components/room-selector";
import { SelectedRoomProvider } from "./components/selected-room-context";
import { ProposalProvider } from "./components/proposal-context";
import { ProposalPreview } from "./components/proposal-preview";
import { ImportedInventoryContext } from "./components/imported-inventory-context";
import { ImportedProposalVersion } from "./components/imported-proposal-version";
import { BuilderShell } from "./components/builder-shell";
import { ThemeProvider } from "./ui/theme-provider";

export default async function Home({searchParams}:{searchParams:Promise<{context?:string;proposalVersion?:string}>}) {
  const params=await searchParams;
  if(params.proposalVersion)return <ImportedProposalVersion contextId={params.proposalVersion}/>;
  const contextId=params.context;
  if(contextId)return <ImportedInventoryContext contextId={contextId}/>;
  return (
    <ThemeProvider defaultTheme="enterprise-light">
      <SelectedRoomProvider>
        <ProposalProvider>
          <BuilderShell>
      <section className="builder-content mx-auto max-w-[1680px] px-5 pb-8 pt-8 lg:px-8 lg:pt-8">
        <div className="builder-page-heading mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="builder-content__eyebrow mb-3 text-xs uppercase tracking-[0.24em]">Рабочее пространство</p>
            <h1 className="builder-content__title max-w-3xl font-serif text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Выберите номер
            </h1>
          </div>
          <p className="builder-content__intro max-w-md text-sm leading-6">
            Соберите персональные условия покупки гостиничного номера в Cosmos Black Sea.
          </p>
        </div>

        <nav aria-label="Этапы подготовки предложения" className="builder-stagebar mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl lg:grid-cols-4">
          {[
            ["01", "Выбор номера", "active"],
            ["02", "Условия покупки", "active"],
            ["03", "Расчёт", "active"],
            ["04", "Коммерческое предложение", "active"],
          ].map(([number, title, state]) => (
            <div key={number} className={`builder-stagebar__item min-w-0 px-3 py-4 sm:px-5 ${state === "future" ? "is-future" : ""}`}>
              <span className="mr-3 text-[10px] tracking-widest">{number}</span>
              <span className="break-words text-[11px] uppercase tracking-[0.08em] sm:text-sm sm:tracking-[0.12em]">{title}</span>
            </div>
          ))}
        </nav>

        <div className="builder-screen min-w-0">
          <RoomSelector />
          <div className="builder-payment-column min-w-0 space-y-5">
            <PurchaseOptions />
          </div>
          <aside className="builder-preview-column min-w-0">
            <ProposalPreview />
          </aside>
        </div>
      </section>
          </BuilderShell>
        </ProposalProvider>
      </SelectedRoomProvider>
    </ThemeProvider>
  );
}
