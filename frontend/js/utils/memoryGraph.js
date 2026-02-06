const canvas = document.getElementById('heapGraph');

if (canvas) {
  const ctx = canvas.getContext('2d');

  const MAX_POINTS = 60;
  const samples = [];

  function getHeapUsageMB() {
    if (performance && performance.memory) {
      return performance.memory.usedJSHeapSize / (1024 * 1024);
    }

    const last = samples[samples.length - 1] || 40;
    return Math.max(10, last + (Math.random() * 4 - 2));
  }

  function drawGraph() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (samples.length < 2) return;

    const max = Math.max(...samples) * 1.1;
    const min = Math.min(...samples) * 0.9;

    ctx.beginPath();
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 2;

    samples.forEach((value, i) => {
      const x = (i / (MAX_POINTS - 1)) * canvas.width;
      const y =
        canvas.height -
        ((value - min) / (max - min)) * canvas.height;

      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });

    ctx.stroke();
  }

  setInterval(() => {
    samples.push(getHeapUsageMB());
    if (samples.length > MAX_POINTS) samples.shift();
    drawGraph();
  }, 1000);
}
