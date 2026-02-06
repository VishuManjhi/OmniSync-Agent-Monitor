// ===============================
// Memory Stress Test (DEV / LAB)
// ===============================

let _stressAgents = null;
let _stressNodes = null;

export function runStressTest(count = 1000) {
    const container = document.getElementById('stress-test-layer');
    if (!container) {
        console.warn('[STRESS] Container not found');
        return;
    }

    container.style.display = 'block';
    container.innerHTML = '';

    _stressAgents = [];
    _stressNodes = [];

    for (let i = 0; i < count; i++) {
        const agent = {
            id: `temp-${i}`,
            name: `Temp Agent ${i}`,
            payload: new Array(200).fill(i) // intentional memory
        };

        const card = document.createElement('div');
        card.className = 'agent-card';
        card.textContent = agent.name;

        container.appendChild(card);

        _stressAgents.push(agent);
        _stressNodes.push(card);
    }

    console.log(`[STRESS] Created ${count} temporary agents`);
}

export function cleanupStressTest() {
    const container = document.getElementById('stress-test-layer');
    if (!container) return;

    _stressNodes?.forEach(n => n.remove());

    _stressAgents = null;
    _stressNodes = null;

    container.innerHTML = '';
    container.style.display = 'none';

    console.log('[STRESS] Cleanup complete — references cleared');
}

// Expose to DevTools console (lab usage)
window.runStressTest = runStressTest;
window.cleanupStressTest = cleanupStressTest;
