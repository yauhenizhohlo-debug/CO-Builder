"use client";

import { createContext, useContext, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { Room } from "../data/rooms";
import type { PaymentScheduleItem } from "../lib/build-payment-schedule";
import type { InstallmentResult } from "../lib/calculate-installment";

export type ProposalData = {
  room: Room;
  installment: InstallmentResult;
  schedule: PaymentScheduleItem[];
};

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
