import React, { useState, useEffect } from 'react';
import { Save, Store, Receipt, Percent, ShieldCheck, Mail, Phone, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import * as api from '../api';

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
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const data = await api.getSettings();
      if (data) setForm(data);
    } catch (err) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateSettings(form);
      toast.success('Restaurant settings updated successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-content" style={{ maxWidth: 900 }}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Restaurant Identity */}
        <div className="card">
          <div className="card-header flex items-center gap-2 mb-4">
            <Store className="text-primary" size={20} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Restaurant Profile</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted mb-1 block">Restaurant / Hotel Name *</label>
              <input
                type="text"
                className="input"
                required
                value={form.restaurant_name}
                onChange={(e) => setForm({ ...form, restaurant_name: e.target.value })}
              />
            </div>
            <div className="grid-2">
              <div>
                <label className="text-xs font-semibold text-muted mb-1 block">Contact Phone Number</label>
                <div className="relative">
                  <input
                    type="tel"
                    className="input"
                    value={form.phone || ''}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
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
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Taxation & Billing Rules</h3>
          </div>
          <div className="space-y-4">
            <div className="grid-2">
              <div>
                <label className="text-xs font-semibold text-muted mb-1 block">GSTIN / Tax Identification Number</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 27AAAAA0000A1Z5"
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
                <span className="text-xs text-muted">Applied to all dining and takeaway orders</span>
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
                <span className="text-xs text-muted">Optional restaurant service fee</span>
              </div>
            </div>
          </div>
        </div>

        {/* Commercial Selling Info */}
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.08))',
            borderColor: 'rgba(99, 102, 241, 0.3)',
          }}
        >
          <div className="card-header flex items-center gap-2 mb-2">
            <ShieldCheck className="text-primary" size={20} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Commercial Distribution & White-labeling</h3>
          </div>
          <p className="text-sm text-muted mb-4">
            This BillFlow hotel billing software is designed for multi-tenant and standalone restaurant deployments. You can re-brand this for any hotel or restaurant client by configuring their business profile above.
          </p>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="badge badge-success">✓ Unlimited Tables & KOTs</span>
            <span className="badge badge-success">✓ Offline-first SQLite Engine</span>
            <span className="badge badge-success">✓ Thermal Printer Ready</span>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            <Save size={16} /> {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
}
