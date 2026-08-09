import { getLayoutIdForRoom } from "./layouts";
import { getRenderSetIdForRoom } from "./render-sets";

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
  { roomNumber: "704", floor: 7, area: 38, pricePerSqm: 605000, price: 22990000 },
  { roomNumber: "716п", floor: 7, area: 33.6, pricePerSqm: 550000, price: 18480000 },
  { roomNumber: "719", floor: 7, area: 33.6, pricePerSqm: 557000, price: 18715200 },
  { roomNumber: "722", floor: 7, area: 38, pricePerSqm: 545000, price: 20710000 },
  { roomNumber: "738", floor: 7, area: 33.6, pricePerSqm: 622000, price: 20899200 },
  { roomNumber: "601", floor: 6, area: 33.6, pricePerSqm: 620000, price: 20832000 },
  { roomNumber: "604", floor: 6, area: 38, pricePerSqm: 600000, price: 22800000 },
  { roomNumber: "607", floor: 6, area: 38, pricePerSqm: 600000, price: 22800000 },
  { roomNumber: "609", floor: 6, area: 70.3, pricePerSqm: 558000, price: 39227400 },
  { roomNumber: "610", floor: 6, area: 30.9, pricePerSqm: 563000, price: 17396700 },
  { roomNumber: "613", floor: 6, area: 37.6, pricePerSqm: 530000, price: 19928000 },
  { roomNumber: "621", floor: 6, area: 38, pricePerSqm: 539000, price: 20482000 },
  { roomNumber: "624", floor: 6, area: 38.2, pricePerSqm: 539000, price: 20589800 },
  { roomNumber: "626п", floor: 6, area: 30.9, pricePerSqm: 560000, price: 17304000 },
  { roomNumber: "629", floor: 6, area: 38, pricePerSqm: 555000, price: 21090000 },
  { roomNumber: "635", floor: 6, area: 38, pricePerSqm: 555000, price: 21090000 },
  { roomNumber: "636п", floor: 6, area: 25.9, pricePerSqm: 625000, price: 16187500 },
  { roomNumber: "504", floor: 5, area: 38, pricePerSqm: 595000, price: 22610000 },
  { roomNumber: "510", floor: 5, area: 30.9, pricePerSqm: 556000, price: 17180400 },
  { roomNumber: "516", floor: 5, area: 33.6, pricePerSqm: 547000, price: 18379200 },
  { roomNumber: "520", floor: 5, area: 40, pricePerSqm: 543000, price: 21720000 },
  { roomNumber: "526", floor: 5, area: 30.9, pricePerSqm: 552000, price: 17056800 },
  { roomNumber: "531", floor: 5, area: 38, pricePerSqm: 550000, price: 20900000 },
  { roomNumber: "537п", floor: 5, area: 25.9, pricePerSqm: 620000, price: 16028000 },
  { roomNumber: "538", floor: 5, area: 33.6, pricePerSqm: 602000, price: 20227200 },
  { roomNumber: "401п", floor: 4, area: 33.6, pricePerSqm: 640000, price: 21504000 },
  { roomNumber: "404", floor: 4, area: 38, pricePerSqm: 590000, price: 22420000 },
  { roomNumber: "416", floor: 4, area: 33.6, pricePerSqm: 542000, price: 18211200 },
  { roomNumber: "422", floor: 4, area: 38, pricePerSqm: 527000, price: 20026000 },
  { roomNumber: "425", floor: 4, area: 43.5, pricePerSqm: 521000, price: 22663500 },
  { roomNumber: "426", floor: 4, area: 30.9, pricePerSqm: 547000, price: 16902300 },
  { roomNumber: "428", floor: 4, area: 37.9, pricePerSqm: 535000, price: 20276500 },
  { roomNumber: "437п", floor: 4, area: 25.9, pricePerSqm: 580000, price: 15022000 },
  { roomNumber: "301", floor: 3, area: 33.6, pricePerSqm: 599000, price: 20126400 },
  { roomNumber: "№304", floor: 3, area: 38, pricePerSqm: 575000, price: 21850000 },
  { roomNumber: "309", floor: 3, area: 70.3, pricePerSqm: 537000, price: 37751100 },
  { roomNumber: "324", floor: 3, area: 38.2, pricePerSqm: 521000, price: 19902200 },
  { roomNumber: "331", floor: 3, area: 38, pricePerSqm: 530000, price: 20140000 },
  { roomNumber: "335", floor: 3, area: 38, pricePerSqm: 530000, price: 20140000 },
  { roomNumber: "338", floor: 3, area: 33.6, pricePerSqm: 592000, price: 19891200 },
  { roomNumber: "207", floor: 2, area: 38, pricePerSqm: 580000, price: 22040000 },
  { roomNumber: "213п", floor: 2, area: 45.4, pricePerSqm: 515000, price: 23381000 },
  { roomNumber: "216", floor: 2, area: 38.6, pricePerSqm: 525000, price: 20265000 },
  { roomNumber: "219", floor: 2, area: 38.6, pricePerSqm: 525000, price: 20265000 },
  { roomNumber: "220", floor: 2, area: 40, pricePerSqm: 525000, price: 21000000 },
  { roomNumber: "224", floor: 2, area: 38.2, pricePerSqm: 515000, price: 19673000 },
  { roomNumber: "238", floor: 2, area: 33.6, pricePerSqm: 537000, price: 18043200 },
];

export const rooms: Room[] = inventory.map((room) => ({
  ...room,
  layoutId: getLayoutIdForRoom(room.roomNumber),
  renderSetId: getRenderSetIdForRoom(room.roomNumber),
}));
