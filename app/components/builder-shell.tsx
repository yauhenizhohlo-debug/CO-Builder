"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { OPEN_PROPOSAL_PREVIEW_EVENT } from "../lib/proposal-ui-events";
import { Badge, Button } from "../ui/product-core";
import { useProposalContext } from "./proposal-context";
import { ProposalPreview } from "./proposal-preview";
import { useSelectedRoom } from "./selected-room-context";
import { useProductTheme } from "../ui/theme-provider";
import type { ProductTheme } from "../ui/theme-provider";

type BuilderStep = 1 | 2 | 3 | 4;

type BuilderStepContextValue = {
  activeStep: BuilderStep;
  goToStep: (step: BuilderStep) => void;
  proposalOpenRequest: number;
  requestProposal: () => void;
};

const BuilderStepContext = createContext<BuilderStepContextValue | null>(null);

const navigation: ReadonlyArray<{ number: BuilderStep; label: string }> = [
  { number: 1, label: "Выбор номера" },
  { number: 2, label: "Условия покупки" },
  { number: 3, label: "Расчёт" },
  { number: 4, label: "Коммерческое предложение" },
];

const stepSelectors: Record<BuilderStep, string> = {
  1: ".room-selector",
  2: ".purchase-configuration, .mortgage-configuration",
  3: ".payment-calculation, .mortgage-calculation",
  4: ".builder-context-panel",
};

const currency = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

function formatCurrency(value: number) {
  return currency.format(value);
}

function formatDate(value?: string) {
  return value ? dateFormatter.format(new Date(`${value}T00:00:00Z`)) : "—";
}

