import React, { useState, useEffect } from 'react';
import { useParams, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AlertCircle, Clock, ShieldAlert, Phone, ExternalLink } from 'lucide-react';
import * as api from '../api';

import Sidebar from './Sidebar';
import Header from './Header';
import ProtectedRoute from './ProtectedRoute';

import Dashboard from '../pages/Dashboard';
import Tables from '../pages/Tables';
import Orders from '../pages/Orders';
import Kitchen from '../pages/Kitchen';
import Menu from '../pages/Menu';
import Customers from '../pages/Customers';
import Billing from '../pages/Billing';
import QrCodes from '../pages/QrCodes';
import Subscription from '../pages/Subscription';
import Settings from '../pages/Settings';
import Login from '../pages/Login';

export default function TenantLayout() {
  const { slug } = useParams();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    api.getTenantConfig(slug)
      .then((res) => {
        if (res.success && res.tenant) {
          setTenant(res.tenant);
          // Dynamically apply this restaurant's customized brand color
          const color = res.tenant.primary_color || '#e11d24';
          document.documentElement.style.setProperty('--empire-red', color);
          document.documentElement.style.setProperty('--accent-primary', color);
          document.documentElement.style.setProperty('--empire-red-tint', `${color}14`);
          document.documentElement.style.setProperty('--empire-red-border', `${color}35`);
        }
      })
      .catch((err) => {
        setError(err.message || 'Restaurant software not found');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <div className="spin" style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: '#e11d24', borderRadius: '50%' }} />
        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Loading customized software...</span>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div className="card" style={{ maxWidth: '450px', textAlign: 'center', padding: '36px' }}>
          <AlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 8px' }}>Restaurant Software Not Found</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
            We could not find an active software instance configured for slug: <code>{slug}</code>.
          </p>
          <Link to="/admin" className="btn btn-primary" style={{ display: 'inline-block' }}>
            Open SaaS Vendor Hub
          </Link>
        </div>
      </div>
    );
  }

  // Subscription expired or suspended screen
  if (tenant.is_expired || tenant.status === 'suspended') {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '20px' }}>
        <div className="card" style={{ maxWidth: '500px', textAlign: 'center', padding: '40px', borderTop: `6px solid ${tenant.primary_color || '#e11d24'}` }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: `${tenant.primary_color}18`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              margin: '0 auto 16px',
            }}
          >
            {tenant.icon_emoji || '🍽️'}
          </div>

          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 6px', color: 'var(--text-primary)' }}>
            {tenant.name}
          </h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {tenant.tagline || 'Restaurant Billing & POS System'}
          </span>

          <div
            style={{
              marginTop: '24px',
              padding: '16px',
              background: '#fef2f2',
              borderRadius: '12px',
              border: '1px solid #fee2e2',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              textAlign: 'left',
            }}
          >
            <Clock size={28} color="#ef4444" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#991b1b' }}>
                Subscription Inactive / Renewal Required
              </div>
              <div style={{ fontSize: '0.78rem', color: '#b91c1c', marginTop: '2px' }}>
                Your software license ({tenant.license_key || 'ACTIVE'}) has expired or is awaiting monthly renewal.
              </div>
            </div>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '20px', lineHeight: 1.5 }}>
            Please contact your software administrator to extend your subscription and regain immediate access to your billing and orders.
          </p>

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <a
              href={`https://wa.me/?text=Hi%20Software%20Admin,%20please%20renew%20the%20subscription%20for%20${encodeURIComponent(tenant.name)}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
              style={{ background: '#25D366', borderColor: '#25D366', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Phone size={16} /> Contact Support on WhatsApp
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Active software instance routes
  return (
    <Routes>
      {/* Tenant-branded Login route */}
      <Route path="/login" element={<Login tenant={tenant} />} />

      {/* Protected Operations routes */}
      <Route
        path="/*"
        element={
          <ProtectedRoute tenantSlug={slug}>
            <div className="app-layout">
              <Sidebar tenant={tenant} basePath={`/r/${slug}`} />
              <div className="main-content">
                <Header tenant={tenant} />
                <Routes>
                  <Route path="/" element={<Dashboard tenant={tenant} />} />
                  <Route path="/tables" element={<Tables tenant={tenant} />} />
                  <Route path="/orders" element={<Orders tenant={tenant} />} />
                  <Route path="/kitchen" element={<Kitchen tenant={tenant} />} />
                  <Route path="/qr-codes" element={<QrCodes tenant={tenant} />} />
                  <Route path="/menu" element={<Menu tenant={tenant} />} />
                  <Route path="/customers" element={<Customers tenant={tenant} />} />
                  <Route path="/billing" element={<Billing tenant={tenant} />} />
                  <Route path="/subscription" element={<Subscription tenant={tenant} />} />
                  <Route path="/settings" element={<Settings tenant={tenant} />} />
                  <Route path="*" element={<Navigate to={`/r/${slug}`} replace />} />
                </Routes>
              </div>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
