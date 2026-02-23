import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/SocketContext';
import Login from './components/Login';
import SupervisorDashboard from './components/SupervisorDashboard';
import AgentDashboard from './components/AgentDashboard';
import ProtectedRoute from './components/ProtectedRoute';

// Helper component to handle initial landing and role-based redirect
const HomeRedirect: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    } else {
      navigate(user?.role === 'supervisor' ? '/supervisor' : '/agent');
    }
  }, [isAuthenticated, user, navigate]);

  return null;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="aurora-bg" />
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/supervisor"
          element={
            <ProtectedRoute role="supervisor">
              <WebSocketProvider>
                <SupervisorDashboard />
              </WebSocketProvider>
            </ProtectedRoute>
          }
        />

        <Route
          path="/agent"
          element={
            <ProtectedRoute role="agent">
              <WebSocketProvider>
                <AgentDashboard />
              </WebSocketProvider>
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
