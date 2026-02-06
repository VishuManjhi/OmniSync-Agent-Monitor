console.log('[AHT Worker] loaded');
self.onmessage = (e) => {
  const tickets = e.data;

  let totalTime = 0;
  let count = 0;

  const perAgent = new Map();

  for (const t of tickets) {
    if (!t.issueDateTime) continue;

    const start = new Date(t.issueDateTime).getTime();
    const end = t.resolvedAt
      ? new Date(t.resolvedAt).getTime()
      : Date.now(); // ongoing ticket

    const duration = end - start;
    if (duration <= 0) continue;

    totalTime += duration;
    count++;

    if (!perAgent.has(t.agentId)) {
      perAgent.set(t.agentId, { total: 0, count: 0 });
    }

    const agent = perAgent.get(t.agentId);
    agent.total += duration;
    agent.count++;
  }

  const globalAHT = count === 0
    ? 0
    : Math.round(totalTime / count / 1000); // seconds

  const perAgentAHT = {};
  perAgent.forEach((v, k) => {
    perAgentAHT[k] = Math.round(v.total / v.count / 1000);
  });

  self.postMessage({
    globalAHT,
    perAgentAHT
  });
};
