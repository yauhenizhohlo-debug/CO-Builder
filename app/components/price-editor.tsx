"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Room } from "../data/rooms";

const money = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });

export function PriceEditor({ room, open, onClose, onSaved }: { room: Room; open: boolean; onClose: () => void; onSaved: (room: Room) => void }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [authorId, setAuthorId] = useState("");
  const [newPrice, setNewPrice] = useState(room.price);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNewPrice(room.price);
    setComment("");
    setError("");
    fetch("/api/admin/session", { cache: "no-store" }).then((response) => response.json()).then((data) => setAuthenticated(Boolean(data.authenticated))).catch(() => setAuthenticated(false));
  }, [open, room]);

  if (!open || typeof document === "undefined") return null;
  const pricePerSqm = newPrice > 0 ? Math.round(newPrice / room.area) : 0;

  const login = async () => {
    setError("");
    const response = await fetch("/api/admin/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password, authorId }) });
    if (!response.ok) return setError(response.status === 401 ? "Неверный пароль администратора" : "Админ-доступ не настроен на сервере");
    setPassword("");
    setAuthenticated(true);
  };

  const save = async () => {
    setError("");
    if (!Number.isSafeInteger(newPrice) || newPrice <= 0) return setError("Введите корректную цену в целых рублях");
    if (!comment.trim()) return setError("Добавьте комментарий к изменению");
    setSaving(true);
    try {
      const response = await fetch("/api/price-overrides", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ roomNumber: room.roomNumber, newPrice, comment, expectedPrice: room.price }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "SAVE_FAILED");
      onSaved(data.room as Room);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error && caught.message === "UNAUTHORIZED" ? "Сессия администратора истекла" : caught instanceof Error && caught.message.includes("PRICE_CONFLICT") ? "Цена уже изменена другим пользователем. Закройте окно и обновите данные." : "Не удалось сохранить изменение");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-stone-950/90 p-4" role="dialog" aria-modal="true" aria-label={`Изменить цену номера ${room.roomNumber}`} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-stone-900 p-5 shadow-2xl sm:p-7" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div><p className="eyebrow">Администрирование прайса</p><h2 className="mt-2 font-serif text-2xl">Изменить цену</h2></div>
          <button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-white/10 px-4 text-sm text-stone-400">Закрыть</button>
        </div>
        {!authenticated ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm leading-6 text-stone-400">Редактирование доступно только администратору. Пароль проверяется сервером и не хранится в браузере.</p>
            <label className="block text-xs text-stone-400">Идентификатор автора<input value={authorId} onChange={(event) => setAuthorId(event.target.value)} autoComplete="username" className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-stone-950 px-3 text-base" /></label>
            <label className="block text-xs text-stone-400">Пароль администратора<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-stone-950 px-3 text-base" /></label>
            <button type="button" onClick={login} className="min-h-12 w-full rounded-xl bg-amber-100 px-4 text-sm font-medium text-stone-950">Войти</button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <dl className="grid grid-cols-2 gap-3 rounded-xl border border-white/10 p-4 text-sm"><div><dt className="text-stone-500">Номер</dt><dd className="mt-1">{room.roomNumber}</dd></div><div><dt className="text-stone-500">Площадь</dt><dd className="mt-1">{room.area.toLocaleString("ru-RU")} м²</dd></div><div className="col-span-2"><dt className="text-stone-500">Текущая цена</dt><dd className="mt-1 text-lg">{money.format(room.price)}</dd></div></dl>
            <label className="block text-xs text-stone-400">Новая цена, ₽<input type="number" min="1" step="1000" value={newPrice} onChange={(event) => setNewPrice(Number(event.target.value))} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-stone-950 px-3 text-base" /></label>
            <div className="rounded-xl bg-white/[0.04] p-4"><p className="text-xs text-stone-500">Новая цена за м²</p><p className="mt-1 text-lg text-amber-100">{money.format(pricePerSqm)}</p></div>
            <label className="block text-xs text-stone-400">Комментарий<textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-white/10 bg-stone-950 p-3 text-base" /></label>
            <div className="grid grid-cols-2 gap-3"><button type="button" onClick={onClose} className="min-h-12 rounded-xl border border-white/15 text-sm">Отмена</button><button type="button" disabled={saving} onClick={save} className="min-h-12 rounded-xl bg-amber-100 text-sm font-medium text-stone-950 disabled:opacity-50">{saving ? "Сохранение…" : "Сохранить"}</button></div>
          </div>
        )}
        {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
      </div>
    </div>, document.body,
  );
}
