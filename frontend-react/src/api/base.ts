const API_BASE_URL = 'http://localhost:3003';
const TOKEN_KEY = 'omnisync_jwt';

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${path}`;
    const token = localStorage.getItem(TOKEN_KEY);

    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {})
        }
    });

    if (res.status === 401) {
        console.warn('[API] 401 Unauthorized - Clearing token and redirecting');
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = '/';
        throw new Error('SESSION_EXPIRED');
    }

    if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
            const body = await res.json();
            if (body && body.error) message = body.error;
        } catch {
            // ignore JSON parse issues
        }
        throw new Error(message);
    }

    if (res.status === 204) return null as T;
    return res.json();
}
