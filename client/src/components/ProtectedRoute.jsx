import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, tenantSlug }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const { slug: routeSlug } = useParams();
  const slug = tenantSlug || routeSlug || location.pathname.match(/^\/r\/([^\/]+)/)?.[1] || '';

  if (!isAuthenticated) {
    const loginTarget = slug ? `/r/${slug}/login` : '/login';
    return <Navigate to={loginTarget} replace state={{ from: location }} />;
  }

  // If visiting a specific tenant URL but authenticated as a different tenant (and not superadmin)
  if (slug && user && user.tenant_slug !== slug && user.role !== 'superadmin') {
    const loginTarget = `/r/${slug}/login`;
    return <Navigate to={loginTarget} replace state={{ from: location }} />;
  }

  return children;
}
