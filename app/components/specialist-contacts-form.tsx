"use client";

import type { SpecialistContacts } from "../lib/specialist-contacts";
import { specialistContactsError } from "../lib/specialist-contacts";

export function SpecialistContactsForm({
  value,
  onChange,
}: {
  value: SpecialistContacts;
  onChange: (value: SpecialistContacts) => void;
}) {
  const error = specialistContactsError(value);
  const field = (key: keyof SpecialistContacts, label: string, options?: { autoComplete?: string; type?: string }) => (
    <label className="block text-xs text-stone-400">
      {label}
      <input
        type={options?.type ?? "text"}
        autoComplete={options?.autoComplete}
        maxLength={key === "agency" ? 180 : key === "phone" ? 40 : 80}
        value={value[key]}
        onChange={(event) => onChange({ ...value, [key]: event.target.value })}
        className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-stone-950 px-3 text-base text-stone-100 outline-none transition focus:border-amber-200"
      />
    </label>
  );

  return (
    <fieldset className="space-y-3 rounded-xl border border-white/10 p-4">
      <legend className="px-2 text-sm font-medium text-stone-200">Контакты специалиста</legend>
      <p className="text-xs leading-5 text-stone-500">Все поля необязательные и сохраняются только в snapshot этого документа.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("firstName", "Имя", { autoComplete: "given-name" })}
        {field("lastName", "Фамилия", { autoComplete: "family-name" })}
      </div>
      {field("agency", "Агентство недвижимости", { autoComplete: "organization" })}
      {field("phone", "Телефон", { autoComplete: "tel", type: "tel" })}
      {error ? <p role="alert" className="text-xs text-red-300">{error}</p> : null}
    </fieldset>
  );
}
