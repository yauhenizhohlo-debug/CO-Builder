import { getLayoutIdForRoom } from "./layouts.ts";
import { getRenderSetIdForRoom } from "./render-sets.ts";

export type Room = {
  roomNumber: string;
  floor: number;
  area: number;
  pricePerSqm: number;
  price: number;
  layoutId: string;
  renderSetId: string;
};

const inventory: Array<Omit<Room, "layoutId" | "renderSetId">> = [
  { roomNumber: "704", floor: 7, area: 38, pricePerSqm: 665000, price: 25270000 },
  { roomNumber: "716п", floor: 7, area: 33.6, pricePerSqm: 550000, price: 18480000 },
  { roomNumber: "719", floor: 7, area: 33.6, pricePerSqm: 617000, price: 20731200 },
  { roomNumber: "722", floor: 7, area: 38, pricePerSqm: 605000, price: 22990000 },

  { roomNumber: "601", floor: 6, area: 33.6, pricePerSqm: 705000, price: 23688000 },
  { roomNumber: "604", floor: 6, area: 38, pricePerSqm: 660000, price: 25080000 },
  { roomNumber: "607", floor: 6, area: 38, pricePerSqm: 660000, price: 25080000 },
  { roomNumber: "609", floor: 6, area: 70.3, pricePerSqm: 618000, price: 43445400 },
  { roomNumber: "610", floor: 6, area: 30.9, pricePerSqm: 623000, price: 19250700 },
  { roomNumber: "613", floor: 6, area: 37.6, pricePerSqm: 590000, price: 22184000 },
  { roomNumber: "621", floor: 6, area: 38, pricePerSqm: 599000, price: 22762000 },
  { roomNumber: "624", floor: 6, area: 38.2, pricePerSqm: 599000, price: 22881800 },
  { roomNumber: "626п", floor: 6, area: 30.9, pricePerSqm: 560000, price: 17304000 },
  { roomNumber: "629", floor: 6, area: 38, pricePerSqm: 615000, price: 23370000 },
  { roomNumber: "635", floor: 6, area: 38, pricePerSqm: 615000, price: 23370000 },
  { roomNumber: "636п", floor: 6, area: 25.9, pricePerSqm: 625000, price: 16187500 },

  { roomNumber: "510", floor: 5, area: 30.9, pricePerSqm: 616000, price: 19034400 },
  { roomNumber: "516", floor: 5, area: 33.6, pricePerSqm: 607000, price: 20395200 },
  { roomNumber: "520", floor: 5, area: 40, pricePerSqm: 603000, price: 24120000 },
  { roomNumber: "531", floor: 5, area: 38, pricePerSqm: 610000, price: 23180000 },
  { roomNumber: "537п", floor: 5, area: 25.9, pricePerSqm: 620000, price: 16028000 },
  { roomNumber: "538", floor: 5, area: 33.6, pricePerSqm: 662000, price: 22243200 },

  { roomNumber: "401п", floor: 4, area: 33.6, pricePerSqm: 690000, price: 23184000 },
  { roomNumber: "416", floor: 4, area: 33.6, pricePerSqm: 602000, price: 20227200 },
  { roomNumber: "422", floor: 4, area: 38, pricePerSqm: 587000, price: 22306000 },
  { roomNumber: "425", floor: 4, area: 43.5, pricePerSqm: 581000, price: 25273500 },
  { roomNumber: "428", floor: 4, area: 37.9, pricePerSqm: 595000, price: 22550500 },
  { roomNumber: "437п", floor: 4, area: 25.9, pricePerSqm: 580000, price: 15022000 },

  { roomNumber: "301", floor: 3, area: 33.6, pricePerSqm: 690000, price: 23184000 },
  { roomNumber: "№304", floor: 3, area: 38, pricePerSqm: 645000, price: 24510000 },
  { roomNumber: "309", floor: 3, area: 70.3, pricePerSqm: 597000, price: 41969100 },
  { roomNumber: "324", floor: 3, area: 38.2, pricePerSqm: 581000, price: 22194200 },
  { roomNumber: "331", floor: 3, area: 38, pricePerSqm: 590000, price: 22420000 },
  { roomNumber: "335", floor: 3, area: 38, pricePerSqm: 590000, price: 22420000 },
  { roomNumber: "338", floor: 3, area: 33.6, pricePerSqm: 652000, price: 21907200 },

  { roomNumber: "207", floor: 2, area: 38, pricePerSqm: 640000, price: 24320000 },
  { roomNumber: "213п", floor: 2, area: 45.4, pricePerSqm: 590000, price: 26786000 },
  { roomNumber: "216", floor: 2, area: 38.6, pricePerSqm: 585000, price: 22581000 },
  { roomNumber: "219", floor: 2, area: 38.6, pricePerSqm: 585000, price: 22581000 },
  { roomNumber: "220", floor: 2, area: 40, pricePerSqm: 585000, price: 23400000 },
  { roomNumber: "224", floor: 2, area: 38.2, pricePerSqm: 575000, price: 21965000 },
];

export const rooms: Room[] = inventory.map((room) => ({
  ...room,
  layoutId: getLayoutIdForRoom(room.roomNumber),
  renderSetId: getRenderSetIdForRoom(room.roomNumber),
}));
