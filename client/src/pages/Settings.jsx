import React, { useState, useEffect } from 'react';
import { Save, Store, Receipt, Palette, ShieldCheck, Mail, Phone, MapPin, Sparkles, Check, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import * as api from '../api';
import { applyTheme } from '../theme';

const THEME_PALETTES = [
  { name: 'Empire Crimson', color: '#e11d24', desc: 'Dine-in, Biryani & Mughlai', emoji: '🍗' },
  { name: 'Cafe Amber', color: '#b45309', desc: 'Coffee shops, Cafes & Bakeries', emoji: '☕' },
  { name: 'Pure Veg Emerald', color: '#16a34a', desc: 'Veg Thali, South Indian & Sweets', emoji: '🥗' },
  { name: 'Sapphire Blue', color: '#2563eb', desc: 'Bars, Rooftops & Continental', emoji: '🍸' },
  { name: 'Sunset Orange', color: '#ea580c', desc: 'Pizzerias, Burgers & Fast Food', emoji: '🍕' },
  { name: 'Boutique Purple', color: '#7c3aed', desc: 'Desserts, Lounges & Fine Dining', emoji: '🍰' },
  { name: 'Charcoal Minimal', color: '#334155', desc: 'Modern Minimalist Eateries', emoji: '🍽️' },
];

const EMOJI_OPTIONS = ['👨‍🍳', '☕', '🍕', '🍔', '🥗', '🍛', '🍰', '🥐', '🍗', '🍜', '🍽️', '🍸'];

export default function Settings() {
  const [form, setForm] = useState({
    restaurant_name: '',
    address: '',
    phone: '',
    email: '',
    gst_number: '',
    tax_percentage: 5,
    service_charge_percentage: 0,
    currency_symbol: '₹',
    primary_color: '#e11d24',
    tagline: 'Restaurant & Hotel POS',
    icon_emoji: '👨‍🍳',
    since_year: '1966',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const data = await api.getSettings();
      if (data) {
        setForm((prev) => ({
          ...prev,
          ...data,
          primary_color: data.primary_color || '#e11d24',
          tagline: data.tagline || 'Restaurant & Hotel POS',
          icon_emoji: data.icon_emoji || '👨‍🍳',
          since_year: data.since_year || '1966',
        }));
        applyTheme(data.primary_color || '#e11d24');
      }
    } catch (err) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  function handleColorSelect(color) {
    setForm({ ...form, primary_color: color });
    applyTheme(color);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateSettings(form);
      applyTheme(form.primary_color);
      toast.success('Restaurant profile & theme updated successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-content" style={{ maxWidth: 960, margin: '0 auto' }}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Brand Theme & White-labeling Customizer */}
        <div className="card animate-in">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className="text-primary" size={20} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Custom Theme & Brand Identity</h3>
            </div>
            <span className="badge badge-primary">White-label Ready</span>
          </div>

          <div className="card-body space-y-6">
            {/* Color Palette Selector */}
            <div>
              <label className="text-xs font-semibold text-muted mb-2 block uppercase tracking-wider">
                Select Brand Primary Color
              </label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 12,
                }}
              >
                {THEME_PALETTES.map((theme) => {
                  const isSelected = form.primary_color?.toLowerCase() === theme.color.toLowerCase();
                  return (
                    <div
                      key={theme.name}
                      onClick={() => handleColorSelect(theme.color)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: `2px solid ${isSelected ? theme.color : 'var(--border-primary)'}`,
                        background: isSelected ? `${theme.color}0d` : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: theme.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          flexShrink: 0,
                          boxShadow: isSelected ? `0 0 10px ${theme.color}66` : 'none',
                        }}
                      >
                        {isSelected && <Check size={16} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{theme.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{theme.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Logo Emoji & Established Year */}
            <div className="grid-2">
              <div>
                <label className="text-xs font-semibold text-muted mb-2 block uppercase tracking-wider">
                  Select Mascot / Logo Icon
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setForm({ ...form, icon_emoji: emoji })}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-md)',
                        fontSize: '1.25rem',
                        border: `2px solid ${form.icon_emoji === emoji ? form.primary_color : 'var(--border-primary)'}`,
                        background: form.icon_emoji === emoji ? `${form.primary_color}1a` : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">
                  Year Established / Since
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 1966, 2021"
                  value={form.since_year || ''}
                  onChange={(e) => setForm({ ...form, since_year: e.target.value })}
                />
              </div>
            </div>

            {/* Tagline */}
            <div>
              <label className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">
                Sub-brand Tagline / Description
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Artisan Brews & Bakery • Authentic Taste"
                value={form.tagline || ''}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Restaurant Identity */}
        <div className="card">
          <div className="card-header flex items-center gap-2 mb-4">
            <Store className="text-primary" size={20} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Restaurant Profile</h3>
          </div>
          <div className="card-body space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted mb-1 block">Restaurant / Cafe Name *</label>
              <input
                type="text"
                className="input"
                required
                placeholder="e.g. Blue Tokai Coffee, Sagar Veg"
                value={form.restaurant_name}
                onChange={(e) => setForm({ ...form, restaurant_name: e.target.value })}
              />
            </div>
            <div className="grid-2">
              <div>
                <label className="text-xs font-semibold text-muted mb-1 block">Contact Phone Number</label>
                <input
                  type="tel"
                  className="input"
                  value={form.phone || ''}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted mb-1 block">Email Address</label>
                <input
                  type="email"
                  className="input"
                  value={form.email || ''}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted mb-1 block">Full Address & City</label>
              <textarea
                className="input"
                rows={2}
                value={form.address || ''}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Taxation & Invoicing */}
        <div className="card">
          <div className="card-header flex items-center gap-2 mb-4">
            <Receipt className="text-info" size={20} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Taxation & Billing Rules</h3>
          </div>
          <div className="card-body space-y-4">
            <div className="grid-2">
              <div>
                <label className="text-xs font-semibold text-muted mb-1 block">GSTIN / Tax ID</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 29AAAAA0000A1Z5"
                  value={form.gst_number || ''}
                  onChange={(e) => setForm({ ...form, gst_number: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted mb-1 block">Currency Symbol</label>
                <input
                  type="text"
                  className="input"
                  value={form.currency_symbol || '₹'}
                  onChange={(e) => setForm({ ...form, currency_symbol: e.target.value })}
                />
              </div>
            </div>

            <div className="grid-2">
              <div>
                <label className="text-xs font-semibold text-muted mb-1 block">GST / Tax Rate (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    className="input"
                    value={form.tax_percentage}
                    onChange={(e) => setForm({ ...form, tax_percentage: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="text-muted text-sm font-bold">%</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted mb-1 block">Service Charge (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    className="input"
                    value={form.service_charge_percentage}
                    onChange={(e) => setForm({ ...form, service_charge_percentage: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="text-muted text-sm font-bold">%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            <Save size={18} /> {saving ? 'Saving...' : 'Save & Apply Custom Theme'}
          </button>
        </div>
      </form>
    </div>
  );
}
