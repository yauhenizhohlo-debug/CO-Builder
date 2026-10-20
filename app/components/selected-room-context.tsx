"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { rooms as fallbackRooms, type Room } from "../data/rooms";

type SelectedRoomContextValue = {
  rooms: Room[];
  selectedRoom: Room;
  selectRoom: (roomNumber: string) => void;
  updateRoom: (room: Room) => void;
};

const SelectedRoomContext = createContext<SelectedRoomContextValue | null>(null);

export function SelectedRoomProvider({ children, initialRooms = fallbackRooms }: { children: ReactNode; initialRooms?: Room[] }) {
  const [catalog, setCatalog] = useState(initialRooms);
  const [selectedRoomNumber, setSelectedRoomNumber] = useState(initialRooms[0]?.roomNumber ?? fallbackRooms[0].roomNumber);
  const selectedRoom = catalog.find((room) => room.roomNumber === selectedRoomNumber) ?? catalog[0] ?? fallbackRooms[0];

  const updateRoom = (room: Room) => {
    setCatalog((current) => current.map((item) => item.roomNumber === room.roomNumber ? room : item));
    setSelectedRoomNumber(room.roomNumber);
  };

  return (
    <SelectedRoomContext.Provider value={{ rooms: catalog, selectedRoom, selectRoom: setSelectedRoomNumber, updateRoom }}>
      {children}
    </SelectedRoomContext.Provider>
  );
}

export function useSelectedRoom() {
  const context = useContext(SelectedRoomContext);
  if (!context) throw new Error("useSelectedRoom must be used inside SelectedRoomProvider");
  return context.selectedRoom;
}

export function useRoomCatalog() {
  const context = useContext(SelectedRoomContext);
  if (!context) throw new Error("useRoomCatalog must be used inside SelectedRoomProvider");
  return context;
}
