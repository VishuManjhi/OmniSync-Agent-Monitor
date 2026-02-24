// using global fetch

const AGENT_ID = 'a1';
const BASE_URL = 'http://localhost:3003';

async function test() {
    try {
        // 1. Login
        const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: AGENT_ID, password: 'agent123' })
        });

        const { token } = await loginRes.json();
        console.log('Login successful, token obtained');

        // 2. Fetch tickets
        const ticketsRes = await fetch(`${BASE_URL}/api/agents/${AGENT_ID}/tickets?page=1&limit=5`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await ticketsRes.json();
        console.log('Tickets Response:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Test failed:', err);
    }
}

test();
