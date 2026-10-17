// ---------------------------------------------------------------------------
// Assessment Module – In-Memory Session Store with TTL
// Zero database persistence per architectural spec.
// ---------------------------------------------------------------------------

import type { AssessmentSession } from "./types.ts";

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // sweep every 5 min

const sessions = new Map<string, AssessmentSession>();

// Periodic garbage collection of expired sessions
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now > session.expiresAt) {
      sessions.delete(id);
    }
  }
}, CLEANUP_INTERVAL_MS).unref(); // .unref() so it doesn't keep process alive

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createSession(session: AssessmentSession): void {
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  sessions.set(session.id, session);
}

export function getSession(id: string): AssessmentSession | undefined {
  const session = sessions.get(id);
  if (!session) return undefined;
  if (Date.now() > session.expiresAt) {
    sessions.delete(id);
    return undefined;
  }
  return session;
}

export function updateSession(id: string, updates: Partial<AssessmentSession>): boolean {
  const session = getSession(id);
  if (!session) return false;
  Object.assign(session, updates);
  sessions.set(id, session);
  return true;
}

export function deleteSession(id: string): boolean {
  return sessions.delete(id);
}

/** Get all active sessions for a user (to prevent concurrent tests). */
export function getUserActiveSessions(userId: string): AssessmentSession[] {
  const result: AssessmentSession[] = [];
  const now = Date.now();
  for (const session of sessions.values()) {
    if (session.userId === userId && session.status === "ACTIVE" && now <= session.expiresAt) {
      result.push(session);
    }
  }
  return result;
}
