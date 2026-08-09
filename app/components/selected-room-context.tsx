"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { rooms, type Room } from "../data/rooms";

const SelectedRoomContext = createContext<Room>(rooms[0]);

export function SelectedRoomProvider({ children }: { children: ReactNode }) {
  const [selectedRoom, setSelectedRoom] = useState(rooms[0]);

  useEffect(() => {
    const handleRoomSelection = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const roomCard = target.closest<HTMLButtonElement>("button[aria-pressed]");
      if (!roomCard) return;

      const visibleNumber = roomCard.querySelector(".font-serif")?.textContent?.trim();
      const room = rooms.find(
        (item) => item.roomNumber.replace(/^№/, "") === visibleNumber,
      );
      if (room) setSelectedRoom(room);
    };

    document.addEventListener("click", handleRoomSelection);
    return () => document.removeEventListener("click", handleRoomSelection);
  }, []);

  return (
    <SelectedRoomContext.Provider value={selectedRoom}>
      {children}
    </SelectedRoomContext.Provider>
  );
}

export function useSelectedRoom() {
  return useContext(SelectedRoomContext);
}
