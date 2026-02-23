import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { io, Socket } from 'socket.io-client';

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
