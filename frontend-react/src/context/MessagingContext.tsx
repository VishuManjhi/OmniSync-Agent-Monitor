import React, { createContext, useContext, useState, useEffect } from 'react';
import { useWebSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import { fetchBroadcasts } from '../api/agent';
import type { Message } from '../api/types';

interface MessagingContextType {
    messages: Message[];
    broadcasts: Message[];
    sendMessage: (content: string, receiverId?: string, type?: 'CHAT_MESSAGE' | 'HELP_REQUEST' | 'ADMIN_BROADCAST') => void;
    clearBroadcast: (id: string) => void;
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

export const useMessaging = () => {
    const context = useContext(MessagingContext);
    if (!context) throw new Error('useMessaging must be used within a MessagingProvider');
    return context;
};

export const MessagingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { lastMessage, sendMessage: socketSendMessage } = useWebSocket();
    const { user } = useAuth();
    const { showNotification } = useNotification();
    const [messages, setMessages] = useState<Message[]>([]);
    const [broadcasts, setBroadcasts] = useState<Message[]>([]);
    const sentMessageIds = React.useRef<Set<string>>(new Set());

    // Initial load: Fetch past broadcasts
    useEffect(() => {
        if (!user) {
            setBroadcasts([]);
            return;
        }

        const loadHistory = async () => {
            try {
                const history = await fetchBroadcasts();
                const dismissed = JSON.parse(localStorage.getItem('dismissed_broadcasts') || '[]');
                // Only keep broadcasts NOT in the dismissed list
                const visible = history.filter((b: Message) => !dismissed.includes(b._id));
                setBroadcasts(visible);
            } catch (err) {
                console.error('Failed to load broadcast history:', err);
            }
        };
        loadHistory();
    }, [user]);

    useEffect(() => {
        if (!lastMessage) return;

        const msgId = lastMessage.id || lastMessage._id || lastMessage.tempId;
        const isFromMe = sentMessageIds.current.has(msgId) || lastMessage.senderId === user?.id;

        if (lastMessage.type === 'ADMIN_BROADCAST' || lastMessage.type === 'BROADCAST') {
            const broadcastId = msgId || crypto.randomUUID();

            setBroadcasts(prev => {
                if (prev.some(b => b._id === broadcastId)) return prev;

                const newBroadcast: Message = {
                    _id: broadcastId,
                    senderId: lastMessage.senderId,
                    content: lastMessage.content,
                    type: 'BROADCAST',
                    timestamp: lastMessage.timestamp || Date.now(),
                    isRead: false
                };
                return [newBroadcast, ...prev];
            });

        } else if (lastMessage.type === 'HELP_REQUEST' || lastMessage.type === 'CHAT_MESSAGE') {
            // Notify supervisor or agent if it's an incoming message
            if (!isFromMe) {
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
    }, [lastMessage, user, showNotification]);

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
            id: tempId
        });
        sentMessageIds.current.add(tempId);
    };

    const clearBroadcast = (id: string) => {
        setBroadcasts(prev => prev.filter(b => b._id !== id));
        // Persist dismissal to localStorage
        const dismissed = JSON.parse(localStorage.getItem('dismissed_broadcasts') || '[]');
        if (!dismissed.includes(id)) {
            localStorage.setItem('dismissed_broadcasts', JSON.stringify([...dismissed, id]));
        }
    };

    return (
        <MessagingContext.Provider value={{ messages, broadcasts, sendMessage, clearBroadcast }}>
            {children}
        </MessagingContext.Provider>
    );
};

