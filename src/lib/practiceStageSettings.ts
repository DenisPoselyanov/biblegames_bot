export const MIN_STAGE_CAP = 1;
export const MAX_STAGE_CAP = 5;

/** When false, only VITE_ADMIN_IDS may edit per-node stage counts in the UI. */
export const PRACTICE_STAGE_CAPS_PUBLIC_EDIT = true;

export function parseAdminIds(): string[] {
  const raw = import.meta.env.VITE_ADMIN_IDS as string | undefined;
  if (!raw?.trim()) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export function isAppAdmin(userId?: string | null): boolean {
  if (!userId) return false;
  const ids = parseAdminIds();
  return ids.length > 0 && ids.includes(String(userId));
}

export function canEditPracticeStageCaps(userId?: string | null): boolean {
  if (PRACTICE_STAGE_CAPS_PUBLIC_EDIT) return true;
  return isAppAdmin(userId);
}
