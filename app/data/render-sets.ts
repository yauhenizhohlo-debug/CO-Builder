export type RenderSet = {
  id: string;
  title: string;
  imagePaths: string[];
};

const imagePaths = (id: string, count: number) => Array.from(
  { length: count },
  (_, index) => `/renders/${id}/${String(index + 1).padStart(2, "0")}.jpg`,
);

export const renderSets: RenderSet[] = [
  { id: "room-25-9", title: "Номер 25,9 м²", imagePaths: imagePaths("room-25-9", 3) },
  { id: "room-27-3", title: "Номер 27,3 м²", imagePaths: imagePaths("room-27-3", 5) },
  { id: "room-30-9", title: "Номер 30,9 м²", imagePaths: imagePaths("room-30-9", 6) },
  { id: "room-33-6", title: "Номер 33,6 м²", imagePaths: imagePaths("room-33-6", 5) },
  { id: "room-37-9", title: "Номер 37,9 м²", imagePaths: imagePaths("room-37-9", 5) },
  { id: "room-38", title: "Номер 38 м²", imagePaths: imagePaths("room-38", 6) },
  { id: "room-43-5", title: "Номер 43,5 м²", imagePaths: imagePaths("room-43-5", 7) },
  { id: "room-70-3", title: "Номер 70,3 м²", imagePaths: imagePaths("room-70-3", 14) },
];

const roomNumbersByRenderSet: Record<string, string[]> = {
  "room-25-9": ["636п", "537п", "437п"],
  "room-30-9": ["610", "626п", "510", "526", "426"],
  "room-33-6": ["716п", "719", "738", "601", "516", "538", "401п", "416", "301", "338", "238"],
  "room-37-9": ["613", "428"],
  "room-38": ["704", "722", "604", "607", "621", "624", "629", "635", "504", "520", "531", "404", "422", "304", "324", "331", "335", "207", "216", "219", "220", "224"],
  "room-43-5": ["425", "213п"],
  "room-70-3": ["609", "309"],
};

const normalizeRoomNumber = (roomNumber: string) => roomNumber.replace(/^№/, "");

export function getRenderSetById(renderSetId: string) {
  return renderSets.find((renderSet) => renderSet.id === renderSetId);
}

export function getRenderSetIdForRoom(roomNumber: string) {
  const normalizedRoomNumber = normalizeRoomNumber(roomNumber);
  const entry = Object.entries(roomNumbersByRenderSet).find(([, roomNumbers]) =>
    roomNumbers.includes(normalizedRoomNumber),
  );

  if (!entry) {
    throw new Error(`Render set is not assigned for room ${roomNumber}`);
  }

  return entry[0];
}
