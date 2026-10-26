import React, { useState, useEffect } from 'react';
import {
  Building2, Plus, Send, ExternalLink, RefreshCw, Copy, Check,
  Sparkles, ShieldCheck, Phone, MapPin, Calendar, Clock,
  Smartphone, Monitor, ChevronRight, Store, AlertCircle, CheckCircle2,
  Sliders, MessageSquare
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as api from '../api';

const COLOR_PRESETS = [
  { name: 'Empire Crimson', hex: '#e11d24', niche: 'Dine-in / Non-Veg / Royal' },
  { name: 'Cafe Amber', hex: '#b45309', niche: 'Coffee / Bakery / Bistro' },
  { name: 'Pure Veg Emerald', hex: '#16a34a', niche: 'Pure Veg / South Indian' },
  { name: 'Ocean Royal', hex: '#1e40af', niche: 'Fine Dining / Continental' },
  { name: 'Boutique Violet', hex: '#7c3aed', niche: 'Lounge / Modern Resto-bar' },
  { name: 'Dark Luxe', hex: '#0f172a', niche: 'Steakhouse / Luxury Cafe' },
];

const EMOJI_PRESETS = ['🍽️', '☕', '👨‍🍳', '🍕', '🥗', '🍔', '🧁', '🍜', '🥩', '🍹', '🌮', '🥞'];

export default function SuperAdmin() {
  const [tenants, setTenants] = useState([]);
  const [summary, setSummary] = useState({ total_clients: 0, active_clients: 0, total_mrr: 0 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // Form State for Customizing & Provisioning Software
  const [formData, setFormData] = useState({
    name: '',
    niche: 'Cafe & Bakery',
    primary_color: '#b45309',
    icon_emoji: '☕',
    since_year: '2024',
    tagline: 'Fresh Brews & Artisan Bakes',
    owner_name: '',
    owner_phone: '+91 ',
    plan_name: 'Pro Plan',
    plan_price: 2999,
    months: 1,
    max_tables: 25,
    address: 'Koramangala, Bengaluru',
    custom_slug: '',
  });

  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.getAdminTenants();
      if (res.success) {
        setTenants(res.tenants || []);
        setSummary(res.summary || { total_clients: 0, active_clients: 0, total_mrr: 0 });
      }
    } catch (err) {
      toast.error('Failed to load client directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePlanSelect = (name, price) => {
    setFormData((prev) => ({ ...prev, plan_name: name, plan_price: price }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Please enter restaurant name');
      return;
    }

    try {
      setSaving(true);
      const res = await api.createTenant(formData);
      if (res.success) {
        toast.success(`🎉 Software created for ${res.tenant.name}!`);
        setShowModal(false);
        setFormData({
          name: '',
          niche: 'Cafe & Bakery',
          primary_color: '#b45309',
          icon_emoji: '☕',
          since_year: new Date().getFullYear().toString(),
          tagline: 'Fresh Brews & Delicious Food',
          owner_name: '',
          owner_phone: '+91 ',
          plan_name: 'Pro Plan',
          plan_price: 2999,
          months: 1,
          max_tables: 25,
          address: '',
          custom_slug: '',
        });
        loadData();
      }
    } catch (err) {
      toast.error(err.message || 'Failed to create tenant');
    } finally {
      setSaving(false);
    }
  };

  const handleRenew = async (id, name) => {
    try {
      const res = await api.renewTenantSubscription(id, 30);
      if (res.success) {
        toast.success(`Extended ${name}'s subscription by +30 Days!`);
        loadData();
      }
    } catch (err) {
      toast.error('Failed to renew subscription');
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      const res = await api.toggleTenantStatus(id, nextStatus);
      if (res.success) {
        toast.success(`Client status changed to ${nextStatus.toUpperCase()}`);
        loadData();
      }
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const sendWhatsAppMessage = (tenant) => {
    const origin = window.location.origin;
    const clientAppUrl = `${origin}/r/${tenant.slug}`;
    const tableOrderUrl = `${origin}/r/${tenant.slug}/table/1`;

    const cleanPhone = (tenant.owner_phone || '').replace(/[^0-9]/g, '');

    const message = `🎉 *Hello ${tenant.owner_name || tenant.name}!*\n\n` +
      `Your customized *${tenant.name}* Billing & POS Software is ready to use!\n\n` +
      `💻 *POS & Billing Software Link:*\n${clientAppUrl}\n\n` +
      `📱 *Customer Table QR Ordering Link (Table 1):*\n${tableOrderUrl}\n\n` +
      `🔑 *License Key:* \`${tenant.license_key || 'ACTIVE'}\`\n` +
      `⏳ *Plan:* ${tenant.plan_name} (Active for 30 Days)\n` +
      `🎨 *Theme Color:* Customized to your brand (${tenant.primary_color})\n\n` +
      `⚡ *How to install on your Counter Computer or Tablet:*\n` +
      `1. Open the POS link above in Google Chrome.\n` +
      `2. Click the *'Install App'* button (or click 3 dots ⋮ -> 'Install ${tenant.name}').\n` +
      `3. An icon will appear on your desktop screen. Double-click it anytime to open in full screen without the browser bar!\n\n` +
      `Need any help? We are here for you 24/7!`;

    const whatsappUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="container" style={{ paddingBottom: '60px' }}>
      {/* Top Banner */}
      <div className="card" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#ffffff', border: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, marginBottom: '8px' }}>
              <ShieldCheck size={14} style={{ color: '#38bdf8' }} /> SaaS Vendor Command Hub
            </div>
            <h1 style={{ fontSize: '1.7rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
              Client Software Customizer & Dispatcher
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '6px', maxWidth: '650px' }}>
              You customize the software for each restaurant or cafe (theme, colors, tables, and subscription), and send them their ready-to-use dedicated app link on WhatsApp!
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary"
            style={{
              padding: '12px 24px',
              fontSize: '0.95rem',
              fontWeight: 700,
              boxShadow: '0 8px 24px rgba(225, 29, 36, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Plus size={18} /> Customize & Send Software
          </button>
        </div>

        {/* Quick SaaS Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '10px' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Client Outlets</span>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>{summary.total_clients}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '10px' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Subscriptions</span>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#4ade80', marginTop: '4px' }}>{summary.active_clients}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '10px' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Estimated MRR</span>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>₹{summary.total_mrr?.toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>

      {/* Client Directory Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            Provisioned Restaurants & Cafes ({tenants.length})
          </h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Each client has their own brand colors, table count, and dedicated software link.
          </span>
        </div>
        <button onClick={loadData} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh List
        </button>
      </div>

      {/* Client Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
        {tenants.map((tenant) => {
          const origin = window.location.origin;
          const clientAppUrl = `${origin}/r/${tenant.slug}`;
          const isSuspended = tenant.computed_status === 'suspended';
          const isExpired = tenant.computed_status === 'expired';

          return (
            <div
              key={tenant.id}
              className="card"
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderLeft: `5px solid ${tenant.primary_color || '#e11d24'}`,
                padding: '20px',
              }}
            >
              <div>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        backgroundColor: `${tenant.primary_color}18`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.6rem',
                        border: `1.5px solid ${tenant.primary_color}40`,
                      }}
                    >
                      {tenant.icon_emoji || '🍽️'}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>{tenant.name}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        <span>{tenant.niche || 'Restaurant'}</span>
                        <span>•</span>
                        <span>Est. {tenant.since_year || '2024'}</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={isExpired ? 'badge-cancelled' : isSuspended ? 'badge-preparing' : 'badge-completed'}
                    style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700 }}
                  >
                    {tenant.computed_status}
                  </span>
                </div>

                {/* Tagline / Address */}
                {tenant.tagline && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '12px' }}>
                    "{tenant.tagline}"
                  </p>
                )}

                {/* Details Grid */}
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '12px', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Owner:</span>
                    <span style={{ fontWeight: 600 }}>{tenant.owner_name || 'N/A'} ({tenant.owner_phone || 'No Phone'})</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Subscription:</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      {tenant.plan_name} • ₹{tenant.plan_price?.toLocaleString('en-IN')}/mo
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>License Key:</span>
                    <code style={{ fontSize: '0.72rem', background: '#ffffff', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                      {tenant.license_key || 'ACTIVE'}
                    </code>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Valid Until:</span>
                    <span style={{ fontWeight: 600, color: tenant.days_remaining <= 5 ? '#e11d24' : '#16a34a' }}>
                      {tenant.days_remaining > 0 ? `${tenant.days_remaining} Days Left` : 'Expired'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Theme Accent:</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: tenant.primary_color, display: 'inline-block' }} />
                      {tenant.primary_color}
                    </span>
                  </div>
                </div>

                {/* URL Box */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Client Software POS Link:
                  </label>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    <input
                      type="text"
                      readOnly
                      value={clientAppUrl}
                      className="form-input"
                      style={{ fontSize: '0.78rem', background: '#f8fafc', color: '#0f172a', fontWeight: 600 }}
                    />
                    <button
                      onClick={() => copyToClipboard(clientAppUrl, tenant.id)}
                      className="btn btn-outline"
                      style={{ padding: '0 12px' }}
                      title="Copy URL"
                    >
                      {copiedId === tenant.id ? <Check size={16} color="#16a34a" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Primary WhatsApp Dispatch button */}
                <button
                  onClick={() => sendWhatsAppMessage(tenant)}
                  className="btn"
                  style={{
                    background: '#25D366',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(37, 211, 102, 0.25)',
                  }}
                >
                  <MessageSquare size={16} /> Send Software Link on WhatsApp
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {/* Launch and Test as Restaurant */}
                  <a
                    href={`/r/${tenant.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    <ExternalLink size={14} /> Open POS App
                  </a>

                  {/* Renew +30 Days button */}
                  <button
                    onClick={() => handleRenew(tenant.id, tenant.name)}
                    className="btn btn-outline"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    <Clock size={14} /> +30 Days Renew
                  </button>
                </div>

                {/* Sub status controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
                  <button
                    onClick={() => handleToggleStatus(tenant.id, tenant.computed_status)}
                    style={{ background: 'none', border: 'none', color: isSuspended ? '#16a34a' : '#ef4444', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {isSuspended ? 'Reactivate Client' : 'Suspend Client'}
                  </button>
                  <a
                    href={`/r/${tenant.slug}/table/1`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500 }}
                  >
                    View Guest Table 1 ↗
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Customize & Provision New Restaurant */}
      {showModal && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-card" style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                  Customize & Dispatch Software
                </h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Set up their brand colors, logo emoji, and subscription tier. You send the ready software to them.
                </span>
              </div>
              <button onClick={() => setShowModal(false)} className="btn-close" style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>
                ×
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Row 1: Restaurant Name & Niche */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>Restaurant / Cafe Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Royal Biryani House"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>Establishment Type</label>
                  <select
                    className="form-select"
                    value={formData.niche}
                    onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                  >
                    <option value="Cafe & Bakery">Cafe & Bakery</option>
                    <option value="Dine-in Restaurant">Dine-in Restaurant</option>
                    <option value="Pure Veg Restaurant">Pure Veg Restaurant</option>
                    <option value="Fast Food & Burgers">Fast Food & Burgers</option>
                    <option value="Pizzeria & Italian">Pizzeria & Italian</option>
                    <option value="Bar & Resto-lounge">Bar & Resto-lounge</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Brand Color Presets */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Select Software Theme Accent Color
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '6px' }}>
                  {COLOR_PRESETS.map((p) => {
                    const isSelected = formData.primary_color === p.hex;
                    return (
                      <button
                        type="button"
                        key={p.hex}
                        onClick={() => setFormData({ ...formData, primary_color: p.hex })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: isSelected ? `2px solid ${p.hex}` : '1.5px solid var(--border-primary)',
                          background: isSelected ? `${p.hex}14` : '#ffffff',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: p.hex, display: 'inline-block', flexShrink: 0 }} />
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: isSelected ? p.hex : 'var(--text-primary)', whiteSpace: 'nowrap' }}>{p.name}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{p.niche}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 3: Logo Mascot Emoji & Tagline */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>Brand Mascot Emoji</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                    {EMOJI_PRESETS.map((em) => (
                      <button
                        type="button"
                        key={em}
                        onClick={() => setFormData({ ...formData, icon_emoji: em })}
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '8px',
                          border: formData.icon_emoji === em ? '2px solid var(--accent-primary)' : '1px solid var(--border-primary)',
                          background: formData.icon_emoji === em ? 'var(--empire-red-tint)' : '#ffffff',
                          fontSize: '1.2rem',
                          cursor: 'pointer',
                        }}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>Restaurant Tagline</label>
                  <input
                    type="text"
                    placeholder="e.g. Authentic Taste Since 1998"
                    className="form-input"
                    value={formData.tagline}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  />
                  <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    <input
                      type="text"
                      placeholder="Est. Year (e.g. 2024)"
                      className="form-input"
                      style={{ width: '130px', fontSize: '0.8rem' }}
                      value={formData.since_year}
                      onChange={(e) => setFormData({ ...formData, since_year: e.target.value })}
                    />
                    <input
                      type="number"
                      placeholder="Max Tables (e.g. 25)"
                      className="form-input"
                      style={{ width: '130px', fontSize: '0.8rem' }}
                      value={formData.max_tables}
                      onChange={(e) => setFormData({ ...formData, max_tables: parseInt(e.target.value, 10) || 20 })}
                    />
                  </div>
                </div>
              </div>

              {/* Row 4: Client Owner WhatsApp Phone & Location */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>Owner Name & Phone (for WhatsApp dispatch)</label>
                  <input
                    type="text"
                    placeholder="Owner Name (e.g. Rahul Verma)"
                    className="form-input"
                    value={formData.owner_name}
                    onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                    style={{ marginBottom: '6px' }}
                  />
                  <input
                    type="text"
                    placeholder="+91 98450 12345"
                    className="form-input"
                    value={formData.owner_phone}
                    onChange={(e) => setFormData({ ...formData, owner_phone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>Outlet Address / Location</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. #42, 100ft Road, Indiranagar, Bengaluru"
                    className="form-textarea"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
              </div>

              {/* Row 5: Subscription Plan Pricing Tier */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>Subscription Plan & Duration</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {[
                    { name: 'Starter Plan', price: 1499, desc: '10 Tables • POS & Billing' },
                    { name: 'Pro Plan', price: 2999, desc: '30 Tables • QR Ordering + KOT' },
                    { name: 'Enterprise Plan', price: 5999, desc: 'Unlimited • Priority SLA' },
                  ].map((tier) => {
                    const isSelected = formData.plan_name === tier.name;
                    return (
                      <div
                        key={tier.name}
                        onClick={() => handlePlanSelect(tier.name, tier.price)}
                        style={{
                          border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-primary)',
                          background: isSelected ? 'var(--empire-red-tint)' : '#ffffff',
                          borderRadius: '8px',
                          padding: '10px',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: '0.85rem', fontWeight: 800 }}>{tier.name}</div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                          ₹{tier.price.toLocaleString('en-IN')}<span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>/mo</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{tier.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live Preview Bar */}
              <div
                style={{
                  background: '#f8fafc',
                  border: `2px dashed ${formData.primary_color}`,
                  borderRadius: '12px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: formData.primary_color,
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.4rem',
                    }}
                  >
                    {formData.icon_emoji}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: formData.primary_color }}>
                      {formData.name || 'Your Client Restaurant'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {formData.tagline || 'Customized POS & QR Table Ordering Ready'}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Ready Link:</span>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>
                    /r/{formData.name ? formData.name.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'restaurant-slug'}
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary"
                  style={{
                    padding: '12px 28px',
                    fontWeight: 700,
                    background: formData.primary_color,
                    borderColor: formData.primary_color,
                  }}
                >
                  {saving ? 'Provisioning...' : 'Generate & Save Software'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
