import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { saveAgentSession } from '../api/agent';
import type { AgentSession } from '../api/types';
import { useWebSocket } from '../context/SocketContext';
import { useNotification } from '../context/NotificationContext';

export const useAgentSession = (userId: string | undefined, session: AgentSession | null | undefined) => {
    const queryClient = useQueryClient();
    const { sendMessage } = useWebSocket();
    const { showNotification } = useNotification();

    const [breakTime, setBreakTime] = useState(0); // seconds
    const [shiftTime, setShiftTime] = useState(0); // seconds

    const deriveStatus = (sess: AgentSession | null) => {
        if (!sess || sess.clockOutTime) return 'OFFLINE';
        const lastBreak = sess.breaks?.at(-1);
        if (lastBreak && !lastBreak.breakOut) return 'ON_BREAK';
        if (sess.onCall) return 'ON_CALL';
        return 'ACTIVE';
    };

    const sessionMutation = useMutation({
        mutationFn: saveAgentSession,
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['session', userId] });
            const status = deriveStatus(variables as AgentSession);
            showNotification(`System status updated to ${status}`, 'success', 'PROTOCOL UPDATED');
            if (userId) {
                sendMessage({
                    type: 'AGENT_STATUS_CHANGE',
                    agentId: userId,
                    status: status.toLowerCase(),
                    session: variables
                });
            }
        },
        onError: (err: any) => {
            showNotification(err.message || 'Failed to sync session with central unit', 'error', 'SYNC ERROR');
        }
    });

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (session && !session.clockOutTime) {
            interval = setInterval(() => {
                const now = Date.now();
                setShiftTime(Math.floor((now - session.clockInTime) / 1000));
                const activeBreak = session.breaks?.find(b => !b.breakOut);
                if (activeBreak) {
                    setBreakTime(Math.floor((now - activeBreak.breakIn) / 1000));
                } else {
                    setBreakTime(0);
                }
            }, 1000);
        } else {
            setShiftTime(0);
            setBreakTime(0);
        }
        return () => clearInterval(interval);
    }, [session]);

    const handleClockIn = async () => {
        if (!userId || (session && !session.clockOutTime) || sessionMutation.isPending) return;
        sessionMutation.mutate({
            sessionID: crypto.randomUUID(),
            agentId: userId,
            clockInTime: Date.now(),
            clockOutTime: null,
            breaks: [],
            onCall: false
        });
    };

    const handleClockOut = async () => {
        if (!userId || sessionMutation.isPending) return;
        const status = deriveStatus(session || null);
        if (status === 'OFFLINE') {
            showNotification('You are already offline.', 'info', 'Session Status');
            return;
        }
        if (status === 'ON_BREAK') {
            showNotification('Please end your break before clocking out.', 'warning', 'Protocol Guard');
            return;
        }
        if (session) {
            sessionMutation.mutate({ ...session, clockOutTime: Date.now() });
        }
    };

    const handleBreakToggle = async () => {
        if (!userId || sessionMutation.isPending) return;
        const status = deriveStatus(session || null);
        if (status === 'OFFLINE') {
            showNotification('You must clock in before managing breaks.', 'warning', 'Protocol Intercept');
            return;
        }
        if (!session) return;
        const updated = { ...session, breaks: [...(session.breaks || [])] };
        if (status === 'ON_BREAK') {
            const activeBreak = updated.breaks.find(b => !b.breakOut);
            if (activeBreak) activeBreak.breakOut = Date.now();
        } else {
            updated.breaks.push({ breakIn: Date.now(), breakOut: null });
        }
        sessionMutation.mutate(updated);
    };

    const handleOnCallToggle = async () => {
        if (!userId || sessionMutation.isPending) return;
        const status = deriveStatus(session || null);
        if (status === 'OFFLINE') {
            showNotification('You must clock in before starting a call.', 'warning', 'Protocol Intercept');
            return;
        }
        if (status === 'ON_BREAK') return;
        if (session) {
            sessionMutation.mutate({ ...session, onCall: !session.onCall });
        }
    };

    return {
        breakTime,
        shiftTime,
        deriveStatus,
        handleClockIn,
        handleClockOut,
        handleBreakToggle,
        handleOnCallToggle,
        isSessionLoading: sessionMutation.isPending
    };
};
