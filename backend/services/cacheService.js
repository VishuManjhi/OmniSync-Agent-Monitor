import { isRedisAvailable, redisGet, redisSet, redisDel, redisKeys, redisSetNx, redisReleaseLock } from './redisClient.js';
import crypto from 'crypto';

const DEFAULT_TTL = 20; // seconds

export async function getOrSet(key, ttlSeconds = DEFAULT_TTL, fetchFn) {
    try {
        if (isRedisAvailable()) {
            const cached = await redisGet(key);
            if (cached) {
                try {
                    return JSON.parse(cached);
                } catch (e) {
                    // fallthrough to fetch
                }
            }
        }

        const value = await fetchFn();
        const str = JSON.stringify(value);
        if (isRedisAvailable()) {
            await redisSet(key, str, ttlSeconds);
        }
        return value;
    } catch (err) {
        console.error('[CACHE] getOrSet error', err);
        return fetchFn();
    }
}

export async function invalidate(key) {
    try {
        if (!isRedisAvailable()) return 0;
        return await redisDel(key);
    } catch (err) {
        console.error('[CACHE] invalidate error', err);
        return 0;
    }
}

export async function invalidatePattern(pattern) {
    try {
        if (!isRedisAvailable()) return 0;
        const keys = await redisKeys(pattern);
        if (!keys.length) return 0;
        let deleted = 0;
        for (const k of keys) {
            deleted += await redisDel(k);
        }
        return deleted;
    } catch (err) {
        console.error('[CACHE] invalidatePattern error', err);
        return 0;
    }
}

export async function acquireLock(key, ttlMs = 300000) {
    try {
        if (!isRedisAvailable()) return { ok: true, token: null };
        const token = crypto.randomUUID();
        const ok = await redisSetNx(key, token, ttlMs);
        return { ok, token };
    } catch (err) {
        console.error('[CACHE] acquireLock error', err);
        return { ok: true, token: null };
    }
}

export async function releaseLock(key, token) {
    try {
        if (!isRedisAvailable()) return true;
        if (!token) return true;
        return await redisReleaseLock(key, token);
    } catch (err) {
        console.error('[CACHE] releaseLock error', err);
        return false;
    }
}
