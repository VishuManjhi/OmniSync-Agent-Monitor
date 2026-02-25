import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './components/Login';
import SupervisorDashboard from './components/SupervisorDashboard';
import AgentDashboard from './components/AgentDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import NotificationContainer from './components/ui/Notification';

// Helper component to handle initial landing and role-based redirect
const HomeRedirect: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const target = isAuthenticated
      ? (user?.role === 'supervisor' ? '/supervisor' : '/agent')
      : '/login';

    if (window.location.pathname !== target) {
      console.log(`[Router] Redirecting to ${target} (Auth: ${isAuthenticated})`);
      navigate(target);
    }
  }, [isAuthenticated, user, navigate]);

  return null;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="aurora-bg" />
      <NotificationContainer />
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/supervisor"
          element={
            <ProtectedRoute role="supervisor">
              <SupervisorDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/agent"
          element={
            <ProtectedRoute role="agent">
              <AgentDashboard />
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
