import { Server } from 'socket.io';
import http from 'http';

const server = http.createServer();
const io = new Server(server, {
    cors: {
        origin: '*', // Adjust for production
        methods: ['GET', 'POST']
    }
});

const PORT = 8080;

io.on('connection', (socket) => {
    console.log('[WS] New connection:', socket.id);

    socket.on('identify', (data) => {
        console.log(`[WS] Agent identified: ${data.agentId} (${data.role})`);
        socket.data.agentId = data.agentId;
        socket.data.role = data.role;

        // Join a room based on agentId for targeted broadcasts if needed
        socket.join(`agent:${data.agentId}`);
        if (data.role === 'supervisor') {
            socket.join('supervisors');
        }
    });

    socket.on('message', (data) => {
        console.log('[WS] Received message:', data.type);
        // Broadcast to ALL connected clients (mirroring old 'ws' logic)
        io.emit('message', data);
    });

    socket.on('disconnect', () => {
        console.log('[WS] Connection closed:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`[WS] Socket.io Server listening on port ${PORT}`);
});
