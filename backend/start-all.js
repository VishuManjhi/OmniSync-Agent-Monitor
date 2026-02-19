import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const servers = [
    { name: 'API Server', path: './servers/api-server.js' },
    { name: 'WS Server', path: './servers/ws-server.js' }
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

    // Cleanup on parent exit
    const cleanup = () => {
        console.log(`Killing ${server.name}...`);
        child.kill();
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
});

console.log('API server initiated. You can now open login.html in your browser.');
