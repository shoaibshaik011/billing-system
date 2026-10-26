import React, { useState, useEffect } from 'react';
import { Clock, ChefHat, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import * as api from '../api';

export default function Kitchen() {
  const [kots, setKots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadKots();
    const interval = setInterval(loadKots, 5000); // Auto-refresh every 5s
    return () => clearInterval(interval);
  }, []);

  async function loadKots() {
    try {
      const data = await api.getKots();
      setKots(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id, status) {
    try {
      await api.updateKotStatus(id, status);
      toast.success(`KOT marked as ${status}`);
      loadKots();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const filteredKots = filter === 'all' ? kots : kots.filter((k) => k.status === filter);

  function getTimeSince(dateStr) {
    const now = new Date();
    const created = new Date(dateStr);
    const diff = Math.floor((now - created) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff / 60)}h ${diff % 60}m ago`;
  }

  return (
    <div className="page-content">
      <div className="flex items-center justify-between mb-6">
        <div className="tabs">
          {[
            { id: 'all', label: `All (${kots.length})` },
            { id: 'pending', label: `Pending (${kots.filter((k) => k.status === 'pending').length})` },
            { id: 'preparing', label: `Preparing (${kots.filter((k) => k.status === 'preparing').length})` },
            { id: 'ready', label: `Ready (${kots.filter((k) => k.status === 'ready').length})` },
          ].map((t) => (
            <button key={t.id} className={`tab ${filter === t.id ? 'active' : ''}`}
              onClick={() => setFilter(t.id)}>{t.label}</button>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={loadKots}>↻ Refresh</button>
      </div>

      {filteredKots.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👨‍🍳</div>
          <h3>Kitchen is clear!</h3>
          <p>No pending orders in the kitchen queue</p>
        </div>
      ) : (
        <div className="kot-grid">
          {filteredKots.map((kot) => (
            <div key={kot.id} className={`kot-card ${kot.status} animate-in`}>
              <div className="kot-card-header">
                <div>
                  <div className="kot-number">{kot.kot_number}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    {kot.order_number} {kot.table_number && `• ${kot.table_number}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`badge ${kot.status === 'pending' ? 'badge-warning' : kot.status === 'preparing' ? 'badge-info' : 'badge-success'}`}>
                    {kot.status}
                  </span>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                    <Clock size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                    {getTimeSince(kot.created_at)}
                  </div>
                </div>
              </div>

              <div className="kot-items-list">
                {kot.items.map((item, i) => (
                  <div key={i} className="kot-item">
                    <div className="flex items-center gap-2">
                      <span className={`veg-indicator ${item.is_veg ? 'veg' : 'non-veg'}`} style={{ width: 14, height: 14 }} />
                      <span>{item.name}</span>
                    </div>
                    <div>
                      <span className="qty">×{item.quantity}</span>
                    </div>
                  </div>
                ))}
                {kot.notes && (
                  <div style={{ padding: '8px 0', fontSize: '0.78rem', color: 'var(--accent-warning)', fontStyle: 'italic' }}>
                    📝 {kot.notes}
                  </div>
                )}
              </div>

              <div className="kot-card-footer">
                {kot.status === 'pending' && (
                  <button className="btn btn-primary btn-sm w-full" onClick={() => updateStatus(kot.id, 'preparing')}>
                    <ChefHat size={14} /> Start Preparing
                  </button>
                )}
                {kot.status === 'preparing' && (
                  <button className="btn btn-success btn-sm w-full" onClick={() => updateStatus(kot.id, 'ready')}>
                    <CheckCircle size={14} /> Mark Ready
                  </button>
                )}
                {kot.status === 'ready' && (
                  <button className="btn btn-ghost btn-sm w-full" onClick={() => updateStatus(kot.id, 'completed')}>
                    Done & Clear
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
