export type AgentRole = 'agent' | 'supervisor';

export interface Agent {
    agentId: string;
    name: string;
    email?: string;
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
    resolvedCount?: number;
    rejectedCount?: number;
    pendingCount?: number;
    approvalCount?: number;
    openCount?: number;
    totalCount?: number;
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

export interface AgentAnalytics {
    ticketHistory: { day: string; raised: number; resolved: number }[];
    sessionHistory: { day: string; onlineTimeHours: number }[];
    breakHistory: Break[];
    overallRatio: { totalRaised: number; totalResolved: number; totalRejected: number };
    avgHandleTime: number;
}

export interface AgentReport {
    period: 'weekly' | 'monthly';
    from: number;
    to: number;
    agent: {
        agentId: string;
        name: string;
        email: string | null;
        status: 'ACTIVE' | 'ON_CALL' | 'ON_BREAK' | 'OFFLINE' | string;
    };
    metrics: {
        totalRaised: number;
        totalResolved: number;
        totalRejected: number;
        attendanceHours: number;
        avgHandleTimeSeconds: number;
        slaPercent: number;
    };
}

export interface AsyncJobItem {
    jobId: string;
    type: 'EXCEL_EXPORT' | 'EMAIL_REPORT' | 'NOTIFICATION' | string;
    status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | string;
    result?: Record<string, unknown> | null;
    error?: string | null;
    attempts?: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface AsyncJobsResponse {
    total: number;
    pages: number;
    currentPage: number;
    items: AsyncJobItem[];
}

export interface SlaBreachResponse {
    hours: number;
    threshold: number;
    total: number;
    pages: number;
    currentPage: number;
    breaches: Ticket[];
}
