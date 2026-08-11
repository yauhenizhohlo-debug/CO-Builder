export function safeInventoryReturnUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const allowed = new URL(process.env.NEXT_PUBLIC_INVENTORY_ORIGIN ?? "http://localhost:3001");
    const candidate = new URL(value);
    if (candidate.origin !== allowed.origin) return null;
    if (!candidate.pathname.startsWith("/inventory/cosmos-black-sea/")) return null;
    return candidate.toString();
  } catch {
    return null;
  }
}
