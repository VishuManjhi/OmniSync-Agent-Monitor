async function testLogin(id, password) {
    try {
        const res = await fetch('http://localhost:3003/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, password })
        });
        const status = res.status;
        const data = await res.json();
        console.log(`Login attempt for ${id}:`);
        console.log(`Status: ${status}`);
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    }
}

testLogin('admin', 'sup123');
testLogin('sup1', 'sup123');
testLogin('a1', 'agent123');
