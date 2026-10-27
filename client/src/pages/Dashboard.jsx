import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IndianRupee, ShoppingCart, TrendingUp, Users,
  ArrowUpRight, Armchair, ChefHat, MapPin, Compass, Clock, Utensils, Download
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from 'recharts';
import * as api from '../api';
import { applyTheme } from '../theme';

const DEFAULT_CHART_COLORS = ['#f59e0b', '#16a34a', '#0284c7', '#7c3aed', '#ea580c', '#db2777', '#0891b2'];

export default function Dashboard({ tenant }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboard(true);
    const interval = setInterval(() => {
      loadDashboard(false);
    }, 3000); // 3-second live auto-refresh
    return () => clearInterval(interval);
  }, []);

  async function loadDashboard(isInitial = false) {
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);
      const result = await api.getDashboard();
      setData(result);
      const color = tenant?.primary_color || result?.settings?.primary_color;
      if (color) {
        applyTheme(color);
      }
    } catch (err) {
      console.error('Dashboard load failed:', err);
    } finally {
      if (isInitial) setLoading(false);
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="page-content">
        <div className="grid-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card" style={{ height: 110, padding: 20 }} />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { today, paymentBreakdown, topItems, tableStats, revenueTrend, categoryRevenue, hourlySales, settings } = data;

  const currentBrand = tenant || settings;
  const brandColor = currentBrand?.primary_color || '#e11d24';
  const restaurantName = currentBrand?.name || currentBrand?.restaurant_name || 'EMPIRE RESTAURANT';
  const tagline = currentBrand?.tagline || 'Fine Dining, Takeaway & Cloud Kitchen';
  const sinceYear = currentBrand?.since_year || '2024';
  const address = currentBrand?.address || 'Main Branch';
  const brandChartColors = [brandColor, ...DEFAULT_CHART_COLORS];

  const customTooltipStyle = {
    backgroundColor: '#ffffff',
    border: '1.5px solid #e2e8f0',
    borderRadius: 10,
    padding: '10px 14px',
    color: '#0f172a',
    fontSize: '0.82rem',
    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
  };

  return (
    <div className="page-content">
      {/* Signature Hero Banner */}
      <div className="empire-hero-banner animate-in">
        <h1 className="empire-hero-title">
          {restaurantName}
        </h1>
        <p className="empire-hero-subtitle">
          {tagline} • Est. {sinceYear}
        </p>
        <div className="empire-hero-pills">
          <div className="empire-hero-pill">
            <Compass size={14} />
            <span>Outlet POS Live</span>
          </div>
          <div className="empire-hero-pill">
            <MapPin size={14} />
            <span>{address.split(',')[0]}</span>
          </div>
          <div className="empire-hero-pill">
            <Clock size={14} />
            <span>Open for Dining & Delivery</span>
          </div>

          {/* Download Desktop POS App Button */}
          <a
            href={`/api/admin/tenants/${currentBrand?.slug || currentBrand?.tenant_slug || 'mrs-home'}/download-launcher`}
            download
            className="empire-hero-pill"
            style={{
              background: '#ffffff',
              color: brandColor,
              fontWeight: 800,
              textDecoration: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
            title="Download Standalone Desktop POS Launcher App"
          >
            <Download size={14} />
            <span>Download Desktop App</span>
          </a>

          <button
            className="btn btn-secondary btn-sm"
            style={{ borderRadius: 'var(--radius-full)', background: '#ffffff', color: brandColor, fontWeight: 800, marginLeft: 'auto' }}
            onClick={() => navigate(currentBrand?.slug ? `/r/${currentBrand.slug}/orders` : '/orders')}
          >
            <Utensils size={14} /> Take New Order
          </button>
        </div>
      </div>

      {/* Filter Row with Live Auto-Refresh Status */}
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="filter-chip active">Dine In</span>
          <span className="filter-chip">Delivery</span>
          <span className="filter-chip">Pickup</span>
          <span className="filter-chip">Veg Only</span>
          <span className="filter-chip">Open Now</span>
          <span className="filter-chip">Direct Pay</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge-open" style={{ background: '#ecfdf5', color: '#15803d', border: '1px solid #bbf7d0', padding: '3px 10px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
            Live Polling (3s)
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => loadDashboard(false)}
            disabled={refreshing}
            style={{ fontSize: '0.75rem', padding: '3px 10px' }}
          >
            {refreshing ? '↻ Refreshing...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid-4 mb-6">
        <div className="stat-card animate-in">
          <div className="stat-icon red">
            <IndianRupee size={24} />
          </div>
          <div>
            <span className="stat-card-title">Today's Revenue</span>
            <div className="stat-card-value text-primary">₹{(today?.total_revenue || 0).toLocaleString('en-IN')}</div>
            <span className="text-xs text-muted">
              ₹{(today?.settled_revenue || 0).toLocaleString('en-IN')} settled • ₹{(today?.active_revenue || 0).toLocaleString('en-IN')} dining
            </span>
          </div>
        </div>

        <div className="stat-card animate-in">
          <div className="stat-icon blue">
            <ShoppingCart size={24} />
          </div>
          <div>
            <span className="stat-card-title">Total Orders</span>
            <div className="stat-card-value">{today?.total_orders || 0}</div>
            <span className="text-xs text-muted">
              {today?.active_orders || 0} active • {today?.completed_orders || 0} settled
            </span>
          </div>
        </div>

        <div className="stat-card animate-in">
          <div className="stat-icon green">
            <TrendingUp size={24} />
          </div>
          <div>
            <span className="stat-card-title">Avg Order Value</span>
            <div className="stat-card-value">₹{Math.round(today?.avg_order_value || 0).toLocaleString('en-IN')}</div>
            <span className="text-xs text-muted">Per active bill average</span>
          </div>
        </div>

        <div className="stat-card animate-in">
          <div className="stat-icon orange">
            <Armchair size={24} />
          </div>
          <div>
            <span className="stat-card-title">Tables Occupied</span>
            <div className="stat-card-value">
              {tableStats?.occupied || 0} <span className="text-sm text-muted">/ {tableStats?.total_tables || 0}</span>
            </div>
            <span className="text-xs text-muted">{tableStats?.available || 0} tables free</span>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid-2 mb-6">
        {/* Revenue Trend Chart */}
        <div className="card">
          <div className="card-header">
            <h3>📈 7-Day Revenue Trend</h3>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={revenueTrend || []}>
                <defs>
                  <linearGradient id="brandThemeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={brandColor} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={brandColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Area type="monotone" dataKey="revenue" stroke={brandColor} strokeWidth={2.5} fillOpacity={1} fill="url(#brandThemeGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hourly Sales Distribution */}
        <div className="card">
          <div className="card-header">
            <h3>⏰ Hourly Sales Flow</h3>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={hourlySales || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={12} tickFormatter={(h) => `${h}:00`} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Bar dataKey="revenue" fill={brandColor} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid-2 mb-6">
        {/* Category Share */}
        <div className="card">
          <div className="card-header">
            <h3>🍗 Category Sales Breakdown</h3>
          </div>
          <div className="card-body flex items-center justify-between">
            <ResponsiveContainer width="50%" height={220}>
              <PieChart>
                <Pie
                  data={categoryRevenue || []}
                  dataKey="revenue"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {(categoryRevenue || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={brandChartColors[index % brandChartColors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={customTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>

            <div className="space-y-2" style={{ width: '45%' }}>
              {(categoryRevenue || []).slice(0, 5).map((cat, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: brandChartColors[i % brandChartColors.length],
                        display: 'inline-block',
                      }}
                    />
                    <span className="font-semibold">{cat.category || 'Specials'}</span>
                  </div>
                  <span className="font-bold">₹{(cat.revenue || 0).toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Selling Items */}
        <div className="card">
          <div className="card-header">
            <h3>⭐ Signature Best Sellers</h3>
          </div>
          <div className="card-body" style={{ padding: '8px 20px' }}>
            {(!topItems || topItems.length === 0) ? (
              <div className="text-center py-6 text-muted text-sm">No sales recorded yet today</div>
            ) : (
              <div className="space-y-3">
                {topItems.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <div className="flex items-center gap-3">
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          background: i === 0 ? 'var(--empire-red)' : '#f1f5f9',
                          color: i === 0 ? '#ffffff' : 'var(--text-secondary)',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {i + 1}
                      </div>
                      <span className="font-semibold text-sm">{item.item_name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm text-primary">₹{(item.total_revenue || 0).toLocaleString('en-IN')}</div>
                      <span className="text-xs text-muted">{item.total_qty} ordered</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Floor & Counter Activity */}
      {data?.recentOrders && data.recentOrders.length > 0 && (
        <div className="card mt-6">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 style={{ margin: 0 }}>🔴 Live Floor & Counter Orders</h3>
              <span className="badge badge-open" style={{ fontSize: '0.72rem' }}>Real-time</span>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/orders')}>
              View All in POS & Orders ↗
            </button>
          </div>
          <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>Order #</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>Table / Channel</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>Guest Info</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>Bill Amount</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>Payment Preference</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((ord) => {
                  const isOnline = ord.payment_status === 'paid' || ord.payment_preference === 'pay_here';
                  return (
                    <tr
                      key={ord.id}
                      style={{ cursor: 'pointer', borderBottom: '1px solid var(--border-primary)' }}
                      onClick={() => navigate(`/orders?order_id=${ord.id}`)}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 700 }}>{ord.order_number}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {ord.order_source === 'qr_guest' ? (
                          <span
                            style={{
                              background: 'var(--empire-red-tint)',
                              color: 'var(--empire-red)',
                              border: '1px solid var(--empire-red-border)',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 12,
                            }}
                          >
                            📱 Table {ord.table_number || 'QR'}
                          </span>
                        ) : (
                          <span className="badge badge-info">{ord.table_number ? `Table ${ord.table_number}` : 'Counter'}</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.82rem' }}>{ord.guest_name || 'Walk-in Guest'}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        ₹{(ord.total_amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            padding: '3px 10px',
                            borderRadius: 12,
                            background: isOnline ? '#dcfce7' : '#fffbeb',
                            color: isOnline ? '#15803d' : '#b45309',
                            border: `1.5px solid ${isOnline ? '#86efac' : '#fde047'}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {isOnline ? '🟢 Paid Online (UPI) ✓' : '💵 Pay at Counter'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          className={`badge ${
                            ord.status === 'completed'
                              ? 'badge-success'
                              : ord.status === 'active'
                              ? 'badge-open'
                              : 'badge-danger'
                          }`}
                        >
                          {ord.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/orders?order_id=${ord.id}`);
                          }}
                        >
                          Open in POS ↗
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
