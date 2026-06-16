/**
 * Resolve a numeric ID to a name from a named-items list.
 * Falls back to `#id` when not found.
 */
export function resolveName(
  id: number,
  items: { id: number; name: string }[] | undefined,
): string {
  return items?.find((i) => i.id === id)?.name ?? `#${id}`;
}

/**
 * Return today's date as YYYY-MM-DD string.
 */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Format a phone number for display (Kenyan format).
 */
export function formatPhoneDisplay(phone: string): string {
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (/^07\d{8}$/.test(cleaned))
    return `+254 ${cleaned.slice(1, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  if (/^\+254\d{9}$/.test(cleaned))
    return `+254 ${cleaned.slice(4, 7)} ${cleaned.slice(7, 10)} ${cleaned.slice(10)}`;
  if (/^254\d{9}$/.test(cleaned))
    return `+254 ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;
  return phone;
}

/**
 * Resolve a user ID to a username.
 */
export function resolveUser(
  id: number | null,
  users: { id: number; username: string }[] | undefined,
): string | null {
  if (id == null) return null;
  return users?.find((u) => u.id === id)?.username ?? `#${id}`;
}
