/**
 * Server-side in-memory store for support access grants.
 *
 * A grant means: the user (by sub) has explicitly allowed support staff
 * to edit their profile and initiate transfers on their behalf.
 *
 * Grants expire after GRANT_TTL_MS (60 seconds).
 * An active grant is NOT revoked mid-action — the action itself
 * checks remaining time and refuses to START if the grant is expired.
 */

export const GRANT_TTL_MS = 60_000; // 60 seconds

interface Grant {
  /** Unix timestamp (ms) when the grant was created */
  grantedAt: number;
  /** Unix timestamp (ms) after which new actions cannot be started */
  expiresAt: number;
}

// Module-level map — persists across requests within the same server process
const grants = new Map<string, Grant>();

export function grantAccess(userSub: string): Grant {
  const now = Date.now();
  const grant: Grant = {
    grantedAt: now,
    expiresAt: now + GRANT_TTL_MS,
  };
  grants.set(userSub, grant);
  return grant;
}

/** Adds GRANT_TTL_MS to the current expiry (or from now if already expired). */
export function extendAccess(userSub: string): Grant {
  const existing = grants.get(userSub);
  const base = existing && existing.expiresAt > Date.now()
    ? existing.expiresAt   // still active — extend from current expiry
    : Date.now();          // expired or missing — extend from now
  const grant: Grant = {
    grantedAt: existing?.grantedAt ?? Date.now(),
    expiresAt: base + GRANT_TTL_MS,
  };
  grants.set(userSub, grant);
  return grant;
}

export function getGrant(userSub: string): Grant | null {
  return grants.get(userSub) ?? null;
}

export function isGrantActive(userSub: string): boolean {
  const grant = grants.get(userSub);
  if (!grant) return false;
  return Date.now() < grant.expiresAt;
}

export function revokeGrant(userSub: string): void {
  grants.delete(userSub);
}

export function getGrantInfo(userSub: string): {
  active: boolean;
  remainingMs: number;
  expiresAt: number | null;
  grantedAt: number | null;
} {
  const grant = grants.get(userSub);
  if (!grant) {
    return { active: false, remainingMs: 0, expiresAt: null, grantedAt: null };
  }
  const remaining = Math.max(0, grant.expiresAt - Date.now());
  return {
    active: remaining > 0,
    remainingMs: remaining,
    expiresAt: grant.expiresAt,
    grantedAt: grant.grantedAt,
  };
}
