"use client";

import { createContext, useContext, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { Room } from "../data/rooms";
import type { PaymentScheduleItem } from "../lib/build-payment-schedule";
import type { InstallmentResult } from "../lib/calculate-installment";
import type { TrancheMortgageResult } from "../lib/calculate-tranche-mortgage";
import type { RefinanceCalculation } from "../lib/refinance-types";

export type InstallmentProposalData = {
  room: Room;
  financingType: "installment";
  installment: InstallmentResult;
  schedule: PaymentScheduleItem[];
};

export type MortgageProposalData = {
  room: Room;
  financingType: "mortgage";
  mortgage: TrancheMortgageResult;
  refinance?: RefinanceCalculation;
  mortgageKind?:"tranche"|"standard";
  standardMonthlyPayment?:number;
};

export type InvestmentProjection={scenarioLabel?:string;entryPrice?:number;firstYearIncome?:number;firstYearYield?:number;capitalGain?:number;totalRoi?:number;horizonYears?:number;financing?:Record<string,unknown>|null};
export type UnitProposalData={room:Room;financingType:"none"};
export type ProposalData = (InstallmentProposalData | MortgageProposalData | UnitProposalData)&{investment?:InvestmentProjection|null};

type ProposalContextValue = {
  proposalData: ProposalData | null;
  setProposalData: Dispatch<SetStateAction<ProposalData | null>>;
};

const ProposalContext = createContext<ProposalContextValue | null>(null);

export function ProposalProvider({ children }: { children: ReactNode }) {
  const [proposalData, setProposalData] = useState<ProposalData | null>(null);

  return (
    <ProposalContext.Provider value={{ proposalData, setProposalData }}>
      {children}
    </ProposalContext.Provider>
  );
}

export function useProposalContext() {
  const context = useContext(ProposalContext);
  if (!context) throw new Error("useProposalContext must be used inside ProposalProvider");
  return context;
}
