async function testLogin(id, password) {
    try {
        const res = await fetch('http://localhost:3003/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, password })
        });
        const data = await res.json();
        console.log(`--- [${id}] ---`);
        console.log(`Status: ${res.status}`);
        console.log(`Role:   ${data.role}`);
        console.log(`Token provided: ${!!data.token}`);
    } catch (err) {
        console.error(`Error [${id}]:`, err.message);
    }
}

async function runTests() {
    await testLogin('admin', 'sup123');
    await testLogin('sup1', 'sup123');
    await testLogin('a1', 'agent123');
}

runTests();
