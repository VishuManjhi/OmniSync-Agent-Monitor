// Using native fetch from Node v22

const API_BASE = 'http://127.0.0.1:3003/api';

async function runTests() {
    console.log('--- Phase 9 Verification Suite ---');

    // Test 1: Validation - Invalid Ticket
    console.log('\n[Test 1] Ticket Validation (Invalid Data)...');
    try {
        const res = await fetch(`${API_BASE}/tickets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticketId: 'invalid-uuid',
                issueType: 'UNKNOWN_CATEGORY',
                description: 'short'
            })
        });
        const data = await res.json();
        if (res.status === 400 && data.error === 'VALIDATION_ERROR') {
            console.log('✅ PASS: Rejected invalid ticket with 400 VALIDATION_ERROR');
        } else {
            console.log(`❌ FAIL: Expected 400, got ${res.status}`);
            console.log(data);
        }
    } catch (err) {
        console.log('❌ FAIL: Request error', err.message);
    }

    // Test 2: Validation - Missing Auth Fields
    console.log('\n[Test 2] Auth Validation (Missing Password)...');
    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'agent1' })
        });
        const data = await res.json();
        if (res.status === 400 && data.error === 'VALIDATION_ERROR') {
            console.log('✅ PASS: Rejected incomplete auth payload');
        } else {
            console.log(`❌ FAIL: Expected 400, got ${res.status}`);
        }
    } catch (err) {
        console.log('❌ FAIL: Request error', err.message);
    }

    console.log('\n--- Manual Verification Steps ---');
    console.log('1. Open Agent Dashboard.');
    console.log('2. Create a ticket with an IMAGE attachment.');
    console.log('3. Verify that /VBA/backend/uploads/ directory contains a new file.');
    console.log('4. Verify MongoDB record for that ticket has a "path" but no "content".');
}

runTests();
