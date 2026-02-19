import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';

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
    const socketRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!user) return;

        const ws = new WebSocket('ws://localhost:8080');

        ws.onopen = () => {
            console.log('[WS] Connected');
            setIsConnected(true);
            // Identify ourselves to the server
            ws.send(JSON.stringify({
                type: 'identify',
                agentId: user.id,
                role: user.role
            }));
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setLastMessage(data);
        };

        ws.onclose = () => {
            console.log('[WS] Disconnected');
            setIsConnected(false);
        };

        socketRef.current = ws;

        return () => {
            ws.close();
        };
    }, [user]);

    const sendMessage = (msg: any) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify(msg));
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
