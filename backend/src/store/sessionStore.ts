/**
 * In-memory assessment session store.
 *
 * IMPLEMENTATION NOTE (demo / local-development only):
 *   - Sessions are stored in process memory and are lost when the backend restarts.
 *   - This store is NOT shared across multiple backend instances.
 *   - It is intentionally NOT backed by PostgreSQL or any external cache.
 *   - Sessions expire automatically after the configured TTL.
 *   - For production use, replace with a Redis-backed session store.
 */

import { AssessmentSession } from '../types/assessment';

// Default session TTL: 2 hours (generous for a demo)
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

// Maximum concurrent sessions kept in memory to prevent unbounded growth
const MAX_SESSIONS = 200;

class SessionStore {
    private sessions = new Map<string, AssessmentSession>();

    /**
     * Stores a new session. If MAX_SESSIONS is reached, evicts the oldest expired
     * sessions first; if still at capacity, evicts the absolute oldest entry.
     */
    set(session: AssessmentSession): void {
        if (this.sessions.size >= MAX_SESSIONS) {
            this.evictExpired();
        }
        if (this.sessions.size >= MAX_SESSIONS) {
            // Evict oldest entry by insertion order
            const oldestKey = this.sessions.keys().next().value;
            if (oldestKey) this.sessions.delete(oldestKey);
        }
        this.sessions.set(session.assessmentId, session);
    }

    /**
     * Retrieves a session by ID, returning null if it does not exist or has expired.
     */
    get(assessmentId: string): AssessmentSession | null {
        const session = this.sessions.get(assessmentId);
        if (!session) return null;
        if (new Date() > session.expiresAt) {
            this.sessions.delete(assessmentId);
            return null;
        }
        return session;
    }

    /**
     * Updates a session in-place. Returns false if the session does not exist or
     * has already expired.
     */
    update(assessmentId: string, patch: Partial<AssessmentSession>): boolean {
        const existing = this.get(assessmentId);
        if (!existing) return false;
        this.sessions.set(assessmentId, { ...existing, ...patch });
        return true;
    }

    /**
     * Removes all sessions whose expiry timestamp is in the past.
     */
    evictExpired(): void {
        const now = new Date();
        for (const [id, session] of this.sessions) {
            if (now > session.expiresAt) {
                this.sessions.delete(id);
            }
        }
    }

    /** Returns the current number of live (non-expired) sessions. */
    size(): number {
        this.evictExpired();
        return this.sessions.size;
    }
}

export const sessionStore = new SessionStore();
export { SESSION_TTL_MS };
