export type SpecialistContacts = {
  firstName: string;
  lastName: string;
  agency: string;
  phone: string;
};

export type SpecialistContactsMode = "none" | "enabled";

export function specialistContactsEnabled(mode: SpecialistContactsMode | undefined, value?: Partial<SpecialistContacts> | null) {
  return mode === "enabled" || (mode === undefined && hasSpecialistContacts(value));
}

export const emptySpecialistContacts = (): SpecialistContacts => ({
  firstName: "",
  lastName: "",
  agency: "",
  phone: "",
});

const limits = { firstName: 80, lastName: 80, agency: 180, phone: 40 } as const;

export function normalizeSpecialistContacts(value?: Partial<SpecialistContacts> | null): SpecialistContacts {
  return {
    firstName: String(value?.firstName ?? "").trim().slice(0, limits.firstName),
    lastName: String(value?.lastName ?? "").trim().slice(0, limits.lastName),
    agency: String(value?.agency ?? "").trim().slice(0, limits.agency),
    phone: String(value?.phone ?? "").trim().slice(0, limits.phone),
  };
}

export function specialistContactsError(value: SpecialistContacts) {
  const contacts = normalizeSpecialistContacts(value);
  if (!contacts.phone) return null;
  if (!/^[+\d\s().-]+$/.test(contacts.phone)) return "Телефон содержит недопустимые символы";
  const digits = contacts.phone.replace(/\D/g, "");
  if (digits.length < 5 || digits.length > 15) return "Укажите корректный номер телефона";
  return null;
}

export function hasSpecialistContacts(value?: Partial<SpecialistContacts> | null) {
  const contacts = normalizeSpecialistContacts(value);
  return Boolean(contacts.firstName || contacts.lastName || contacts.agency || contacts.phone);
}

export function specialistFullName(value?: Partial<SpecialistContacts> | null) {
  const contacts = normalizeSpecialistContacts(value);
  return [contacts.firstName, contacts.lastName].filter(Boolean).join(" ");
}
