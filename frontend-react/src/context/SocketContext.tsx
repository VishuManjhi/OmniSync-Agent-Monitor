import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { io, Socket } from 'socket.io-client';
import { getQueue, removeFromQueue } from '../api/indexedDB';
import { forceLogout } from '../api/agent';

interface WebSocketContextType {
    lastMessage: any;
    sendMessage: (msg: any) => void;
    isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<any>(null);
    const socketRef = useRef<Socket | null>(null);

    const syncOfflineQueue = async (socket: Socket) => {
        try {
            const queue = await getQueue();
            if (queue.length === 0) return;

            console.log(`[WS] Syncing ${queue.length} offline actions...`);

            for (const action of queue) {
                if (action.type === 'FORCE_LOGOUT') {
                    try {
                        await forceLogout(action.payload.agentId);
                        // Also broadcast via WS so agents react immediately
                        socket.emit('message', { type: 'FORCE_LOGOUT', agentId: action.payload.agentId });
                        await removeFromQueue(action.id);
                        console.log(`[WS] Offline sync success: FORCE_LOGOUT for ${action.payload.agentId}`);
                    } catch (err) {
                        console.error(`[WS] Offline sync failed for action ${action.id}:`, err);
                    }
                }
                // Add more types here as needed
            }
        } catch (err) {
            console.error('[WS] Error during offline sync:', err);
        }
    };

    useEffect(() => {
        if (!user) return;

        const socket = io('http://localhost:8080');

        socket.on('connect', () => {
            console.log('[WS] Connected');
            setIsConnected(true);
            // Identify ourselves to the server
            socket.emit('identify', {
                agentId: user.id,
                role: user.role
            });

            // Sync Offline Queue after a brief delay to allow other clients to reconnect
            setTimeout(() => {
                syncOfflineQueue(socket);
            }, 1000);
        });

        socket.on('message', (data) => {
            setLastMessage(data);
        });

        socket.on('disconnect', () => {
            console.log('[WS] Disconnected');
            setIsConnected(false);
        });

        socketRef.current = socket;

        return () => {
            socket.disconnect();
        };
    }, [user]);

    const sendMessage = (msg: any) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('message', msg);
        }
    };

    return (
        <WebSocketContext.Provider value={{ lastMessage, sendMessage, isConnected }}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => {
    const context = useContext(WebSocketContext);
    if (context === undefined) {
        throw new Error('useWebSocket must be used within a WebSocketProvider');
    }
    return context;
};
