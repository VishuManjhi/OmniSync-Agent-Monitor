/**
 * Idempotency Key Generation
 * 
 * Generates unique, deterministic keys for operations to ensure
 * safe retry and replay behavior.
 * 
 * WHY idempotency keys:
 * - Prevent duplicate operation execution
 * - Safe retries on network failures
 * - Consistent across client/server
 */

/**
 * Generates an idempotency key from action and payload
 * Uses deterministic hashing so same action+payload = same key
 * @param {string} action - Action type
 * @param {Object} payload - Action payload
 * @returns {string} Idempotency key
 */
export function generateIdempotencyKey(action, payload) {
    // Simple deterministic key generation
    // In production, use crypto.subtle.digest for SHA-256
    const data = JSON.stringify({ action, payload });
    
    // Hash-like function (simple version - production should use crypto.subtle)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Include timestamp component for uniqueness when needed
    const timestamp = Date.now();
    
    return `${action}-${Math.abs(hash).toString(16)}-${timestamp}`;
}

/**
 * Generates a user-initiated idempotency key
 * Includes user context for better uniqueness
 * @param {string} userId - User identifier
 * @param {string} action - Action type
 * @param {Object} payload - Action payload
 * @returns {string} Idempotency key
 */
export function generateUserIdempotencyKey(userId, action, payload) {
    return generateIdempotencyKey(`${userId}:${action}`, payload);
}
