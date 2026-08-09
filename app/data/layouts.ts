export type Layout = {
  id: string;
  imagePath: string;
  roomNumbers: string[];
};

export const layouts: Layout[] = [
  { id: "page-12", imagePath: "/layouts/page-12.webp", roomNumbers: ["301", "401п", "601"] },
  { id: "page-13", imagePath: "/layouts/page-13.webp", roomNumbers: ["636п"] },
  { id: "page-16", imagePath: "/layouts/page-16.webp", roomNumbers: ["207", "607", "621", "635", "335"] },
  { id: "page-17", imagePath: "/layouts/page-17.webp", roomNumbers: ["224", "324", "422", "428", "624", "722"] },
  { id: "page-18", imagePath: "/layouts/page-18.webp", roomNumbers: ["304", "404", "504", "604", "704"] },
  { id: "page-19", imagePath: "/layouts/page-19.webp", roomNumbers: ["309", "609"] },
  { id: "page-20", imagePath: "/layouts/page-20.webp", roomNumbers: ["510", "610"] },
  { id: "page-23", imagePath: "/layouts/page-23.webp", roomNumbers: ["213п"] },
  { id: "page-24", imagePath: "/layouts/page-24.webp", roomNumbers: ["613"] },
  { id: "page-27", imagePath: "/layouts/page-27.webp", roomNumbers: ["216"] },
  { id: "page-28", imagePath: "/layouts/page-28.webp", roomNumbers: ["416", "516", "716п"] },
  { id: "page-33", imagePath: "/layouts/page-33.webp", roomNumbers: ["219"] },
  { id: "page-34", imagePath: "/layouts/page-34.webp", roomNumbers: ["719"] },
  { id: "page-35", imagePath: "/layouts/page-35.webp", roomNumbers: ["220", "520"] },
  { id: "page-36", imagePath: "/layouts/page-36.webp", roomNumbers: ["425"] },
  { id: "page-37", imagePath: "/layouts/page-37.webp", roomNumbers: ["426", "526", "626п"] },
  { id: "page-39", imagePath: "/layouts/page-39.webp", roomNumbers: ["331", "531", "629"] },
  { id: "page-40", imagePath: "/layouts/page-40.webp", roomNumbers: ["437п", "537п"] },
  { id: "page-41", imagePath: "/layouts/page-41.webp", roomNumbers: ["238", "338", "538", "738"] },
];

const normalizeRoomNumber = (roomNumber: string) => roomNumber.replace(/^№/, "");

export function getLayoutById(layoutId: string) {
  return layouts.find((layout) => layout.id === layoutId);
}

export function getLayoutIdForRoom(roomNumber: string) {
  const normalizedRoomNumber = normalizeRoomNumber(roomNumber);
  const layout = layouts.find((item) => item.roomNumbers.includes(normalizedRoomNumber));

  if (!layout) {
    throw new Error(`Layout is not assigned for room ${roomNumber}`);
  }

  return layout.id;
}
