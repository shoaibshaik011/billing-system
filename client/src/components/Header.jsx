import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Clock, Search, ShoppingBag, Mic, User, LogOut, ShoppingCart, ShieldCheck, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';

const pageTitles = {
  '/': { title: 'Dashboard', subtitle: 'Live Outlet Sales & Analytics' },
  '/tables': { title: 'Table Management', subtitle: 'Floor Plan & Seating Occupancy' },
  '/orders': { title: 'POS Billing', subtitle: 'Active Orders, Takeaway & Delivery' },
  '/kitchen': { title: 'Kitchen Display (KDS)', subtitle: 'Real-time KOT Tickets' },
  '/qr-codes': { title: 'Table QR Code Generator', subtitle: 'Print Table Stand Cards for Mobile Ordering' },
  '/menu': { title: 'Menu Management', subtitle: 'Dishes, Pricing & Availability' },
  '/customers': { title: 'Customer CRM', subtitle: 'Guest Directory & Loyalty' },
  '/billing': { title: 'Billing & Invoices', subtitle: 'Tax Invoices & Daily Settlement' },
  '/subscription': { title: 'Software Subscription & SaaS Licensing', subtitle: 'Commercial Plans, License Keys & Reseller MRR' },
  '/settings': { title: 'Outlet Settings', subtitle: 'Empire Branch Profile & GST' },
  '/admin': { title: 'SaaS Vendor Command Hub', subtitle: 'White-Label Client Customizer & WhatsApp Dispatcher' },
};

export default function Header({ tenant }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();

  // Handle route matching for titles
  const cleanPath = location.pathname.replace(/^\/r\/[^/]+/, '') || '/';
  const page = pageTitles[cleanPath] || {
    title: tenant?.name ? `${tenant.name} POS` : 'Restaurant POS',
    subtitle: 'Terminal Operations',
  };

  const [time, setTime] = useState(new Date());
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadActiveOrders();
    const interval = setInterval(loadActiveOrders, 15000);
    return () => clearInterval(interval);
  }, []);

  async function loadActiveOrders() {
    try {
      const orders = await api.getOrders({ status: 'active' });
      setActiveOrdersCount(orders.length);
    } catch (err) {
      // ignore
    }
  }

  const handleLogout = () => {
    logout();
    toast.success('Terminal locked successfully');
    const slug = location.pathname.match(/^\/r\/([^/]+)/)?.[1];
    navigate(slug ? `/r/${slug}/login` : '/login');
  };

  return (
    <header className="header">
      <div className="header-left">
        <div>
          <h2>{page.title}</h2>
          <p>{page.subtitle}</p>
        </div>
      </div>

      <div className="header-right">
        {/* Quick Search Pill */}
        <div className="search-bar" style={{ minWidth: 240 }}>
          <Search size={16} className="text-muted" />
          <input
            type="text"
            placeholder="Search dishes, bills, tables..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') navigate('/orders');
            }}
          />
          <Mic size={16} style={{ color: 'var(--empire-red)', cursor: 'pointer' }} />
        </div>

        {/* Live Clock */}
        <div className="flex items-center gap-2" style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
          <Clock size={15} />
          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        {/* Download Standalone Desktop App Launcher */}
        <a
          href={`/api/admin/tenants/${tenant?.slug || 'mrs-home'}/download-launcher`}
          download
          className="btn btn-outline"
          style={{
            borderRadius: 'var(--radius-full)',
            padding: '6px 14px',
            fontSize: '0.78rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            textDecoration: 'none',
            color: 'var(--text-primary)',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-primary)',
          }}
          title="Download Desktop POS App Launcher"
        >
          <Download size={14} color="var(--empire-red)" />
          <span>Download App</span>
        </a>

        {/* Active Orders Quick Button */}
        <button
          className="btn btn-primary"
          style={{ borderRadius: 'var(--radius-full)', padding: '7px 16px' }}
          onClick={() => navigate(tenant ? `/r/${tenant.slug}/orders` : '/orders')}
        >
          <ShoppingCart size={16} />
          <span>Active</span>
          {activeOrdersCount > 0 && (
            <span
              style={{
                background: '#ffffff',
                color: 'var(--empire-red)',
                borderRadius: '50%',
                width: 18,
                height: 18,
                fontSize: '0.72rem',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 2,
              }}
            >
              {activeOrdersCount}
            </span>
          )}
        </button>

        {/* Staff Profile & Lock/Logout Button */}
        {isAuthenticated && user ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '4px 6px 4px 12px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-primary)',
              borderRadius: '30px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>{user.avatar || '👨‍🍳'}</span>
              <div style={{ textAlign: 'left', lineHeight: 1.1 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {user.name}
                </div>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: user.role === 'admin' ? 'var(--empire-red)' : user.role === 'superadmin' ? '#7c3aed' : '#16a34a',
                  }}
                >
                  {user.role}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="btn btn-outline"
              title="Lock Terminal / Sign Out"
              style={{
                width: '32px',
                height: '32px',
                padding: 0,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#ffffff',
              }}
            >
              <LogOut size={14} color="#ef4444" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="btn btn-outline"
            style={{ fontSize: '0.82rem', fontWeight: 700 }}
          >
            Sign In
          </button>
        )}
      </div>
    </header>
  );
}
