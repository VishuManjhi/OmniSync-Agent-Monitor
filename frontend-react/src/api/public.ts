const API_BASE_URL = 'http://localhost:3003';

export interface HelpContentResponse {
    ok: boolean;
    faqs: Array<{ question: string; answer: string }>;
    caseStudies: Array<{ title: string; summary: string }>;
}

export async function fetchHelpContent(): Promise<HelpContentResponse> {
    const res = await fetch(`${API_BASE_URL}/api/public/help-content`);
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
    }
    return res.json();
}

export async function submitPublicFeedback(payload: {
    name: string;
    email: string;
    category: 'general' | 'feature' | 'bug' | 'support';
    message: string;
}) {
    const res = await fetch(`${API_BASE_URL}/api/public/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
            const body = await res.json();
            if (body?.error) message = body.error;
        } catch {
            // ignore
        }
        throw new Error(message);
    }

    return res.json();
}

export async function captureLead(payload: {
    name: string;
    email: string;
    message: string;
}) {
    return submitPublicFeedback({
        ...payload,
        category: 'general'
    });
}

export async function requestOnboarding(email: string) {
    const res = await fetch(`${API_BASE_URL}/api/public/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });

    if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
            const body = await res.json();
            if (body?.error) message = body.error;
        } catch {
            // ignore
        }
        throw new Error(message);
    }

    return res.json();
}
