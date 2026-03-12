import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/SocketContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    fetchAgents,
    fetchSessions,
    fetchCurrentSession,
    createTicket,
    fetchAgentTickets,
    updateTicket,
    fetchTopSolutions,
    applyTopSolution,
    fetchTicketCollaborators,
    addTicketCollaborator,
    fetchAgent,
    fetchAgentAnalytics
} from '../api/agent';
import type { Ticket, TicketCollaborator } from '../api/types';
import {
    CheckCircle,
    Clock,
    Play,
    AlertTriangle,
    Activity,
    MessageSquare,
    Users,
    Settings,
    LogOut
} from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { useNotification } from '../context/NotificationContext';
import BroadcastBanner from './messaging/BroadcastBanner';
import Modal from './ui/Modal';
import ThemeToggle from './ui/ThemeToggle';
import { useMessaging } from '../context/MessagingContext';

// Modular Components & Hooks
import { useAgentSession } from '../hooks/useAgentSession';
import { styles, getStatusColor } from './dashboard/agent/agentDashboardStyles';
import AgentSideNav from './dashboard/agent/AgentSideNav';
import DashboardOverview from './dashboard/agent/DashboardOverview';
import TicketArchive from './dashboard/agent/TicketArchive';
import CommandCentre from './dashboard/agent/CommandCentrePanel';
import AgentProfile from './dashboard/agent/AgentProfile';
import MetricsTab from './dashboard/agent/MetricsTab';
import { getStaffName } from '../utils/staffDirectory';

type TopSolutionOption = {
    rank: number;
    text: string;
    usageCount: number;
    lastUsedAt: number | null;
    source: 'historical' | 'bootstrap' | string;
};

type RoomInvite = {
    ticketId: string;
    roomName: string;
    fromAgentId: string;
    fromAgentName: string;
    at: number;
};

const ROOM_INVITE_PREFIX = 'ROOM_INVITE::';

const AgentDashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const { lastMessage, sendMessage, sendEvent } = useWebSocket();
    const queryClient = useQueryClient();
    const { showNotification } = useNotification();
    const { messages, sendMessage: sendChatMessage } = useMessaging();

    // UI state
    const [activeView, setActiveView] = useState<'DASHBOARD' | 'TICKETS' | 'COMMAND_CENTRE' | 'PROFILE' | 'CHAT' | 'METRICS'>('COMMAND_CENTRE');
    const [chatTab, setChatTab] = useState<'INTERNAL' | 'ROOM'>('INTERNAL');
    const [chatContent, setChatContent] = useState('');
    const chatScrollRef = React.useRef<HTMLDivElement>(null);

    // Form state
    const [issueType, setIssueType] = useState('');
    const [description, setDescription] = useState('');
    const [callDuration, setCallDuration] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [topSolutionsByTicket, setTopSolutionsByTicket] = useState<Record<string, TopSolutionOption[]>>({});
    const [loadingTopSolutionsFor, setLoadingTopSolutionsFor] = useState<string | null>(null);
    const [topSolutionModalTicketId, setTopSolutionModalTicketId] = useState<string | null>(null);
    const [activeRoomTicketId, setActiveRoomTicketId] = useState<string | null>(null);
    const [activeRoomName, setActiveRoomName] = useState('');
    const [inviteSearch, setInviteSearch] = useState('');
    const [isRoomDetailsOpen, setIsRoomDetailsOpen] = useState(false);
    const [ticketRoomMessageDraft, setTicketRoomMessageDraft] = useState('');
    const [roomMessagesByTicket, setRoomMessagesByTicket] = useState<Record<string, Array<{ id: string; senderId: string; content: string; timestamp: number }>>>({});
    const [collaboratorsByTicket, setCollaboratorsByTicket] = useState<Record<string, TicketCollaborator[]>>({});
    const [roomInvites, setRoomInvites] = useState<RoomInvite[]>([]);

    const [page, setPage] = useState(1);
    const limit = 5;
    const ticketStatusFilter = activeView === 'TICKETS' ? 'ARCHIVE' : activeView === 'COMMAND_CENTRE' ? 'ACTIVE' : 'ALL';

    // Queries
    const { data: agent, isLoading: isLoadingAgent } = useQuery({
        queryKey: ['agent', user?.id],
        queryFn: () => fetchAgent(user!.id),
        enabled: !!user?.id
    });

    const { data: session, isLoading: isLoadingSession } = useQuery({
        queryKey: ['session', user?.id],
        queryFn: () => fetchCurrentSession(user!.id).catch(() => null),
        enabled: !!user?.id
    });

    const { data: ticketsData } = useQuery({
        queryKey: ['tickets', user?.id, page, debouncedSearchTerm, ticketStatusFilter],
        queryFn: () => fetchAgentTickets(user!.id, page, limit, debouncedSearchTerm, ticketStatusFilter),
        enabled: !!user?.id
    });

    const { data: agentAnalytics } = useQuery({
        queryKey: ['agentAnalytics', user?.id],
        queryFn: () => fetchAgentAnalytics(user!.id),
        enabled: !!user?.id && (activeView === 'DASHBOARD' || activeView === 'METRICS'),
        refetchInterval: 30000
    });

    const { data: allAgents = [] } = useQuery({
        queryKey: ['agents-chat-directory'],
        queryFn: fetchAgents,
        enabled: !!user?.id,
        refetchInterval: 15000
    });

    const { data: allSessions = [] } = useQuery({
        queryKey: ['sessions-chat-directory'],
        queryFn: fetchSessions,
        enabled: !!user?.id && activeView === 'CHAT',
        refetchInterval: 10000
    });

    // Custom Hook for Session Management
    const {
        shiftTime,
        deriveStatus,
        handleClockIn,
        handleClockOut,
        handleBreakToggle,
        handleOnCallToggle,
        isSessionLoading
    } = useAgentSession(user?.id, session);

    const currentStatus = deriveStatus(session || null);
    const todayLabel = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
    }).format(new Date());

    // Mutations
    const ticketMutation = useMutation({
        mutationFn: createTicket,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets', user?.id] });
            setIssueType('');
            setDescription('');
            setCallDuration('');
            setAttachment(null);
            showNotification('Ticket submitted successfully', 'success', 'TRANSMISSION SENT');
        },
        onError: (err: unknown) => {
            const message = err instanceof Error ? err.message : 'FAILED TO SUBMIT TICKET';
            showNotification(message, 'error', 'SYSTEM ERROR');
        }
    });

    const updateTicketMutation = useMutation({
        mutationFn: ({ ticketId, updates }: { ticketId: string, updates: Partial<Ticket> }) =>
            updateTicket(ticketId, updates),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['tickets', user?.id] });
            try {
                sendMessage({
                    type: 'TICKET_UPDATED',
                    ticketId: variables.ticketId,
                    updates: variables.updates,
                    agentId: user?.id
                });
            } catch (err) {
                console.warn('Failed to send ticket updated websocket message', err);
            }
        },
        onError: (err: unknown) => {
            const message = err instanceof Error ? err.message : 'FAILED TO UPDATE TICKET';
            showNotification(message, 'error', 'SYSTEM ERROR');
        }
    });

    const applyTopSolutionMutation = useMutation({
        mutationFn: ({ ticketId, solution }: { ticketId: string; solution: string }) => applyTopSolution(ticketId, solution),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tickets', user?.id] });
            showNotification('Solution sent to customer and ticket moved to pending customer.', 'success', 'EMAIL SENT');
        },
        onError: (err: unknown) => {
            const message = err instanceof Error ? err.message : 'FAILED TO APPLY SOLUTION';
            if (/412|inactive|pending approval|postmark/i.test(message)) {
                showNotification('Postmark blocked send for this recipient/domain. Template selection worked, but delivery failed due provider restrictions.', 'warning', 'POSTMARK BLOCKED');
                return;
            }
            showNotification(message, 'error', 'SYSTEM ERROR');
        }
    });

    const addCollaboratorMutation = useMutation({
        mutationFn: ({ ticketId, collaboratorAgentId }: { ticketId: string; collaboratorAgentId: string }) =>
            addTicketCollaborator(ticketId, collaboratorAgentId),
        onSuccess: (result) => {
            setCollaboratorsByTicket((prev) => ({ ...prev, [result.ticketId]: result.collaborators || [] }));
            showNotification('Collaborator added to ticket room.', 'success', 'COLLAB UPDATED');
        },
        onError: (err: unknown) => {
            const message = err instanceof Error ? err.message : 'FAILED TO ADD COLLABORATOR';
            showNotification(message, 'error', 'SYSTEM ERROR');
        }
    });

    // Effects for WebSocket messages
    useEffect(() => {
        if (!lastMessage) return;
        if (lastMessage.type === 'FORCE_LOGOUT' && lastMessage.agentId === user?.id) {
            showNotification('You were force logged out by supervisor', 'warning', 'SESSION TERMINATED');
            logout();
        }
        if ((lastMessage.type === 'TICKET_CREATED' || lastMessage.type === 'TICKET_UPDATED') && lastMessage.agentId === user?.id) {
            queryClient.invalidateQueries({ queryKey: ['tickets', user?.id] });
        }

        if (lastMessage.type === 'CHAT_MESSAGE' && typeof lastMessage.content === 'string' && lastMessage.content.startsWith(ROOM_INVITE_PREFIX)) {
            try {
                const payload = JSON.parse(lastMessage.content.slice(ROOM_INVITE_PREFIX.length));
                const invite: RoomInvite = {
                    ticketId: String(payload.ticketId || ''),
                    roomName: String(payload.roomName || 'Ticket Room'),
                    fromAgentId: String(payload.fromAgentId || lastMessage.senderId || 'Unknown'),
                    fromAgentName: getStaffName(
                        String(payload.fromAgentId || lastMessage.senderId || ''),
                        String(payload.fromAgentName || payload.fromAgentId || lastMessage.senderId || 'Unknown')
                    ),
                    at: Number(payload.at || Date.now())
                };

                if (invite.ticketId && invite.fromAgentId !== user?.id) {
                    setRoomInvites((prev) => {
                        const exists = prev.some((item) => item.ticketId === invite.ticketId && item.fromAgentId === invite.fromAgentId && item.at === invite.at);
                        return exists ? prev : [invite, ...prev].slice(0, 20);
                    });
                }
            } catch {
                // noop
            }
        }

        if (lastMessage.type === 'ticket:room-message' && lastMessage.ticketId) {
            const ticketId = String(lastMessage.ticketId);
            setRoomMessagesByTicket((prev) => ({
                ...prev,
                [ticketId]: [
                    ...(prev[ticketId] || []),
                    {
                        id: String(lastMessage.id || crypto.randomUUID()),
                        senderId: String(lastMessage.senderId || 'unknown'),
                        content: String(lastMessage.content || ''),
                        timestamp: Number(lastMessage.timestamp || Date.now())
                    }
                ].slice(-60)
            }));
        }

        if (lastMessage.type === 'ticket:presence' && lastMessage.ticketId && activeRoomTicketId === String(lastMessage.ticketId)) {
            const joinedAgent = String(lastMessage.agentId || 'Unknown');
            if (joinedAgent && joinedAgent !== user?.id) {
                const action = String(lastMessage.action || 'updated');
                showNotification(`${joinedAgent} ${action} ticket room`, 'info', 'ROOM PRESENCE');
            }
        }
    }, [lastMessage, user, logout, queryClient, showNotification, activeRoomTicketId]);

    // Force Logout check
    useEffect(() => {
        if (!isLoadingAgent && agent?.forceLoggedOut) {
            showNotification('You were force logged out by supervisor', 'warning', 'SESSION TERMINATED');
            logout();
        }
    }, [agent, isLoadingAgent, logout, showNotification]);

    const handleSearchTermChange = (value: string) => {
        setSearchTerm(value);
        setPage(1);
    };

    // Helpers
    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const handleTicketSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !issueType || !description) return;
        if (currentStatus === 'OFFLINE') return;

        const parsedCallDuration = Number(callDuration);
        if (!Number.isFinite(parsedCallDuration) || parsedCallDuration <= 0) {
            showNotification('Call duration is mandatory and must be greater than 0', 'error', 'VALIDATION ERROR');
            return;
        }

        try {
            const ticket: Partial<Ticket> = {
                ticketId: crypto.randomUUID(),
                displayId: `${issueType}-${user.id}-${Math.floor(100 + Math.random() * 899)}`.toUpperCase(),
                agentId: user.id,
                issueType,
                description,
                status: 'IN_PROGRESS',
                issueDateTime: Date.now(),
                startedAt: Date.now(),
                callDuration: parsedCallDuration,
                attachments: []
            };

            if (attachment) {
                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve((reader.result as string).split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(attachment);
                });
                ticket.attachments?.push({
                    attachmentId: crypto.randomUUID(),
                    fileName: attachment.name,
                    type: attachment.type,
                    size: attachment.size,
                    content: base64
                });
            }

            ticketMutation.mutate(ticket);
        } catch {
            showNotification('Failed to process attachment', 'error', 'FILE ERROR');
        }
    };

    const handleTicketUpdate = (ticketId: string, newStatus: string) => {
        const allowedStatuses: Ticket['status'][] = ['OPEN', 'IN_PROGRESS', 'ASSIGNED', 'PENDING_CUSTOMER', 'RESOLUTION_REQUESTED', 'RESOLVED', 'REJECTED'];
        if (!allowedStatuses.includes(newStatus as Ticket['status'])) {
            showNotification('Invalid ticket status', 'error', 'SYSTEM ERROR');
            return;
        }

        updateTicketMutation.mutate({ ticketId, updates: { status: newStatus as Ticket['status'] } });
    };

    const handleLoadTopSolutions = async (ticketId: string) => {
        try {
            setLoadingTopSolutionsFor(ticketId);
            const result = await fetchTopSolutions(ticketId);
            if (!result.solutions?.length) {
                showNotification('No historical solution data found for this ticket yet.', 'warning', 'NO HISTORY');
            }
            const normalizedSolutions: TopSolutionOption[] = (result.solutions || []).map((item, index) => ({
                rank: item.rank ?? index + 1,
                text: item.text,
                usageCount: item.usageCount ?? 0,
                lastUsedAt: typeof item.lastUsedAt === 'number' ? item.lastUsedAt : null,
                source: typeof item.source === 'string' && item.source ? item.source : ((item.usageCount || 0) > 0 ? 'historical' : 'bootstrap')
            }));
            setTopSolutionsByTicket((prev) => ({
                ...prev,
                [ticketId]: normalizedSolutions
            }));
            setTopSolutionModalTicketId(ticketId);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'FAILED TO FETCH TOP SOLUTIONS';
            showNotification(message, 'error', 'SYSTEM ERROR');
        } finally {
            setLoadingTopSolutionsFor(null);
        }
    };

    const handleApplyTopSolution = (ticketId: string, solution: string) => {
        showNotification('Sending selected solution to customer...', 'info', 'EMAIL FLOW');
        applyTopSolutionMutation.mutate({ ticketId, solution });
    };

    const handleOpenTicketRoom = async (ticketId: string) => {
        try {
            const result = await fetchTicketCollaborators(ticketId);
            setCollaboratorsByTicket((prev) => ({ ...prev, [ticketId]: result.collaborators || [] }));
            setActiveRoomTicketId(ticketId);
            const ticket = tickets.find((item: Ticket) => item.ticketId === ticketId);
            setActiveRoomName(ticket?.displayId ? `Room ${ticket.displayId}` : `Room ${ticketId.slice(0, 8).toUpperCase()}`);
            setActiveView('CHAT');
            setChatTab('ROOM');
            sendEvent('ticket:join-room', { ticketId, agentId: user?.id, role: user?.role });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'FAILED TO OPEN TICKET ROOM';
            showNotification(message, 'error', 'SYSTEM ERROR');
        }
    };

    const handleCloseTicketRoom = () => {
        if (activeRoomTicketId) {
            sendEvent('ticket:leave-room', { ticketId: activeRoomTicketId, agentId: user?.id, role: user?.role });
        }
        setActiveRoomTicketId(null);
        setActiveRoomName('');
        setInviteSearch('');
        setIsRoomDetailsOpen(false);
        setTicketRoomMessageDraft('');
    };

    const handleSendRoomMessage = () => {
        if (!activeRoomTicketId || !ticketRoomMessageDraft.trim()) return;
        sendEvent('ticket:room-message', {
            ticketId: activeRoomTicketId,
            content: ticketRoomMessageDraft.trim(),
            senderId: user?.id,
            senderRole: user?.role
        });
        setTicketRoomMessageDraft('');
    };

    const handleAddCollaborator = (ticketId: string, collaboratorAgentId: string) => {
        if (!collaboratorAgentId) return;
        addCollaboratorMutation.mutate({ ticketId, collaboratorAgentId });
    };

    const handleInviteCollaborator = (collaboratorAgentId: string) => {
        if (!activeRoomTicketId || !user?.id) return;

        if (!activeRoomName.trim()) {
            showNotification('Please name the room before sending an invite.', 'warning', 'ROOM SETUP');
            return;
        }

        const normalized = collaboratorAgentId.trim().toLowerCase();
        if (!normalized || normalized === user.id) return;

        handleAddCollaborator(activeRoomTicketId, normalized);

        const payload = {
            ticketId: activeRoomTicketId,
            roomName: activeRoomName || `Room ${activeRoomTicketId.slice(0, 8).toUpperCase()}`,
            fromAgentId: user.id,
            fromAgentName: getStaffName(user.id, agent?.name || user.id),
            at: Date.now()
        };

        sendChatMessage(`${ROOM_INVITE_PREFIX}${JSON.stringify(payload)}`, normalized, 'CHAT_MESSAGE');
        showNotification(`Invite sent to ${normalized}`, 'success', 'ROOM INVITE');
    };

    const handleAcceptInvite = async (invite: RoomInvite) => {
        setActiveView('CHAT');
        setChatTab('ROOM');
        setActiveRoomTicketId(invite.ticketId);
        setActiveRoomName(invite.roomName);

        try {
            const result = await fetchTicketCollaborators(invite.ticketId);
            setCollaboratorsByTicket((prev) => ({ ...prev, [invite.ticketId]: result.collaborators || [] }));
        } catch {
            // noop
        }

        sendEvent('ticket:join-room', { ticketId: invite.ticketId, agentId: user?.id, role: user?.role });
        setRoomInvites((prev) => prev.filter((item) => !(item.ticketId === invite.ticketId && item.at === invite.at && item.fromAgentId === invite.fromAgentId)));
    };

    const closeTopSolutionsModal = () => setTopSolutionModalTicketId(null);

    const handleChatSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatContent.trim()) return;
        sendChatMessage(chatContent, 'SUPERVISORS', 'HELP_REQUEST');
        setChatContent('');
    };

    if (isLoadingAgent || isLoadingSession) {
        return <div style={styles.loading}>INITIALIZING TERMINAL...</div>;
    }

    // Data Extraction
    const tickets = Array.isArray(ticketsData) ? ticketsData : (ticketsData?.tickets || []);
    const totalPages = ticketsData?.pages || (Array.isArray(ticketsData) ? 1 : 0);
    const apiStats = ticketsData?.stats || { totalResolved: 0, avgHandleTime: 0 };

    const filteredTickets = tickets.filter((t: Ticket) => {
        if (activeView === 'COMMAND_CENTRE') return t.status !== 'RESOLVED' && t.status !== 'REJECTED';
        if (activeView === 'TICKETS') return t.status === 'RESOLVED' || t.status === 'REJECTED' || t.status === 'PENDING_CUSTOMER';
        return true;
    });

    const commandCentreTickets = filteredTickets.filter((t: Ticket) => t.status !== 'PENDING_CUSTOMER');
    const emailTickets = commandCentreTickets.filter((t: Ticket) => t.emailMeta?.source === 'inbound_email');
    const normalTickets = commandCentreTickets.filter((t: Ticket) => t.emailMeta?.source !== 'inbound_email');
    const activeRoomTicket = activeRoomTicketId
        ? emailTickets.find((ticket) => ticket.ticketId === activeRoomTicketId) || null
        : null;
    const roomMessages = activeRoomTicketId ? (roomMessagesByTicket[activeRoomTicketId] || []) : [];
    const roomCollaborators = activeRoomTicketId ? (collaboratorsByTicket[activeRoomTicketId] || []) : [];
    const visibleMessages = messages.filter((msg) => !(typeof msg.content === 'string' && msg.content.startsWith(ROOM_INVITE_PREFIX)));
    const activeMembers = roomCollaborators.filter((item) => item.active !== false);
    const roomOwner = activeMembers.find((item) => item.role === 'primary')?.agentId || user?.id || 'Unknown';
    const roomOwnerName = getStaffName(roomOwner, roomOwner);
    const isRoomOwner = !!user?.id && roomOwner === user.id;
    const hasJoinedCollaborator = activeMembers.some((item) => item.agentId !== roomOwner);

    const getSessionStatus = (agentId: string) => {
        const sessionItem = (allSessions || []).find((item) => item.agentId === agentId && !item.clockOutTime);
        if (!sessionItem) return 'OFFLINE';
        const activeBreak = sessionItem.breaks?.find((entry) => !entry.breakOut);
        if (activeBreak) return 'ON_BREAK';
        if (sessionItem.onCall) return 'ON_CALL';
        return 'ACTIVE';
    };

    const inviteCandidates = (allAgents || [])
        .filter((candidate) => candidate.agentId !== user?.id && candidate.role === 'agent')
        .filter((candidate) => {
            const search = inviteSearch.trim().toLowerCase();
            if (!search) return true;
            return candidate.agentId.toLowerCase().includes(search) || (candidate.name || '').toLowerCase().includes(search);
        })
        .slice(0, 8);

    const getAssistedByLabel = (ticket: Ticket) => {
        const primaryId = String(ticket.collaboration?.primaryAgentId || ticket.agentId || '').toLowerCase();
        const collaborators = (ticket.collaboration?.collaborators || [])
            .filter((member) => member.active !== false)
            .filter((member) => String(member.agentId || '').toLowerCase() !== primaryId)
            .map((member) => {
                const agentMeta = allAgents.find((item) => item.agentId === member.agentId);
                return getStaffName(member.agentId, agentMeta?.name || member.agentId);
            });

        return collaborators.length > 0 ? collaborators.join(', ') : '';
    };

    const kpis = [
        { label: 'Resolved Tickets', value: apiStats.totalResolved, icon: <CheckCircle size={20} />, color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
        { label: 'Total Rejected', value: agentAnalytics?.overallRatio?.totalRejected || 0, icon: <AlertTriangle size={20} />, color: 'var(--accent-error)', bg: 'rgba(239,68,68,0.1)' },
        { label: 'Avg Handle Time', value: formatTime(apiStats.avgHandleTime), icon: <Clock size={20} />, color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
        { label: 'Shift Timer', value: formatTime(shiftTime), icon: <Play size={20} />, color: '#facc15', bg: 'rgba(250,204,21,0.1)' },
    ];

    return (
        <div style={styles.appLayout}>
            <AgentSideNav
                activeView={activeView}
                setActiveView={setActiveView}
                agent={agent}
                logout={logout}
            />

            <main style={styles.mainContainer}>
                <header style={styles.topHeader}>
                    <div style={styles.headerTitle}>
                        <h1 style={styles.viewTitle}>{activeView.replace('_', ' ')}</h1>
                        <span style={styles.breadcrumb}>OmniSync / Agent / Workspace</span>
                    </div>
                    <div style={styles.headerActions}>
                        <div style={styles.statusBadge}>
                            <span style={{ ...styles.statusDot, background: getStatusColor(currentStatus) }} />
                            {currentStatus}
                        </div>
                        <div style={styles.statBox}>{todayLabel}</div>
                    </div>
                </header>

                <BroadcastBanner />

                <div style={styles.viewContent}>
                    {activeView === 'DASHBOARD' && (
                        <DashboardOverview kpis={kpis} agentAnalytics={agentAnalytics} />
                    )}

                    {activeView === 'METRICS' && (
                        <MetricsTab agentId={user?.id || ''} agentAnalytics={agentAnalytics} />
                    )}

                    {activeView === 'TICKETS' && (
                        <TicketArchive
                            searchTerm={searchTerm}
                            setSearchTerm={handleSearchTermChange}
                            filteredTickets={filteredTickets}
                            page={page}
                            setPage={setPage}
                            totalPages={totalPages}
                            getAssistedByLabel={getAssistedByLabel}
                        />
                    )}

                    {activeView === 'COMMAND_CENTRE' && (
                        <CommandCentre
                            currentStatus={currentStatus}
                            handleClockIn={handleClockIn}
                            handleClockOut={handleClockOut}
                            handleBreakToggle={handleBreakToggle}
                            handleOnCallToggle={handleOnCallToggle}
                            issueType={issueType}
                            setIssueType={setIssueType}
                            description={description}
                            setDescription={setDescription}
                            callDuration={callDuration}
                            setCallDuration={setCallDuration}
                            handleAttachmentChange={setAttachment}
                            attachment={attachment}
                            handleTicketSubmit={handleTicketSubmit}
                            ticketMutationPending={ticketMutation.isPending}
                            filteredTickets={normalTickets}
                            emailTickets={emailTickets}
                            handleTicketUpdate={handleTicketUpdate}
                            handleLoadTopSolutions={handleLoadTopSolutions}
                            topSolutionsByTicket={topSolutionsByTicket}
                            loadingTopSolutionsFor={loadingTopSolutionsFor}
                            handleApplyTopSolution={handleApplyTopSolution}
                            getAssistedByLabel={getAssistedByLabel}
                            applyTopSolutionPending={applyTopSolutionMutation.isPending}
                            topSolutionModalTicketId={topSolutionModalTicketId}
                            closeTopSolutionsModal={closeTopSolutionsModal}
                            onOpenRoom={handleOpenTicketRoom}
                            isSessionLoading={isSessionLoading}
                        />
                    )}

                    {activeView === 'PROFILE' && (
                        <AgentProfile agent={agent} logout={logout} />
                    )}

                    {activeView === 'CHAT' && (
                        <div style={{ ...styles.dashboardView, height: 'calc(100vh - 200px)' }} className="fade-in">
                            <div className="glass-card" style={{ ...styles.sectionCard, height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <div style={styles.sectionHeader}>
                                    <h3 style={styles.sectionTitle}>Communication</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: '700', color: '#10b981' }}>
                                        <Activity size={14} className="spin" /> CHANNEL ACTIVE
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                    <button
                                        onClick={() => setChatTab('INTERNAL')}
                                        style={{ ...styles.qBtn, ...(chatTab === 'INTERNAL' ? { border: '1px solid var(--accent-yellow)', color: 'var(--accent-yellow)' } : {}) }}
                                    >
                                        Internal Chat
                                    </button>
                                    <button
                                        onClick={() => setChatTab('ROOM')}
                                        style={{ ...styles.qBtn, ...(chatTab === 'ROOM' ? { border: '1px solid var(--accent-yellow)', color: 'var(--accent-yellow)' } : {}) }}
                                    >
                                        Room
                                    </button>
                                </div>

                                {chatTab === 'INTERNAL' ? (
                                    <>
                                        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '12px' }}>
                                            {visibleMessages.length > 0 ? (
                                                visibleMessages.map((msg, i) => (
                                                    <div key={i} style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', alignItems: msg.senderId === user?.id ? 'flex-end' : 'flex-start' }}>
                                                        <div style={{ padding: '10px 14px', borderRadius: '12px', background: msg.senderId === user?.id ? '#2563eb' : '#f1f5f9', color: msg.senderId === user?.id ? '#fff' : '#1e293b', maxWidth: '80%', fontSize: '0.9rem' }}>
                                                            {msg.content}
                                                        </div>
                                                        <span style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '4px', fontWeight: '600' }}>
                                                            {msg.senderId === user?.id ? 'Me' : 'System Agent'} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                ))
                                            ) : (
                                                <div style={styles.emptyView}>
                                                    <MessageSquare size={48} />
                                                    <span>No messages yet. Start a conversation.</span>
                                                </div>
                                            )}
                                            <div ref={chatScrollRef} />
                                        </div>

                                        <form onSubmit={handleChatSubmit} style={{ display: 'flex', gap: '12px', paddingTop: '1.5rem', borderTop: '1px solid #f1f5f9' }}>
                                            <input
                                                value={chatContent}
                                                onChange={(e) => setChatContent(e.target.value)}
                                                placeholder="Describe your issue..."
                                                style={{ ...styles.lightInput, padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}
                                            />
                                            <button type="submit" style={{ ...styles.primaryBtn, width: '120px' }} disabled={!chatContent.trim()}>
                                                Send
                                            </button>
                                        </form>
                                    </>
                                ) : (
                                    <>
                                        <div style={{ display: 'grid', gap: '12px', marginBottom: '12px' }}>
                                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                <Users size={16} color="var(--accent-yellow)" />
                                                <strong style={{ color: 'var(--accent-yellow)' }}>Ticket Room Setup</strong>
                                                <input
                                                    value={activeRoomName}
                                                    onChange={(e) => setActiveRoomName(e.target.value)}
                                                    placeholder="Room name"
                                                    style={{ ...styles.lightInput, maxWidth: '260px' }}
                                                />
                                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {activeRoomTicketId && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsRoomDetailsOpen(true)}
                                                            title="Room settings"
                                                            aria-label="Room settings"
                                                            style={{ ...styles.qBtn, border: '1px solid var(--accent-yellow)', color: 'var(--accent-yellow)', width: '42px', minWidth: '42px', padding: '0.55rem' }}
                                                        >
                                                            <Settings size={16} />
                                                        </button>
                                                    )}
                                                    {activeRoomTicketId && (
                                                        <button
                                                            type="button"
                                                            onClick={handleCloseTicketRoom}
                                                            title="Leave room"
                                                            aria-label="Leave room"
                                                            style={{ ...styles.qBtn, border: '1px solid #ef4444', color: '#ef4444', width: '42px', minWidth: '42px', padding: '0.55rem' }}
                                                        >
                                                            <LogOut size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {roomInvites.length > 0 && (
                                                <div style={{ display: 'grid', gap: '8px' }}>
                                                    {roomInvites.map((invite, index) => (
                                                        <div key={`${invite.ticketId}-${invite.fromAgentId}-${invite.at}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '8px 10px' }}>
                                                            <div style={{ color: 'var(--text-secondary)' }}>
                                                                Invite from <strong>{invite.fromAgentName}</strong> for <strong>{invite.roomName}</strong>
                                                            </div>
                                                            <button onClick={() => handleAcceptInvite(invite)} style={{ ...styles.qBtn, border: '1px solid var(--accent-yellow)', color: 'var(--accent-yellow)', maxWidth: '120px' }}>Join</button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {!activeRoomTicketId ? (
                                                <div style={{ ...styles.emptyView, border: '1px dashed var(--glass-border)', borderRadius: '10px', padding: '12px' }}>
                                                    <span>Open Room from Command Centre to start collaboration.</span>
                                                </div>
                                            ) : null}

                                            {activeRoomTicketId && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    {hasJoinedCollaborator
                                                        ? 'Members have joined. Main room view is now chat-only. Use the settings icon to add more members.'
                                                        : 'Use the settings icon to review room details and invite agents.'}
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.5rem', paddingRight: '12px' }}>
                                            {activeRoomTicketId && roomMessages.length > 0 ? (
                                                <div style={{ marginBottom: '1rem' }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-yellow)', marginBottom: '8px' }}>
                                                        Room Thread • {activeRoomName || activeRoomTicket?.displayId || activeRoomTicketId}
                                                    </div>
                                                    {roomMessages.map((msg) => (
                                                        <div key={msg.id} style={{ marginBottom: '8px' }}>
                                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{msg.senderId} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                            <div style={{ color: 'var(--text-secondary)' }}>{msg.content}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div style={styles.emptyView}>
                                                    <MessageSquare size={48} />
                                                    <span>No room messages yet.</span>
                                                </div>
                                            )}
                                        </div>

                                        <form
                                            onSubmit={(e) => {
                                                e.preventDefault();
                                                handleSendRoomMessage();
                                            }}
                                            style={{ display: 'flex', gap: '12px', paddingTop: '1.5rem', borderTop: '1px solid #f1f5f9' }}
                                        >
                                            <input
                                                value={ticketRoomMessageDraft}
                                                onChange={(e) => setTicketRoomMessageDraft(e.target.value)}
                                                placeholder="Type room note..."
                                                style={{ ...styles.lightInput, padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}
                                            />
                                            <button type="submit" style={{ ...styles.primaryBtn, width: '120px' }} disabled={!activeRoomTicketId || !ticketRoomMessageDraft.trim()}>
                                                Send
                                            </button>
                                        </form>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <Modal
                open={isRoomDetailsOpen}
                onOpenChange={setIsRoomDetailsOpen}
                title="Room Settings"
                footer={
                    <button onClick={() => setIsRoomDetailsOpen(false)} style={{ ...styles.qBtn, border: '1px solid var(--accent-yellow)', color: 'var(--accent-yellow)' }}>
                        Close
                    </button>
                }
            >
                <div style={{ display: 'grid', gap: '12px' }}>
                    <div style={{ display: 'grid', gap: '6px', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '12px' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Room ID: <strong>{activeRoomTicketId || '-'}</strong></div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Owner: <strong>{roomOwnerName}</strong> <span style={{ color: 'var(--text-muted)' }}>({roomOwner})</span></div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Members: <strong>{activeMembers.length || 1}</strong></div>
                    </div>

                    <div style={{ display: 'grid', gap: '8px' }}>
                        <strong style={{ color: 'var(--accent-yellow)' }}>Current Members</strong>
                        <div style={{ display: 'grid', gap: '8px' }}>
                            {activeMembers.length > 0 ? activeMembers.map((member) => (
                                <div key={`${member.agentId}-${member.role}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '8px 10px', background: 'var(--glass-highlight)' }}>
                                    <div style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{getStaffName(member.agentId, member.agentId)}</div>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: member.role === 'primary' ? 'var(--accent-yellow)' : 'var(--text-muted)' }}>
                                        {member.role.toUpperCase()}
                                    </div>
                                </div>
                            )) : <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No active members yet.</div>}
                        </div>
                    </div>

                    {isRoomOwner ? (
                        <div style={{ display: 'grid', gap: '8px' }}>
                            <strong style={{ color: 'var(--accent-yellow)' }}>Add Members</strong>
                            <input
                                value={inviteSearch}
                                onChange={(e) => setInviteSearch(e.target.value)}
                                placeholder="Search agent by id or name"
                                style={{ ...styles.lightInput, width: '100%' }}
                            />
                            <div style={{ display: 'grid', gap: '8px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
                                {inviteCandidates.map((candidate) => {
                                    const status = getSessionStatus(candidate.agentId);
                                    const statusColor = status === 'ACTIVE'
                                        ? '#10b981'
                                        : status === 'ON_CALL'
                                            ? '#3b82f6'
                                            : status === 'ON_BREAK'
                                                ? '#f59e0b'
                                                : '#94a3b8';
                                    return (
                                        <div key={candidate.agentId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '10px 12px', background: 'var(--glass-highlight)' }}>
                                            <div style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{getStaffName(candidate.agentId, candidate.name)}</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: statusColor }}>{status}</span>
                                                <button
                                                    onClick={() => handleInviteCollaborator(candidate.agentId)}
                                                    style={{ ...styles.qBtn, border: '1px solid var(--accent-yellow)', color: 'var(--accent-yellow)', maxWidth: '90px' }}
                                                    disabled={addCollaboratorMutation.isPending}
                                                >
                                                    Invite
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {inviteCandidates.length === 0 && (
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No matching agents found.</div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Only room owner can add members.</div>
                    )}
                </div>
            </Modal>
            <ThemeToggle position={{ bottom: '24px', left: 'auto', right: '24px' }} />
        </div>
    );
};

export default AgentDashboard;
