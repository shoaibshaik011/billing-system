import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const { slug } = useParams();

  if (!isAuthenticated) {
    const loginTarget = slug ? `/r/${slug}/login` : '/login';
    return <Navigate to={loginTarget} replace state={{ from: location }} />;
  }

  return children;
}
