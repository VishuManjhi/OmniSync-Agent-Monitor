import { Server } from 'socket.io';
import http from 'http';
import crypto from 'crypto';
import { connectDb } from '../db.js';
import Message from '../models/Message.js';

const server = http.createServer();
const io = new Server(server, {
    cors: {
        origin: '*', // Adjust for production
        methods: ['GET', 'POST']
    }
});

const PORT = 8080;

// Connect to DB for message persistence
connectDb().catch(err => {
    console.error('[WS] Failed to connect to DB:', err);
});

io.on('connection', (socket) => {
    console.log('[WS] New connection:', socket.id);

    socket.on('identify', (data) => {
        console.log(`[WS] Agent identified: ${data.agentId} (${data.role})`);
        socket.data.agentId = data.agentId;
        socket.data.role = data.role;

        // Join a room based on agentId for targeted messages
        socket.join(`agent:${data.agentId}`);
        if (data.role === 'supervisor') {
            socket.join('supervisors');
        }
    });

    socket.on('message', async (data) => {
        console.log('[WS] Received message:', data.type);

        // Core logic: route by type
        if (data.type === 'ADMIN_BROADCAST') {
            // Persist broadcast
            try {
                const broadcastId = data.id || crypto.randomUUID();
                console.log(`[WS] Persisting broadcast ${broadcastId} from ${data.senderId}`);

                const msg = new Message({
                    _id: broadcastId,
                    senderId: data.senderId,
                    content: data.content,
                    type: 'BROADCAST',
                    timestamp: Date.now()
                });
                await msg.save();
                console.log(`[WS] Broadcast ${broadcastId} saved to database`);

                // Emit to EVERYONE
                io.emit('message', { ...data, id: msg._id });
            } catch (err) {
                console.error('[WS] Broadcast failed to save:', err);
            }
        } else if (data.type === 'HELP_REQUEST' || data.type === 'CHAT_MESSAGE') {
            // Persist private message
            try {
                const msg = new Message({
                    _id: data.id || crypto.randomUUID(), // Use client-provided ID for sync if present
                    senderId: data.senderId,
                    receiverId: data.receiverId,
                    content: data.content,
                    type: data.type === 'HELP_REQUEST' ? 'HELP_REQUEST' : 'CHAT',
                    timestamp: data.timestamp || Date.now()
                });
                await msg.save();

                if (data.type === 'HELP_REQUEST') {
                    // Send to all supervisors EXCEPT the sender
                    socket.to('supervisors').emit('message', { ...data, id: msg._id });
                    // Mirror back to sender
                    socket.emit('message', { ...data, id: msg._id });
                } else if (data.receiverId) {
                    // Direct message to agent room
                    io.to(`agent:${data.receiverId}`).emit('message', { ...data, id: msg._id });
                    // Mirror back to sender
                    socket.emit('message', { ...data, id: msg._id });
                }
            } catch (err) {
                console.error('[WS] Chat failed:', err);
            }
        } else {
            // Standard event mirroring (tickets, status, etc.)
            io.emit('message', data);
        }
    });

    socket.on('ticket:join-room', (data = {}) => {
        const ticketId = String(data.ticketId || '').trim();
        if (!ticketId) return;

        const roomId = `ticket:${ticketId}`;
        socket.join(roomId);
        io.to(roomId).emit('ticket:presence', {
            type: 'ticket:presence',
            ticketId,
            roomId,
            agentId: socket.data.agentId || data.agentId || null,
            role: socket.data.role || data.role || null,
            action: 'joined',
            at: Date.now()
        });
    });

    socket.on('ticket:leave-room', (data = {}) => {
        const ticketId = String(data.ticketId || '').trim();
        if (!ticketId) return;

        const roomId = `ticket:${ticketId}`;
        socket.leave(roomId);
        io.to(roomId).emit('ticket:presence', {
            type: 'ticket:presence',
            ticketId,
            roomId,
            agentId: socket.data.agentId || data.agentId || null,
            role: socket.data.role || data.role || null,
            action: 'left',
            at: Date.now()
        });
    });

    socket.on('ticket:room-message', async (data = {}) => {
        const ticketId = String(data.ticketId || '').trim();
        const content = String(data.content || '').trim();
        if (!ticketId || !content) return;

        const roomId = `ticket:${ticketId}`;
        const payload = {
            type: 'ticket:room-message',
            id: data.id || crypto.randomUUID(),
            ticketId,
            roomId,
            senderId: socket.data.agentId || data.senderId || 'unknown',
            senderRole: socket.data.role || data.senderRole || null,
            content,
            timestamp: Date.now()
        };

        try {
            const msg = new Message({
                _id: payload.id,
                senderId: payload.senderId,
                receiverId: roomId,
                content: payload.content,
                type: 'CHAT',
                timestamp: payload.timestamp
            });
            await msg.save();
        } catch (err) {
            console.error('[WS] ticket:room-message save failed', err);
        }

        io.to(roomId).emit('ticket:room-message', payload);
    });

    socket.on('disconnect', () => {
        console.log('[WS] Connection closed:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`[WS] Socket.io Server listening on port ${PORT}`);
});

