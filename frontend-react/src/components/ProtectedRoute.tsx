import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
    role?: 'agent' | 'supervisor';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, role }) => {
    const { isAuthenticated, user } = useAuth();

    if (!isAuthenticated) {
        // Redirect to login if not authenticated
        return <Navigate to="/" replace />;
    }

    if (role && user?.role !== role) {
        // Redirect to their correct dashboard if role doesn't match
        return <Navigate to={user?.role === 'supervisor' ? '/supervisor' : '/agent'} replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;