function ThemeToggle() {
  const { theme, setTheme } = useProductTheme();
  const options: Array<[ProductTheme, string]> = [
    ["classic", "Classic"],
    ["enterprise-light", "Enterprise Light"],
  ];

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="theme-control">
      <span className="theme-control__label">Dev theme</span>
      <div className="theme-toggle" aria-label="Dev theme switcher" role="group">
        {options.map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant="ghost"
            aria-pressed={theme === value}
            onClick={() => setTheme(value)}
            className={theme === value ? "theme-toggle__button is-active" : "theme-toggle__button"}
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function EnterpriseStepNavigation() {
  const { activeStep, goToStep } = useBuilderStep();

  return (
    <nav className="builder-step-navigation" aria-label="Этапы подготовки предложения">
      <div className="builder-step-navigation__inner">
        {navigation.map(({ number, label }) => (
          <button
            key={number}
            type="button"
            aria-current={activeStep === number ? "step" : undefined}
            className={activeStep === number ? "builder-step-navigation__item is-active" : "builder-step-navigation__item"}
            onClick={() => goToStep(number)}
          >
            <span>{String(number).padStart(2, "0")}</span>
            <strong>{label}</strong>
          </button>
        ))}
      </div>
    </nav>
  );
}

function ContextRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="builder-context-panel__rows">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BuilderContextPanel() {
  const { theme } = useProductTheme();
  const { activeStep, goToStep, proposalOpenRequest } = useBuilderStep();
  const room = useSelectedRoom();
  const { proposalData } = useProposalContext();

  if (theme === "classic") return <ProposalPreview />;
  if (activeStep === 4) return <ProposalPreview key={proposalOpenRequest} initiallyOpen={proposalOpenRequest > 0} />;

  const installment = proposalData?.financingType === "installment" ? proposalData.installment : undefined;
  const mortgage = proposalData?.financingType === "mortgage" ? proposalData.mortgage : undefined;
  const financingLabel = mortgage ? "Траншевая ипотека" : installment ? "Рассрочка" : "Не выбрана";
  const initialPayment = installment?.initialPayment ?? mortgage?.initialPayment;
  const initialPaymentPercent = installment?.initialPaymentPercent ?? mortgage?.initialPaymentPercent;
  const regularPayment = installment?.monthlyPayment ?? mortgage?.stages[0]?.monthlyPayment;
  const dealDate = proposalData?.financingType === "installment"
    ? proposalData.schedule[0]?.date
    : proposalData?.financingType === "mortgage"
      ? proposalData.mortgage.schedule[0]?.date
      : undefined;

  if (activeStep === 1) {
    return (
      <section className="builder-context-card" aria-labelledby="unit-context-title">
        <div className="builder-context-card__header">
          <p>Выбранный объект</p>
          <Badge tone="success">Доступен</Badge>
        </div>
        <h2 id="unit-context-title">№ {room.roomNumber.replace(/^№/, "")}</h2>
        <p className="builder-context-card__primary">{formatCurrency(room.price)}</p>
        <ContextRows rows={[
          ["Площадь", `${room.area.toLocaleString("ru-RU")} м²`],
          ["Этаж", String(room.floor)],
          ["Цена за м²", formatCurrency(room.pricePerSqm)],
        ]} />
        <Button type="button" onClick={() => goToStep(2)} className="builder-context-card__action">
          Перейти к условиям
        </Button>
      </section>
    );
  }

  if (activeStep === 2) {
    const rows: Array<[string, string]> = [
      ["Схема оплаты", financingLabel],
      ["Первоначальный взнос", initialPayment !== undefined ? formatCurrency(initialPayment) : "—"],
      ["ПВ", initialPaymentPercent !== undefined ? `${initialPaymentPercent.toLocaleString("ru-RU")}%` : "—"],
      ["Дата сделки", formatDate(dealDate)],
    ];
    if (installment) rows.push(["Скидка", `${installment.discountPercent.toLocaleString("ru-RU")}%`]);
    if (regularPayment !== undefined) rows.push([mortgage ? "Платёж первого этапа" : "Регулярный платёж", formatCurrency(Math.floor(regularPayment))]);

    return (
      <section className="builder-context-card" aria-labelledby="conditions-context-title">
        <div className="builder-context-card__header"><p>Текущие условия</p></div>
        <h2 id="conditions-context-title">{financingLabel}</h2>
        <ContextRows rows={rows} />
        <Button type="button" onClick={() => goToStep(3)} className="builder-context-card__action">
          Перейти к расчёту
        </Button>
      </section>
    );
  }

  const calculationRows: Array<[string, string]> = [
    ["Схема оплаты", financingLabel],
    ["Первоначальный взнос", initialPayment !== undefined ? formatCurrency(initialPayment) : "—"],
    [mortgage ? "Платёж первого этапа" : "Регулярный платёж", regularPayment !== undefined ? formatCurrency(Math.floor(regularPayment)) : "—"],
  ];
  if (installment) {
    calculationRows.push(["Довнос до 50%", formatCurrency(installment.topUpPayment)]);
    calculationRows.push(["Финальный платёж", formatCurrency(installment.finalPayment)]);
  }
  if (mortgage) calculationRows.push(["Остаток кредита", formatCurrency(mortgage.remainingBalance)]);

  return (
    <section className="builder-context-card" aria-labelledby="calculation-context-title">
      <div className="builder-context-card__header"><p>Сводка расчёта</p></div>
      <h2 id="calculation-context-title">Финансовая траектория</h2>
      <ContextRows rows={calculationRows} />
      <Button type="button" onClick={() => goToStep(4)} className="builder-context-card__action">
        Перейти к КП
      </Button>
    </section>
  );
}

function useBuilderStep() {
  const context = useContext(BuilderStepContext);
  if (!context) throw new Error("useBuilderStep must be used inside BuilderShell");
  return context;
}

export function BuilderShell({ children }: { children: ReactNode }) {
  const { theme } = useProductTheme();
  const room = useSelectedRoom();
  const { proposalData } = useProposalContext();
  const [activeStep, setActiveStep] = useState<BuilderStep>(1);
  const [proposalOpenRequest, setProposalOpenRequest] = useState(0);
  const canGenerate = Boolean(
    proposalData
    && (proposalData.financingType !== "mortgage" || proposalData.mortgage.isBalanced),
  );
  const financingLabel = proposalData?.financingType === "mortgage"
    ? "Траншевая ипотека"
    : proposalData?.financingType === "installment"
      ? "Рассрочка"
      : "Условия не выбраны";

  const stepContext = useMemo<BuilderStepContextValue>(() => ({
    activeStep,
    goToStep: (step) => {
      if (step !== 4) {
        document.querySelector(stepSelectors[step])?.scrollIntoView({ behavior: "auto", block: "start" });
      }
      setActiveStep(step);
    },
    proposalOpenRequest,
    requestProposal: () => {
      if (theme === "classic") {
        window.dispatchEvent(new Event(OPEN_PROPOSAL_PREVIEW_EVENT));
        return;
      }
      setActiveStep(4);
      setProposalOpenRequest((request) => request + 1);
    },
  }), [activeStep, proposalOpenRequest, theme]);

  useEffect(() => {
    if (activeStep === 4) return;
    const targets = ([1, 2, 3] as const)
      .flatMap((step) => Array.from(document.querySelectorAll(stepSelectors[step])).map((element) => ({ element, step })));
    if (targets.length === 0) return;

    const targetMap = new Map(targets.map(({ element, step }) => [element, step]));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => Math.abs(left.boundingClientRect.top - 150) - Math.abs(right.boundingClientRect.top - 150));
      const step = visible[0] ? targetMap.get(visible[0].target) : undefined;
      if (step) setActiveStep(step);
    }, { rootMargin: "-120px 0px -62% 0px", threshold: 0.01 });

    targets.forEach(({ element }) => observer.observe(element));
    return () => observer.disconnect();
  }, [activeStep, proposalData?.financingType]);

  return (
    <BuilderStepContext.Provider value={stepContext}>
      <div className="builder-shell" data-active-step={activeStep}>
        <aside className="builder-sidebar" aria-label="Навигация Builder">
          <div className="builder-brand">
            <span className="builder-brand__mark" aria-hidden="true">C</span>
            <div>
              <p className="builder-brand__name">COSMOS</p>
              <p className="builder-brand__project">Black Sea</p>
            </div>
          </div>

          <nav className="builder-navigation" aria-label="Этапы подготовки предложения">
            {navigation.map(({ number, label }) => (
              <button key={number} type="button" className={activeStep === number ? "builder-navigation__item is-active" : "builder-navigation__item"} onClick={() => stepContext.goToStep(number)}>
                <span>{String(number).padStart(2, "0")}</span>
                <strong>{label}</strong>
              </button>
            ))}
          </nav>

          <div className="builder-sidebar__footer">
            <Badge tone="neutral">Internal</Badge>
            <p>Коммерческие предложения</p>
          </div>
        </aside>

        <div className="builder-main">
          <header className="builder-topbar">
            <div className="builder-topbar__brand">
              <p className="builder-topbar__kicker">Коммерческие предложения</p>
              <p className="builder-topbar__title">KP Builder</p>
            </div>
            <div className="builder-topbar__actions">
              <div className="builder-topbar__context">
                <Badge tone="neutral">№ {room.roomNumber.replace(/^№/, "")} · {room.floor} этаж</Badge>
                <Badge tone="accent">{financingLabel}</Badge>
              </div>
              <ThemeToggle />
              <Button
                type="button"
                disabled={!canGenerate}
                onClick={stepContext.requestProposal}
                className="builder-topbar__proposal-action"
              >
                Сформировать КП
              </Button>
            </div>
          </header>

          <EnterpriseStepNavigation />
          <div id="builder-workspace" className="builder-workspace">
            {children}
          </div>
        </div>
      </div>
    </BuilderStepContext.Provider>
  );
}
