import assert from "node:assert/strict";
import test from "node:test";
import { hasSpecialistContacts, normalizeSpecialistContacts, specialistContactsError, specialistFullName } from "./specialist-contacts.ts";

test("normalizes optional specialist contacts without rendering empty labels", () => {
  const contacts = normalizeSpecialistContacts({ firstName: "  Анна ", lastName: " Петрова ", agency: "", phone: "" });
  assert.equal(specialistFullName(contacts), "Анна Петрова");
  assert.equal(hasSpecialistContacts(contacts), true);
  assert.equal(hasSpecialistContacts(null), false);
  assert.equal(specialistContactsError(contacts), null);
});

test("validates phone characters and digit count", () => {
  assert.equal(specialistContactsError({ firstName: "", lastName: "", agency: "", phone: "+7 (900) 000-00-00" }), null);
  assert.match(specialistContactsError({ firstName: "", lastName: "", agency: "", phone: "abc" }) ?? "", /недопустимые/);
  assert.match(specialistContactsError({ firstName: "", lastName: "", agency: "", phone: "123" }) ?? "", /корректный/);
});
