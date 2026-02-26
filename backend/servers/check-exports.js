import express from 'express';
import authRoutes from '../routes/authRoutes.js';
import agentRoutes from '../routes/agentRoutes.js';
import sessionRoutes from '../routes/sessionRoutes.js';
import ticketRoutes from '../routes/ticketRoutes.js';
import analyticsRoutes from '../routes/analyticsRoutes.js';
import supervisorRoutes from '../routes/supervisorRoutes.js';
import broadcastRoutes from '../routes/broadcastRoutes.js';
import fileRoutes from '../routes/fileRoutes.js';
import errorHandler from '../middleware/errorHandler.js';

const checks = [
    { name: 'authRoutes', val: authRoutes },
    { name: 'agentRoutes', val: agentRoutes },
    { name: 'sessionRoutes', val: sessionRoutes },
    { name: 'ticketRoutes', val: ticketRoutes },
    { name: 'analyticsRoutes', val: analyticsRoutes },
    { name: 'supervisorRoutes', val: supervisorRoutes },
    { name: 'broadcastRoutes', val: broadcastRoutes },
    { name: 'fileRoutes', val: fileRoutes },
    { name: 'errorHandler', val: errorHandler }
];

checks.forEach(c => {
    if (typeof c.val !== 'function') {
        console.log(`❌ ${c.name} is NOT a function/router! (type: ${typeof c.val})`);
    } else {
        console.log(`✅ ${c.name} is OK`);
    }
});
