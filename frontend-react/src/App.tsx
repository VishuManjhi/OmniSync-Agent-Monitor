import React from 'react';
import { useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/SocketContext';
import Login from './components/Login';
import SupervisorDashboard from './components/SupervisorDashboard';
import AgentDashboard from './components/AgentDashboard';

const App: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return (
      <>
        <div className="aurora-bg" />
        <Login />
      </>
    );
  }

  return (
    <WebSocketProvider>
      <div className="aurora-bg" />
      {user?.role === 'supervisor' ? (
        <SupervisorDashboard />
      ) : (
        <AgentDashboard />
      )}
    </WebSocketProvider>
  );
};

export default App;
