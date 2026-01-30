self.onmessage = (e) => {
    const tickets = e.data;

    let totalHandleTime = 0;
    let count = 0;

    const perAgent = new Map();

    for (const t of tickets) {
        if (!t.callDuration || t.callDuration <= 0) continue;

        totalHandleTime += t.callDuration;
        count++;

        if (!perAgent.has(t.agentId)) {
            perAgent.set(t.agentId, {
                total: 0,
                count: 0
            });
        }

        const agent = perAgent.get(t.agentId);
        agent.total += t.callDuration;
        agent.count++;
    }

    const globalAHT = count === 0
        ? 0
        : Math.round(totalHandleTime / count);

    const perAgentAHT = {};
    perAgent.forEach((v, k) => {
        perAgentAHT[k] = Math.round(v.total / v.count);
    });

    self.postMessage({
        globalAHT,
        perAgentAHT
    });
};
