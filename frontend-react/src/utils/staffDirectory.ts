export type StaffDirectoryEntry = {
    id: string;
    name: string;
    role: 'agent' | 'supervisor';
    supervisorId?: string;
    team?: number;
};

// Team structure: sup1 manages agents 1-10 (Team 1), sup2 manages agents 11-20 (Team 2)
export const STAFF_DIRECTORY: Record<string, StaffDirectoryEntry> = {
    // Team 1 - Supervisor: Vishu (sup1)
    a1: { id: 'a1', name: 'Rohan', role: 'agent', supervisorId: 'sup1', team: 1 },
    a2: { id: 'a2', name: 'Priya', role: 'agent', supervisorId: 'sup1', team: 1 },
    a3: { id: 'a3', name: 'Neha', role: 'agent', supervisorId: 'sup1', team: 1 },
    a4: { id: 'a4', name: 'Sameer', role: 'agent', supervisorId: 'sup1', team: 1 },
    a5: { id: 'a5', name: 'Anjali', role: 'agent', supervisorId: 'sup1', team: 1 },
    a6: { id: 'a6', name: 'Vikram', role: 'agent', supervisorId: 'sup1', team: 1 },
    a7: { id: 'a7', name: 'Kavya', role: 'agent', supervisorId: 'sup1', team: 1 },
    a8: { id: 'a8', name: 'Arjun', role: 'agent', supervisorId: 'sup1', team: 1 },
    a9: { id: 'a9', name: 'Diya', role: 'agent', supervisorId: 'sup1', team: 1 },
    a10: { id: 'a10', name: 'Karthik', role: 'agent', supervisorId: 'sup1', team: 1 },
    
    // Team 2 - Supervisor: Aryan (admin)
    a11: { id: 'a11', name: 'Meera', role: 'agent', supervisorId: 'admin', team: 2 },
    a12: { id: 'a12', name: 'Rahul', role: 'agent', supervisorId: 'admin', team: 2 },
    a13: { id: 'a13', name: 'Ishita', role: 'agent', supervisorId: 'admin', team: 2 },
    a14: { id: 'a14', name: 'Aditya', role: 'agent', supervisorId: 'admin', team: 2 },
    a15: { id: 'a15', name: 'Pooja', role: 'agent', supervisorId: 'admin', team: 2 },
    a16: { id: 'a16', name: 'Siddharth', role: 'agent', supervisorId: 'admin', team: 2 },
    a17: { id: 'a17', name: 'Riya', role: 'agent', supervisorId: 'admin', team: 2 },
    a18: { id: 'a18', name: 'Harsh', role: 'agent', supervisorId: 'admin', team: 2 },
    a19: { id: 'a19', name: 'Tanvi', role: 'agent', supervisorId: 'admin', team: 2 },
    a20: { id: 'a20', name: 'Yash', role: 'agent', supervisorId: 'admin', team: 2 },
    
    // Supervisors
    sup1: { id: 'sup1', name: 'Vishu', role: 'supervisor', team: 1 },
    admin: { id: 'admin', name: 'Aryan', role: 'supervisor', team: 2 }
};

export const getStaffProfile = (id?: string | null) => {
    if (!id) return null;
    return STAFF_DIRECTORY[String(id).trim().toLowerCase()] || null;
};

export const getStaffName = (id?: string | null, fallback?: string | null) => {
    const profile = getStaffProfile(id);
    return profile?.name || fallback || id || 'Unknown';
};

export const getSupervisorInfo = (agentId?: string | null) => {
    const profile = getStaffProfile(agentId);
    const supervisorId = profile?.supervisorId;
    if (!supervisorId) return null;
    const supervisor = getStaffProfile(supervisorId);
    return {
        id: supervisorId,
        name: supervisor?.name || supervisorId
    };
};

// Get all agents supervised by a supervisor
export const getTeamMembers = (supervisorId: string) => {
    return Object.values(STAFF_DIRECTORY).filter(
        entry => entry.role === 'agent' && entry.supervisorId === supervisorId
    );
};

// Get team number for an agent or supervisor
export const getTeamNumber = (id?: string | null) => {
    const profile = getStaffProfile(id);
    return profile?.team;
};

// Search staff by name or ID (case-insensitive)
export const searchStaff = (query: string) => {
    const lowerQuery = query.toLowerCase().trim();
    return Object.values(STAFF_DIRECTORY).filter(
        entry => 
            entry.id.toLowerCase().includes(lowerQuery) ||
            entry.name.toLowerCase().includes(lowerQuery)
    );
};
