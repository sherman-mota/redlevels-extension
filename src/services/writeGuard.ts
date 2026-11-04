import type { RedmineUser } from '../types/redmine';

/**
 * Safe edit mode (opt-in, `config.safeEditMode`): everything that writes to Redmine (the only write
 * is `updateIssue`) goes through three gates.
 *  1) Lock: read-only until the user unlocks editing on purpose; it relocks by itself after LOCK_MINUTES.
 *  2) Confirmation before each write: who writes, where, which issue and what changes.
 *  3) API gate: `updateIssue` refuses to write without a recent single-use authorization given by (2).
 * Demo mode writes nothing to Redmine, so none of this applies there.
 *
 * State lives in this module (not in config or storage): reloading the page locks editing again.
 * `now` is injectable for tests.
 */

export const LOCK_MINUTES = 15;
const AUTHORIZATION_TTL_MS = 60_000;
const MINUTE_MS = 60_000;

let lockedUntil = 0;
let authorization: { issueId: number; expiresAt: number } | null = null;
const subscribers = new Set<() => void>();

const emit = () => subscribers.forEach((fn) => fn());

/** Calls `fn` whenever the lock changes. Returns the unsubscribe function. */
export function subscribeLock(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function isUnlocked(now: number = Date.now()): boolean {
  return now < lockedUntil;
}

/** Minutes left of the unlock (0 when locked); a started minute counts. */
export function unlockMinutesLeft(now: number = Date.now()): number {
  return isUnlocked(now) ? Math.max(1, Math.ceil((lockedUntil - now) / MINUTE_MS)) : 0;
}

export function unlockEdit(now: number = Date.now()): void {
  lockedUntil = now + LOCK_MINUTES * MINUTE_MS;
  emit();
}

export function lockEdit(): void {
  lockedUntil = 0;
  authorization = null;
  emit();
}

/** Every confirmed write renews the unlock, so a working session is not locked in the middle. */
export function renewUnlock(now: number = Date.now()): void {
  if (isUnlocked(now)) lockedUntil = now + LOCK_MINUTES * MINUTE_MS;
}

/** Authorizes ONE write to the issue (consumed by `consumeAuthorization`). */
export function authorizeWrite(issueId: number, now: number = Date.now()): void {
  authorization = { issueId, expiresAt: now + AUTHORIZATION_TTL_MS };
}

/** True only once per authorization, for the same issue and while it has not expired. */
export function consumeAuthorization(issueId: number, now: number = Date.now()): boolean {
  const ok = !!authorization && authorization.issueId === issueId && now < authorization.expiresAt;
  authorization = null;
  return ok;
}

/* ---- texts of the confirmation ---- */

export function userLabel(user: Pick<RedmineUser, 'firstname' | 'lastname' | 'login'> | null | undefined): string {
  if (!user) return 'usuário não identificado';
  const name = `${user.firstname || ''} ${user.lastname || ''}`.trim();
  return `${name || user.login || '?'}${user.login && name ? ` (${user.login})` : ''}`;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url || '?';
  }
}

/** Lines that say what a status update changes. */
export function statusChangeLines(
  current: { id: number; name: string } | undefined,
  target: { id: number; name?: string },
  notes?: string
): string[] {
  const lines: string[] = [];
  if (current && current.id !== target.id) lines.push(`Status: ${current.name} → ${target.name || target.id}`);
  if (notes) lines.push(`Comentário: "${notes.slice(0, 200)}${notes.length > 200 ? '…' : ''}"`);
  return lines.length ? lines : ['Atualização da tarefa'];
}
