import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IndianRupee, ShoppingCart, TrendingUp, Users,
  ArrowUpRight, Armchair, ChefHat, MapPin, Compass, Clock, Utensils
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from 'recharts';
import * as api from '../api';

const EMPIRE_CHART_COLORS = ['#e11d24', '#f59e0b', '#16a34a', '#0284c7', '#7c3aed', '#ea580c', '#db2777', '#0891b2'];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadDashboard() {
    try {
      const result = await api.getDashboard();
      setData(result);
    } catch (err) {
      console.error('Dashboard load failed:', err);
    } finally {
      setLoading(false);
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

  const { today, paymentBreakdown, topItems, tableStats, revenueTrend, categoryRevenue, hourlySales } = data;

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
      {/* Signature Empire Red Hero Banner */}
      <div className="empire-hero-banner animate-in">
        <h1 className="empire-hero-title">Order Empire Restaurant Online</h1>
        <p className="empire-hero-subtitle">30+ restaurants across India • Serving authentic taste since 1966</p>
        <div className="empire-hero-pills">
          <div className="empire-hero-pill">
            <Compass size={14} />
            <span>Use my location</span>
          </div>
          <div className="empire-hero-pill">
            <MapPin size={14} />
            <span>Jayanagar, Bengaluru ▾</span>
          </div>
          <div className="empire-hero-pill">
            <Clock size={14} />
            <span>Open from 11:00 AM – 1:00 AM</span>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            style={{ borderRadius: 'var(--radius-full)', background: '#ffffff', color: 'var(--empire-red)', fontWeight: 800, marginLeft: 'auto' }}
            onClick={() => navigate('/orders')}
          >
            <Utensils size={14} /> Take New Order
          </button>
        </div>
      </div>

      {/* Filter Row like Empire screenshot */}
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="filter-chip active">Dine In</span>
          <span className="filter-chip">Delivery</span>
          <span className="filter-chip">Pickup</span>
          <span className="filter-chip">Veg Only</span>
          <span className="filter-chip">Open Now</span>
          <span className="filter-chip">Direct Pay</span>
        </div>
        <div className="text-xs text-muted font-semibold">
          Active Outlets: <strong>1 (Jayanagar Flagship)</strong>
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
            <span className="text-xs text-muted">Settled dining & takeaways</span>
          </div>
        </div>

        <div className="stat-card animate-in">
          <div className="stat-icon blue">
            <ShoppingCart size={24} />
          </div>
          <div>
            <span className="stat-card-title">Total Orders</span>
            <div className="stat-card-value">{today?.total_orders || 0}</div>
            <span className="text-xs text-muted">{today?.active_orders || 0} currently active</span>
          </div>
        </div>

        <div className="stat-card animate-in">
          <div className="stat-icon green">
            <TrendingUp size={24} />
          </div>
          <div>
            <span className="stat-card-title">Avg Order Value</span>
            <div className="stat-card-value">₹{Math.round(today?.avg_order_value || 0).toLocaleString('en-IN')}</div>
            <span className="text-xs text-muted">Per bill average</span>
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
                  <linearGradient id="empireRedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e11d24" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#e11d24" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Area type="monotone" dataKey="revenue" stroke="#e11d24" strokeWidth={2.5} fillOpacity={1} fill="url(#empireRedGrad)" />
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
                <Bar dataKey="revenue" fill="#e11d24" radius={[6, 6, 0, 0]} />
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
                    <Cell key={`cell-${index}`} fill={EMPIRE_CHART_COLORS[index % EMPIRE_CHART_COLORS.length]} />
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
                        background: EMPIRE_CHART_COLORS[i % EMPIRE_CHART_COLORS.length],
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
    </div>
  );
}
