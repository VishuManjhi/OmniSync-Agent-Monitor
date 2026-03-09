import { createClient } from 'redis';

let client = null;
let available = false;

export async function initRedis() {
    const url = process.env.REDIS_URL || process.env.REDIS_URI;
    if (!url) {
        console.warn(`[REDIS][pid:${process.pid}] REDIS_URL not set — running without Redis.`);
        return;
    }

    client = createClient({ url });
    client.on('error', (err) => {
        console.error(`[REDIS][pid:${process.pid}] Client error`, err);
        available = false;
    });

    await client.connect();
    available = true;
    console.log(`[REDIS][pid:${process.pid}] Connected`);
}

export function isRedisAvailable() {
    return available && !!client;
}

export async function redisGet(key) {
    if (!isRedisAvailable()) return null;
    try {
        const v = await client.get(key);
        return v;
    } catch (err) {
        console.error('[REDIS] get error', err);
        return null;
    }
}

export async function redisSet(key, value, ttlSeconds) {
    if (!isRedisAvailable()) return false;
    try {
        if (ttlSeconds) {
            await client.set(key, value, { EX: ttlSeconds });
        } else {
            await client.set(key, value);
        }
        return true;
    } catch (err) {
        console.error('[REDIS] set error', err);
        return false;
    }
}

export async function redisDel(key) {
    if (!isRedisAvailable()) return 0;
    try {
        return await client.del(key);
    } catch (err) {
        console.error('[REDIS] del error', err);
        return 0;
    }
}

export async function redisKeys(pattern) {
    if (!isRedisAvailable()) return [];
    try {
        return await client.keys(pattern);
    } catch (err) {
        console.error('[REDIS] keys error', err);
        return [];
    }
}

export async function redisSetNx(key, value, ttlMs) {
    if (!isRedisAvailable()) return false;
    try {
        const res = await client.set(key, value, { NX: true, PX: ttlMs });
        return res === 'OK';
    } catch (err) {
        console.error('[REDIS] setnx error', err);
        return false;
    }
}

// release lock safely using a lua script that checks token
export async function redisReleaseLock(key, token) {
    if (!isRedisAvailable()) return false;
    try {
        const script = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;
        const res = await client.eval(script, { keys: [key], arguments: [token] });
        return res === 1;
    } catch (err) {
        console.error('[REDIS] release error', err);
        return false;
    }
}
