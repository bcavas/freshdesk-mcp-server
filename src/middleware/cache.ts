interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

export class Cache {
    private store = new Map<string, CacheEntry<unknown>>();
    private defaultTtlMs: number;

    // TTL presets by data type
    static readonly TTL = {
        AGENTS: 60 * 60 * 1000, // 1 hour — rarely changes
        GROUPS: 60 * 60 * 1000, // 1 hour
        TICKET_FIELDS: 30 * 60 * 1000, // 30 min
        SLA_POLICIES: 30 * 60 * 1000, // 30 min
        CANNED_RESPONSES: 15 * 60 * 1000, // 15 min
        TICKETS: 2 * 60 * 1000, // 2 min — changes frequently
        TICKET_LISTS: 60 * 1000, // 1 min — frequently changes, heavily queried
        CONVERSATIONS: 60 * 1000, // 1 min
        CONTACTS: 5 * 60 * 1000, // 5 min
        SOLUTION_CATEGORIES: 60 * 60 * 1000, // 1 hour
        SOLUTION_FOLDERS: 60 * 60 * 1000, // 1 hour
        SOLUTION_ARTICLES: 30 * 60 * 1000, // 30 min
        TIME_ENTRIES: 5 * 60 * 1000, // 5 min
        AUTOMATION_RULES: 60 * 60 * 1000, // 1 hour
        SEARCH: 0, // Never cache search results
    };

    constructor(defaultTtlMs: number = 5 * 60 * 1000) {
        this.defaultTtlMs = defaultTtlMs;
        // Cleanup expired entries every 5 minutes
        setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
    }

    get<T>(key: string): T | undefined {
        const entry = this.store.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }
        return entry.value as T;
    }

    set<T>(key: string, value: T, ttlMs?: number): void {
        const ttl = ttlMs ?? this.defaultTtlMs;
        if (ttl === 0) return; // 0 means no caching
        this.store.set(key, {
            value,
            expiresAt: Date.now() + ttl,
        });
    }

    invalidate(key: string): void {
        this.store.delete(key);
    }

    invalidatePrefix(prefix: string): void {
        for (const key of this.store.keys()) {
            if (key.startsWith(prefix)) {
                this.store.delete(key);
            }
        }
    }

    clear(): void {
        this.store.clear();
    }

    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.store.entries()) {
            if (now > entry.expiresAt) {
                this.store.delete(key);
            }
        }
    }
}
