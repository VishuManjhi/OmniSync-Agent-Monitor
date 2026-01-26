const STORAGE_KEYS = {
    FILTER_STATUS: 'filter_status',
    AGENT_ID: 'current_agent_id'
};
export function saveFilter(key, value) {
    try {
        if (value === null || value === undefined || value === '') {
            sessionStorage.removeItem(key);
        } else {
            sessionStorage.setItem(key, value);
        }
    } catch (error) {
        console.error(`[SessionStorage] Failed to save filter ${key}:`, error);
    }
}
export function getFilter(key) {
    try {
        return sessionStorage.getItem(key);
    } catch (error) {
        console.error(`[SessionStorage] Failed to get filter ${key}:`, error);
        return null;
    }
}
export function getAllFilters() {
    return {
        status: getFilter(STORAGE_KEYS.FILTER_STATUS),
    };
}
export function clearAllFilters() {
    Object.values(STORAGE_KEYS).forEach(key => {
        sessionStorage.removeItem(key);
    });
}

export function setAgentId(agentId) {
    saveFilter(STORAGE_KEYS.AGENT_ID, agentId);
}

export function getAgentId() {
    return getFilter(STORAGE_KEYS.AGENT_ID);
}

export { STORAGE_KEYS };
