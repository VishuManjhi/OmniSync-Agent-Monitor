import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const servers = [
    { name: 'WS Server', path: './src/js/comms/ws-server.cjs' },
    { name: 'SSE Server', path: './src/js/comms/sse-server.js' },
    { name: 'LP Server', path: './src/js/comms/lp-server.cjs' }
];

servers.forEach(server => {
    console.log(`Starting ${server.name}...`);
    const child = spawn('node', [server.path], {
        stdio: 'inherit',
        cwd: __dirname
    });

    child.on('error', (err) => {
        console.error(`Failed to start ${server.name}:`, err);
    });

    child.on('exit', (code) => {
        if (code !== 0) {
            console.log(`${server.name} exited with code ${code}`);
        }
    });
});

console.log('All servers initiated. You can now open login.html in your browser.');
