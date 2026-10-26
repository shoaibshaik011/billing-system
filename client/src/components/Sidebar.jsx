import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, UtensilsCrossed, Grid3X3, ShoppingCart,
  ChefHat, Users, Settings, Receipt, QrCode, Sparkles, MapPin
} from 'lucide-react';
import * as api from '../api';

const navItems = [
  { label: 'Operations', isSection: true },
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/tables', label: 'Tables & Floor', icon: Grid3X3 },
  { path: '/orders', label: 'POS & Orders', icon: ShoppingCart },
  { path: '/kitchen', label: 'Kitchen (KOT)', icon: ChefHat },
  { label: 'Guest & Digital', isSection: true },
  { path: '/qr-codes', label: 'Table QR Codes', icon: QrCode },
  { path: '/menu', label: 'Menu & Dishes', icon: UtensilsCrossed },
  { path: '/customers', label: 'Customers CRM', icon: Users },
  { label: 'Business & SaaS', isSection: true },
  { path: '/billing', label: 'Billing & Invoices', icon: Receipt },
  { path: '/subscription', label: 'Software License', icon: Sparkles },
  { path: '/settings', label: 'Outlet Settings', icon: Settings },
];

export default function Sidebar() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    api.getSettings().then((data) => {
      if (data) {
        setSettings(data);
        if (data.primary_color) {
          document.documentElement.style.setProperty('--empire-red', data.primary_color);
          document.documentElement.style.setProperty('--accent-primary', data.primary_color);
        }
      }
    }).catch(() => {});
  }, []);

  const restaurantName = settings?.restaurant_name || 'EMPIRE';
  const iconEmoji = settings?.icon_emoji || '👨‍🍳';
  const sinceYear = settings?.since_year || '1966';
  const tagline = settings?.tagline || 'Restaurant & Hotel POS';

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo-container">
          <span style={{ fontSize: '1.4rem' }}>{iconEmoji}</span>
          <span className="sidebar-logo-badge">{sinceYear}</span>
        </div>
        <div className="sidebar-brand">
          <h1>
            <span className="empire-accent">{restaurantName}</span>
          </h1>
          <span className="sidebar-tagline">{tagline}</span>
        </div>
      </div>

      <div style={{ padding: '10px 14px 4px' }}>
        <div
          className="flex items-center gap-2 p-2 rounded"
          style={{
            background: 'var(--empire-red-tint)',
            border: '1px solid var(--empire-red-border)',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
          }}
        >
          <MapPin size={13} style={{ color: 'var(--empire-red)' }} />
          <span style={{ fontWeight: 600 }}>{settings?.address ? settings.address.split(',')[0] : 'Main Branch'}</span>
          <span className="badge-open" style={{ marginLeft: 'auto', fontSize: '0.65rem', padding: '2px 6px' }}>
            Open
          </span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item, i) => {
          if (item.isSection) {
            return <div key={i} className="nav-section-label">{item.label}</div>;
          }
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              end={item.path === '/'}
            >
              <Icon className="nav-icon" size={19} />
              <span>{item.label}</span>
              {item.path === '/qr-codes' && (
                <span className="badge" style={{ fontSize: '0.65rem', padding: '1px 6px', background: 'var(--empire-red)' }}>
                  New
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div style={{ fontWeight: 700, color: 'var(--empire-red)', marginBottom: 2 }}>
          {restaurantName}
        </div>
        <span>Since {sinceYear} • POS v2.4 SaaS</span>
      </div>
    </aside>
  );
}
