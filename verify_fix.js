async function verifyAuth(id, password) {
    try {
        console.log(`--- Testing Auth for [${id}] ---`);

        // 1. Login
        const loginRes = await fetch('http://localhost:3003/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, password })
        });

        const loginData = await loginRes.json();
        if (!loginRes.ok) {
            console.error(`Login failed: ${loginData.error}`);
            return;
        }

        const token = loginData.token;
        console.log(`Login SUCCESS. Role: ${loginData.role}`);

        // 2. Access Protected Endpoint
        const protectedRes = await fetch('http://localhost:3003/api/agents', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (protectedRes.ok) {
            console.log(`Access to /api/agents: SUCCESS (200 OK)`);
        } else {
            console.error(`Access to /api/agents: FAILED (${protectedRes.status})`);
            const errBody = await protectedRes.json().catch(() => ({}));
            console.error('Error info:', JSON.stringify(errBody));
        }
    } catch (err) {
        console.error('Test Error:', err.message);
    }
}

async function runVerification() {
    await verifyAuth('admin', 'sup123');
    await verifyAuth('sup1', 'sup123');
    await verifyAuth('a1', 'agent123');
}

runVerification();
