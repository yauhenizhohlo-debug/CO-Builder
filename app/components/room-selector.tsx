"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { getLayoutById } from "../data/layouts";
import { getRenderSetById } from "../data/render-sets";
import { rooms } from "../data/rooms";

const currency = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const formatCurrency = (value: number) => currency.format(value);
const floors = [...new Set(rooms.map((room) => room.floor))].sort((a, b) => a - b);

export function RoomSelector() {
  const [selectedFloor, setSelectedFloor] = useState(7);
  const availableRooms = useMemo(
    () => rooms.filter((room) => room.floor === selectedFloor),
    [selectedFloor],
  );
  const [selectedRoomNumber, setSelectedRoomNumber] = useState("704");
  const selectedRoom =
    availableRooms.find((room) => room.roomNumber === selectedRoomNumber) ?? availableRooms[0];
  const selectedLayout = getLayoutById(selectedRoom.layoutId);
  const selectedRenderSet = getRenderSetById(selectedRoom.renderSetId);
  const [failedLayoutId, setFailedLayoutId] = useState<string | null>(null);
  const [isLayoutOpen, setIsLayoutOpen] = useState(false);
  const [activeRenderIndex, setActiveRenderIndex] = useState(0);
  const [failedRenderPaths, setFailedRenderPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const [enlargedRenderPath, setEnlargedRenderPath] = useState<string | null>(null);
  const activeRenderPath = selectedRenderSet?.imagePaths[activeRenderIndex];

  useEffect(() => {
    setActiveRenderIndex(0);
    setEnlargedRenderPath(null);
  }, [selectedRoom.renderSetId]);

  useEffect(() => {
    if (!isLayoutOpen && !enlargedRenderPath) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsLayoutOpen(false);
        setEnlargedRenderPath(null);
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isLayoutOpen, enlargedRenderPath]);

  const markRenderAsFailed = (path: string) => {
    setFailedRenderPaths((current) => new Set(current).add(path));
  };

  const selectFloor = (floor: number) => {
    const firstRoom = rooms.find((room) => room.floor === floor);
    setSelectedFloor(floor);
    if (firstRoom) setSelectedRoomNumber(firstRoom.roomNumber);
  };

  return (
    <section className="panel min-w-0 overflow-hidden xl:col-span-2" aria-labelledby="room-heading">
      <div className="border-b border-white/10 p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">01 · Выбор номера</p>
            <h2 id="room-heading" className="mt-3 font-serif text-3xl">Доступные номера</h2>
          </div>
          <p className="text-xs text-stone-500">Выберите этаж, затем подходящий номер</p>
        </div>

        <div className="mt-7 grid grid-cols-3 gap-2 rounded-xl border border-white/10 bg-stone-950/35 p-1.5 sm:grid-cols-6" role="tablist" aria-label="Этажи">
          {floors.map((floor) => (
            <button
              key={floor}
              id={`floor-tab-${floor}`}
              type="button"
              role="tab"
              aria-selected={selectedFloor === floor}
              aria-controls="room-cards"
              onClick={() => selectFloor(floor)}
              className={`min-h-11 rounded-lg px-2 py-3 text-xs uppercase tracking-[0.12em] transition sm:text-sm ${
                selectedFloor === floor
                  ? "bg-amber-100 text-stone-950 shadow-[0_8px_24px_rgba(231,211,173,0.12)]"
                  : "text-stone-500 hover:bg-white/5 hover:text-stone-200"
              }`}
            >
              <span className="hidden sm:inline">{floor} этаж</span>
              <span className="sm:hidden">{floor}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Номера на {selectedFloor} этаже</p>
          <p className="text-[10px] text-stone-600">{availableRooms.length} доступно</p>
        </div>

        <div
          id="room-cards"
          role="tabpanel"
          aria-labelledby={`floor-tab-${selectedFloor}`}
          className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {availableRooms.map((room) => {
            const active = selectedRoom.roomNumber === room.roomNumber;
            return (
              <button
                key={room.roomNumber}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedRoomNumber(room.roomNumber)}
                className={`group relative overflow-hidden rounded-xl border p-4 text-left transition ${
                  active
                    ? "border-amber-200/70 bg-amber-100/[0.09] shadow-[0_14px_34px_rgba(0,0,0,0.24)]"
                    : "border-white/10 bg-white/[0.025] hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.045]"
                }`}
              >
                {active && <span className="absolute inset-y-0 left-0 w-0.5 bg-amber-200" />}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Номер</p>
                    <p className={`mt-1 font-serif text-2xl ${active ? "text-amber-100" : "text-stone-100"}`}>
                      {room.roomNumber.replace(/^№/, "")}
                    </p>
                  </div>
                  <span className={`mt-1 size-2 rounded-full ${active ? "bg-amber-200" : "bg-stone-700 group-hover:bg-stone-500"}`} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-white/10 pt-3">
                  <div>
                    <p className="text-[10px] text-stone-600">Площадь</p>
                    <p className="mt-1 text-xs text-stone-300">{room.area.toLocaleString("ru-RU")} м²</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-600">Цена за м²</p>
                    <p className="mt-1 text-xs text-stone-300">{formatCurrency(room.pricePerSqm)}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm font-medium text-stone-100">{formatCurrency(room.price)}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-px bg-white/10 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="min-w-0 bg-stone-900 p-5 sm:p-7">
          <p className="eyebrow">Выбранный объект</p>
          <div className="mt-3 flex items-end justify-between gap-4">
            <h3 className="font-serif text-4xl text-amber-50">№ {selectedRoom.roomNumber.replace(/^№/, "")}</h3>
            <p className="pb-1 text-xs text-stone-500">{selectedRoom.floor} этаж</p>
          </div>

          <dl className="mt-6 divide-y divide-white/10 border-y border-white/10">
            {[
              ["Номер", selectedRoom.roomNumber],
              ["Этаж", `${selectedRoom.floor} этаж`],
              ["Площадь", `${selectedRoom.area.toLocaleString("ru-RU")} м²`],
              ["Цена за м²", formatCurrency(selectedRoom.pricePerSqm)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-5 py-3.5">
                <dt className="text-xs text-stone-500">{label}</dt>
                <dd className="text-right text-sm text-stone-200">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 rounded-xl bg-stone-800/70 p-5">
            <p className="text-xs text-stone-500">Полная стоимость</p>
            <p className="mt-2 font-serif text-3xl text-amber-50">{formatCurrency(selectedRoom.price)}</p>
          </div>
        </div>

        <div className="min-w-0 bg-stone-900 p-3" aria-label="Материалы выбранного номера">
          <div className="floorplan-placeholder relative min-h-[340px] overflow-hidden rounded-xl border border-white/10 sm:min-h-[400px]">
            <div className="absolute left-5 top-5 z-10 rounded-full bg-stone-950/70 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-stone-300 backdrop-blur">
              Планировка · № {selectedRoom.roomNumber.replace(/^№/, "")}
            </div>
            {selectedLayout && failedLayoutId !== selectedLayout.id ? (
              <button
                type="button"
                onClick={() => setIsLayoutOpen(true)}
                className="group absolute inset-0 w-full bg-white/95 p-8 pt-14 text-left sm:p-10 sm:pt-16"
                aria-label={`Открыть крупную планировку номера ${selectedRoom.roomNumber}`}
              >
                <span className="relative block size-full">
                  <Image
                    key={selectedLayout.id}
                    src={selectedLayout.imagePath}
                    alt={`Планировка ${selectedLayout.id} для номера ${selectedRoom.roomNumber}`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-contain transition duration-300 group-hover:scale-[1.015]"
                    onError={() => setFailedLayoutId(selectedLayout.id)}
                  />
                </span>
                <span className="absolute bottom-4 right-4 rounded-full bg-stone-950/75 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-stone-200 opacity-80 backdrop-blur transition group-hover:opacity-100">
                  Увеличить
                </span>
              </button>
            ) : (
              <div className="absolute left-1/2 top-1/2 w-3/5 max-w-sm -translate-x-1/2 -translate-y-1/2 border border-amber-100/35 bg-stone-900/65 p-5 text-center shadow-2xl">
                <p className="text-[10px] uppercase tracking-[0.2em] text-amber-100/50">
                  {selectedRoom.layoutId}
                </p>
                <p className="mt-4 font-serif text-xl text-stone-300">Планировка готовится</p>
                <p className="mt-2 text-xs leading-5 text-stone-600">Изображение будет добавлено в каталог проекта</p>
              </div>
            )}
            <p className="pointer-events-none absolute bottom-5 left-5 z-10 rounded-full bg-white/85 px-2.5 py-1 text-[10px] text-stone-600 backdrop-blur">
              {selectedRoom.layoutId} · {selectedRoom.area.toLocaleString("ru-RU")} м²
            </p>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-stone-950/40">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">Рендеры номера</p>
                <p className="mt-1 text-xs text-stone-300">{selectedRenderSet?.title ?? selectedRoom.renderSetId}</p>
              </div>
              <p className="text-[10px] text-stone-600">{selectedRenderSet?.imagePaths.length ?? 0} изображения</p>
            </div>

            <div className="p-3">
              <div className="relative min-h-56 overflow-hidden rounded-lg bg-stone-900 sm:min-h-72">
                {activeRenderPath && !failedRenderPaths.has(activeRenderPath) ? (
                  <button
                    type="button"
                    onClick={() => setEnlargedRenderPath(activeRenderPath)}
                    className="group absolute inset-0 size-full"
                    aria-label="Открыть выбранный рендер крупнее"
                  >
                    <Image
                      src={activeRenderPath}
                      alt={`${selectedRenderSet?.title ?? "Рендер номера"}, изображение ${activeRenderIndex + 1}`}
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="object-cover transition duration-500 group-hover:scale-[1.02]"
                      onError={() => markRenderAsFailed(activeRenderPath)}
                    />
                    <span className="absolute bottom-4 right-4 rounded-full bg-stone-950/75 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-white backdrop-blur">
                      Увеличить
                    </span>
                  </button>
                ) : (
                  <div className="absolute inset-0 grid place-items-center p-8 text-center">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-amber-100/50">{selectedRoom.renderSetId}</p>
                      <p className="mt-3 font-serif text-xl text-stone-300">Рендер готовится</p>
                      <p className="mt-2 text-xs text-stone-600">Изображение будет добавлено в каталог проекта</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 sm:flex sm:overflow-x-auto sm:pb-1" aria-label="Миниатюры рендеров">
                {selectedRenderSet?.imagePaths.map((path, index) => {
                  const active = index === activeRenderIndex;
                  const failed = failedRenderPaths.has(path);
                  return (
                    <button
                      key={path}
                      type="button"
                      onClick={() => setActiveRenderIndex(index)}
                      aria-pressed={active}
                      className={`relative h-20 min-w-0 w-full overflow-hidden rounded-lg border transition sm:h-24 sm:min-w-28 sm:flex-1 ${
                        active ? "border-amber-200/70" : "border-white/10 opacity-60 hover:opacity-100"
                      }`}
                    >
                      {!failed ? (
                        <Image
                          src={path}
                          alt={`Миниатюра ${index + 1}`}
                          fill
                          sizes="160px"
                          className="object-cover"
                          onError={() => markRenderAsFailed(path)}
                        />
                      ) : (
                        <span className="absolute inset-0 grid place-items-center bg-stone-900 text-[10px] text-stone-600">{index + 1}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isLayoutOpen && selectedLayout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/95 p-3 backdrop-blur-sm sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`Планировка номера ${selectedRoom.roomNumber}`}
          onClick={() => setIsLayoutOpen(false)}
        >
          <div className="relative h-full w-full max-w-6xl overflow-hidden rounded-2xl border border-white/15 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <Image
              src={selectedLayout.imagePath}
              alt={`Увеличенная планировка ${selectedLayout.id} для номера ${selectedRoom.roomNumber}`}
              fill
              priority
              sizes="100vw"
              className="object-contain p-3 sm:p-8"
            />
            <div className="absolute left-4 top-4 rounded-full bg-stone-950/80 px-4 py-2 text-xs text-stone-100 backdrop-blur sm:left-6 sm:top-6">
              № {selectedRoom.roomNumber.replace(/^№/, "")} · {selectedLayout.id}
            </div>
            <button
              type="button"
              onClick={() => setIsLayoutOpen(false)}
              className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-stone-950/80 text-xl text-white backdrop-blur transition hover:bg-stone-800 sm:right-6 sm:top-6"
              aria-label="Закрыть планировку"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {enlargedRenderPath && !failedRenderPaths.has(enlargedRenderPath) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/95 p-3 backdrop-blur-sm sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`Увеличенный рендер номера ${selectedRoom.roomNumber}`}
          onClick={() => setEnlargedRenderPath(null)}
        >
          <div className="relative h-full w-full max-w-7xl overflow-hidden rounded-2xl border border-white/15 bg-stone-900 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <Image
              src={enlargedRenderPath}
              alt={`Увеличенный рендер ${selectedRenderSet?.title ?? selectedRoom.renderSetId}`}
              fill
              priority
              sizes="100vw"
              className="object-contain"
              onError={() => markRenderAsFailed(enlargedRenderPath)}
            />
            <div className="absolute left-4 top-4 rounded-full bg-stone-950/80 px-4 py-2 text-xs text-stone-100 backdrop-blur sm:left-6 sm:top-6">
              № {selectedRoom.roomNumber.replace(/^№/, "")} · {selectedRenderSet?.title}
            </div>
            <button
              type="button"
              onClick={() => setEnlargedRenderPath(null)}
              className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-stone-950/80 text-xl text-white backdrop-blur transition hover:bg-stone-800 sm:right-6 sm:top-6"
              aria-label="Закрыть рендер"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
