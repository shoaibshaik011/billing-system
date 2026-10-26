import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import TenantLayout from './components/TenantLayout';

import Dashboard from './pages/Dashboard';
import Tables from './pages/Tables';
import Orders from './pages/Orders';
import Kitchen from './pages/Kitchen';
import Menu from './pages/Menu';
import Customers from './pages/Customers';
import Billing from './pages/Billing';
import QrCodes from './pages/QrCodes';
import Subscription from './pages/Subscription';
import Settings from './pages/Settings';
import GuestOrder from './pages/GuestOrder';
import SuperAdmin from './pages/SuperAdmin';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Guest Mobile Table QR Ordering App (Standalone, full-screen mobile friendly) */}
        <Route path="/table/:tableNumber" element={<GuestOrder />} />
        <Route path="/r/:slug/table/:tableNumber" element={<GuestOrder />} />

        {/* Master SaaS Vendor Hub / Client Customizer & Dispatcher */}
        <Route
          path="/admin"
          element={
            <div className="app-layout">
              <Sidebar />
              <div className="main-content">
                <Header />
                <SuperAdmin />
              </div>
            </div>
          }
        />

        {/* Customized Client Restaurant Software Instance (Multi-tenant via slug) */}
        <Route path="/r/:slug/*" element={<TenantLayout />} />

        {/* Default Restaurant Operations & SaaS POS Management */}
        <Route
          path="/*"
          element={
            <div className="app-layout">
              <Sidebar />
              <div className="main-content">
                <Header />
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/tables" element={<Tables />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/kitchen" element={<Kitchen />} />
                  <Route path="/qr-codes" element={<QrCodes />} />
                  <Route path="/menu" element={<Menu />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/billing" element={<Billing />} />
                  <Route path="/subscription" element={<Subscription />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </div>
          }
        />
      </Routes>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#ffffff',
            color: 'var(--text-primary)',
            border: '1.5px solid var(--border-primary)',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: 600,
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
          },
        }}
      />
    </BrowserRouter>
  );
}
