const CHANNEL_NAME = 'restroboard-sync';
let channel = null;

export function initBroadcast(onMessage) {
    if (!('BroadcastChannel' in window)) {
        console.warn('[BC] BroadcastChannel not supported');
        return;
    }

    channel = new BroadcastChannel(CHANNEL_NAME);

    channel.onmessage = (e) => {
        console.log('[BC MESSAGE]', e.data);
        onMessage?.(e.data);
    };
}

export function broadcastMessage(message) {
    if (!channel) return;
    channel.postMessage(message);
}
