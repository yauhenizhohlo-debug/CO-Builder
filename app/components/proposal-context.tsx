"use client";

import { createContext, useContext, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { Room } from "../data/rooms";
import type { PaymentScheduleItem } from "../lib/build-payment-schedule";
import type { InstallmentResult } from "../lib/calculate-installment";
import type { TrancheMortgageResult } from "../lib/calculate-tranche-mortgage";
import type { ScheduleBalanceMode } from "../lib/custom-payment-schedule";
import type { SpecialistContacts, SpecialistContactsMode } from "../lib/specialist-contacts";

export type InstallmentProposalData = {
  room: Room;
  financingType: "installment";
  installment: InstallmentResult;
  schedule: PaymentScheduleItem[];
  scheduleMode?: "standard" | "custom";
  scheduleBalanceMode?: ScheduleBalanceMode;
  scheduleBalancerId?: string | null;
  scheduleValidationErrors?: string[];
  specialistContacts?: SpecialistContacts;
  specialistContactsMode?: SpecialistContactsMode;
};

export type MortgageProposalData = {
  room: Room;
  financingType: "mortgage";
  mortgage: TrancheMortgageResult;
  specialistContacts?: SpecialistContacts;
  specialistContactsMode?: SpecialistContactsMode;
};

export type ProposalData = InstallmentProposalData | MortgageProposalData;

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
