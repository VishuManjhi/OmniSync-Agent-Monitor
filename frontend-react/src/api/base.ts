const API_BASE_URL = 'http://localhost:3003';

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${path}`;

    const res = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    });

    if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
            const body = await res.json();
            if (body && body.error) {
                message = body.error;
            }
        } catch {
            // ignore JSON parse issues
        }
        throw new Error(message);
    }

    if (res.status === 204) return null as T;
    return res.json();
}
