"use client";

import type { ReactNode } from "react";
import { OPEN_PROPOSAL_PREVIEW_EVENT } from "../lib/proposal-ui-events";
import { Badge, Button } from "../ui/product-core";
import { useProposalContext } from "./proposal-context";
import { useSelectedRoom } from "./selected-room-context";
import { useProductTheme } from "../ui/theme-provider";
import type { ProductTheme } from "../ui/theme-provider";

const navigation = [
  ["01", "Выбор номера"],
  ["02", "Условия покупки"],
  ["03", "Расчёт"],
  ["04", "Предложение"],
] as const;

function ThemeToggle() {
  const { theme, setTheme } = useProductTheme();
  const options: Array<[ProductTheme, string]> = [
    ["classic", "Classic"],
    ["enterprise-light", "Enterprise Light"],
  ];

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

export function BuilderShell({ children }: { children: ReactNode }) {
  const room = useSelectedRoom();
  const { proposalData } = useProposalContext();
  const canGenerate = Boolean(
    proposalData
    && (proposalData.financingType !== "mortgage" || proposalData.mortgage.isBalanced),
  );
  const financingLabel = proposalData?.financingType === "mortgage"
    ? "Траншевая ипотека"
    : proposalData?.financingType === "installment"
      ? "Рассрочка"
      : "Условия не выбраны";

  return (
    <div className="builder-shell">
      <aside className="builder-sidebar" aria-label="Навигация Builder">
        <div className="builder-brand">
          <span className="builder-brand__mark" aria-hidden="true">C</span>
          <div>
            <p className="builder-brand__name">COSMOS</p>
            <p className="builder-brand__project">Black Sea</p>
          </div>
        </div>

        <nav className="builder-navigation" aria-label="Этапы подготовки предложения">
          {navigation.map(([number, label], index) => (
            <a key={number} className={index === 0 ? "builder-navigation__item is-active" : "builder-navigation__item"} href={index === 0 ? "#room-heading" : "#builder-workspace"}>
              <span>{number}</span>
              <strong>{label}</strong>
            </a>
          ))}
        </nav>

        <div className="builder-sidebar__footer">
          <Badge tone="neutral">Internal</Badge>
          <p>Коммерческие предложения</p>
        </div>
      </aside>

      <div className="builder-main">
        <header className="builder-topbar">
          <div>
            <p className="builder-topbar__kicker">Коммерческие предложения</p>
            <p className="builder-topbar__title">Cosmos KP Builder</p>
          </div>
          <div className="builder-topbar__actions">
            <div className="builder-topbar__context">
              <Badge tone="neutral">№ {room.roomNumber.replace(/^№/, "")} · {room.floor} этаж</Badge>
              <Badge tone="accent">{financingLabel}</Badge>
            </div>
            <Button
              type="button"
              disabled={!canGenerate}
              onClick={() => window.dispatchEvent(new Event(OPEN_PROPOSAL_PREVIEW_EVENT))}
              className="builder-topbar__proposal-action"
            >
              Сформировать КП
            </Button>
            <ThemeToggle />
          </div>
        </header>

        <div id="builder-workspace" className="builder-workspace">
          {children}
        </div>
      </div>
    </div>
  );
}
