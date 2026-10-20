export type ProjectRenderCategory = "exterior" | "territory" | "amenity";

export type ProjectRender = {
  id: string;
  title: string;
  category: ProjectRenderCategory;
  imagePath: string;
};

export const projectRenders: ProjectRender[] = [
  { id: "exterior-beach", title: "Отель и пляж", category: "exterior", imagePath: "/project-renders/exterior-beach.jpg" },
  { id: "exterior-entrance", title: "Главный вход", category: "exterior", imagePath: "/project-renders/exterior-entrance.jpg" },
  { id: "exterior-arrival", title: "Въезд на территорию", category: "exterior", imagePath: "/project-renders/exterior-arrival.jpg" },
  { id: "exterior-aerial", title: "Панорама комплекса", category: "exterior", imagePath: "/project-renders/exterior-aerial.jpg" },
  { id: "territory-pool", title: "Бассейн", category: "territory", imagePath: "/project-renders/territory-pool.jpg" },
  { id: "territory-beach-bar", title: "Пляжный бар", category: "territory", imagePath: "/project-renders/territory-beach-bar.jpg" },
  { id: "territory-beach", title: "Частный пляж", category: "territory", imagePath: "/project-renders/territory-beach.jpg" },
  { id: "territory-sea-view", title: "Вид на море", category: "territory", imagePath: "/project-renders/territory-sea-view.jpg" },
  { id: "amenity-restaurant", title: "Ресторан", category: "amenity", imagePath: "/project-renders/amenity-restaurant.jpg" },
  { id: "amenity-spa", title: "SPA", category: "amenity", imagePath: "/project-renders/amenity-spa.jpg" },
  { id: "amenity-reception", title: "Лобби", category: "amenity", imagePath: "/project-renders/amenity-reception.jpg" },
  { id: "amenity-fitness", title: "Фитнес", category: "amenity", imagePath: "/project-renders/amenity-fitness.jpg" },
];

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Selects one compositionally different image from each category. */
export function selectProjectRenders(seed: string, catalog = projectRenders) {
  const categories: ProjectRenderCategory[] = ["exterior", "territory", "amenity"];
  const seedHash = hashSeed(seed);
  return categories.flatMap((category, index) => {
    const matches = catalog.filter((item) => item.category === category);
    if (matches.length === 0) return [];
    return [matches[(seedHash + index * 2654435761) % matches.length]];
  });
}
