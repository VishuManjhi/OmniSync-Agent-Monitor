export const agentStateMap = new Map();
export const incidentCodeSet = new Set();

export function initialize() {
    agentStateMap.clear();
    incidentCodeSet.clear();
}

export function getAgentState(agentId) {
    return agentStateMap.get(agentId);
}

export function setAgentState(agentId, state) {
    agentStateMap.set(agentId, {
        ...state,
        lastUpdate: Date.now()
    });
}

export function hasIncidentCode(code) {
    return incidentCodeSet.has(code);
}

export function addIncidentCode(code) {
    incidentCodeSet.add(code);
}


