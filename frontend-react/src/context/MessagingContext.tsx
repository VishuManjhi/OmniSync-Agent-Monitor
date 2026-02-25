import React, { createContext, useContext, useState, useEffect } from 'react';
import { useWebSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import type { Message } from '../api/types';

interface MessagingContextType {
    messages: Message[];
    broadcasts: Message[];
    sendMessage: (content: string, receiverId?: string, type?: 'CHAT_MESSAGE' | 'HELP_REQUEST' | 'ADMIN_BROADCAST') => void;
    clearBroadcast: (id: string) => void;
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

export const MessagingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { lastMessage, sendMessage: socketSendMessage } = useWebSocket();
    const { user } = useAuth();
    const { showNotification } = useNotification();
    const [messages, setMessages] = useState<Message[]>([]);
    const [broadcasts, setBroadcasts] = useState<Message[]>([]);

    useEffect(() => {
        if (!lastMessage) return;

        if (lastMessage.type === 'ADMIN_BROADCAST' || lastMessage.type === 'BROADCAST') {
            const newBroadcast: Message = {
                _id: lastMessage.id || crypto.randomUUID(),
                senderId: lastMessage.senderId,
                content: lastMessage.content,
                type: 'BROADCAST',
                timestamp: lastMessage.timestamp || Date.now(),
                isRead: false
            };
            setBroadcasts(prev => [newBroadcast, ...prev]);

            // Notify agent if it's a new broadcast and they are an agent
            if (user?.role === 'agent') {
                showNotification(
                    lastMessage.content.length > 50 ? lastMessage.content.substring(0, 50) + '...' : lastMessage.content,
                    'warning',
                    'SYSTEM BROADCAST'
                );
            }
        } else if (lastMessage.type === 'HELP_REQUEST' || lastMessage.type === 'CHAT_MESSAGE') {
            const msgId = lastMessage.id || lastMessage._id || crypto.randomUUID();

            // Notify supervisor or agent if it's an incoming message
            if (lastMessage.senderId !== user?.id) {
                const isHelp = lastMessage.type === 'HELP_REQUEST';
                const title = user?.role === 'supervisor'
                    ? (isHelp ? `Support SOS: ${lastMessage.senderId}` : `Message from ${lastMessage.senderId}`)
                    : `Message from Supervisor`;

                showNotification(
                    lastMessage.content.length > 40 ? lastMessage.content.substring(0, 40) + '...' : lastMessage.content,
                    isHelp ? 'error' : 'info',
                    title
                );
            }

            setMessages(prev => {
                // Deduplicate if we already added it optimistically
                if (prev.some(m => m._id === msgId)) return prev;

                const newMessage: Message = {
                    _id: msgId,
                    senderId: lastMessage.senderId,
                    receiverId: lastMessage.receiverId,
                    content: lastMessage.content,
                    type: lastMessage.type === 'HELP_REQUEST' ? 'HELP_REQUEST' : 'CHAT',
                    timestamp: lastMessage.timestamp || Date.now(),
                    isRead: false
                };
                return [...prev, newMessage];
            });
        }
    }, [lastMessage]);

    const sendMessage = (content: string, receiverId?: string, type: 'CHAT_MESSAGE' | 'HELP_REQUEST' | 'ADMIN_BROADCAST' = 'CHAT_MESSAGE') => {
        if (!user) return;

        const tempId = crypto.randomUUID();
        const timestamp = Date.now();

        // Optimistic update
        const optimisticMsg: Message = {
            _id: tempId,
            senderId: user.id,
            receiverId,
            content,
            type: type === 'HELP_REQUEST' ? 'HELP_REQUEST' : 'CHAT',
            timestamp,
            isRead: false
        };

        if (type !== 'ADMIN_BROADCAST') {
            setMessages(prev => [...prev, optimisticMsg]);
        }

        socketSendMessage({
            type,
            senderId: user.id,
            receiverId,
            content,
            timestamp,
            id: tempId // Pass our temp ID so server can mirror it back
        });
    };

    const clearBroadcast = (id: string) => {
        setBroadcasts(prev => prev.filter(b => b._id !== id));
    };

    return (
        <MessagingContext.Provider value={{ messages, broadcasts, sendMessage, clearBroadcast }}>
            {children}
        </MessagingContext.Provider>
    );
};

export const useMessaging = () => {
    const context = useContext(MessagingContext);
    if (!context) throw new Error('useMessaging must be used within a MessagingProvider');
    return context;
};
