export type AgentRole = 'agent' | 'supervisor';

export interface Agent {
    agentId: string;
    name: string;
    role: AgentRole;
    forceLoggedOut?: boolean;
}

export interface Break {
    breakIn: number;
    breakOut: number | null;
}

export interface AgentSession {
    sessionID: string;
    agentId: string;
    clockInTime: number;
    clockOutTime: number | null;
    breaks: Break[];
    onCall: boolean;
    status?: string;
    lastActivity?: number;
    updatedAt?: string;
    createdAt?: string;
}

export interface Attachment {
    attachmentId: string;
    fileName: string;
    type: string;
    size: number;
    content?: string; // Base64
}

export interface Ticket {
    _id: string;
    ticketId: string;
    displayId: string;
    agentId: string;
    issueType: string;
    description: string;
    status: 'OPEN' | 'IN_PROGRESS' | 'ASSIGNED' | 'RESOLUTION_REQUESTED' | 'RESOLVED' | 'REJECTED';
    issueDateTime: number;
    resolvedAt: number | null;
    callDuration?: number | null;
    attachments: Attachment[];
    createdBy?: string;
    assignedBy?: 'SUPERVISOR' | 'SYSTEM';
    resolution?: string;
    startedAt?: number | null;
    resolutionRequestedAt?: number | null;
    rejectionReason?: string | null;
    rejectedAt?: number | null;
    updatedAt?: string;
    createdAt?: string;
}

export interface QueueStats {
    timestamp: number;
    queueDepth: number;
    waitingCalls: number;
    activeAgents: number;
    slaPercent: number;
    avgHandleTime?: number;
}
export interface PaginatedTickets {
    tickets: Ticket[];
    total: number;
    pages: number;
    currentPage: number;
    stats?: {
        totalResolved: number;
        avgHandleTime: number;
    };
}
export interface Message {
    _id: string;
    senderId: string;
    receiverId?: string;
    content: string;
    type: 'BROADCAST' | 'HELP_REQUEST' | 'CHAT';
    timestamp: number;
    isRead: boolean;
    createdAt?: string;
}

export interface Broadcast {
    id: string;
    senderId: string;
    content: string;
    timestamp: number;
}
