import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Clock, Search, ShoppingBag, Mic, User, Compass, ShoppingCart } from 'lucide-react';
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
};

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const page = pageTitles[location.pathname] || { title: 'Empire POS', subtitle: '' };
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

  return (
    <header className="header">
      <div className="header-left">
        <div>
          <h2>{page.title}</h2>
          <p>{page.subtitle}</p>
        </div>
      </div>

      <div className="header-right">
        {/* Quick Search Pill like Empire website */}
        <div className="search-bar" style={{ minWidth: 280 }}>
          <Search size={16} className="text-muted" />
          <input
            type="text"
            placeholder="Search items, KOT, tables..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') navigate('/orders');
            }}
          />
          <Mic size={16} style={{ color: 'var(--empire-red)', cursor: 'pointer' }} />
        </div>

        {/* Live Status Pill */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', fontSize: '0.78rem' }}
        >
          <span className="badge-open" style={{ padding: 0, border: 'none' }}>
            Open
          </span>
          <span style={{ color: '#15803d', fontWeight: 600 }}>11:00 AM – 1:00 AM</span>
        </div>

        {/* Live Clock */}
        <div className="flex items-center gap-2" style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
          <Clock size={15} />
          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        {/* Empire Cart / Active Orders Red Button */}
        <button
          className="btn btn-primary"
          style={{ borderRadius: 'var(--radius-full)', padding: '7px 16px' }}
          onClick={() => navigate('/orders')}
        >
          <ShoppingCart size={16} />
          <span>Active Orders</span>
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
      </div>
    </header>
  );
}
