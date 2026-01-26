export function updateProtocolLED(protocol, online) {
    const dot = document.getElementById(`${protocol}-dot`);
    if (!dot) return;

    dot.classList.remove('connected', 'active', 'offline', 'error');

    if (online) {
        dot.classList.add(protocol === 'ws' ? 'connected' : 'active');
    } else {
        dot.classList.add('offline');
    }
}
