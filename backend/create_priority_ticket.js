// Script to create a backdated (>24h old) priority ticket for testing
// Run with: node create_priority_ticket.js

const ticket = {
    ticketId: `TICK-PRI-${Date.now()}`,
    agentId: 'agent1',
    issueType: 'URGENT: SYSTEM OUTAGE',
    description: 'Test ticket created 25 hours ago to verify priority status flag.',
    status: 'OPEN',
    issueDateTime: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
    createdBy: 'sys',
    attachments: []
};

fetch('http://localhost:3003/api/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ticket)
})
    .then(r => r.json())
    .then(() => {
        console.log('✅ Priority ticket created! Ticket ID:', ticket.ticketId);
        console.log('   Refresh the Supervisor Dashboard -> Activity Log -> Filter: PRIORITY to see it.');
    })
    .catch(err => console.error('❌ Error:', err));
