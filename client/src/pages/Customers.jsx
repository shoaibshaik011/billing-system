import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Phone, Mail, MapPin, Award, X, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';
import * as api from '../api';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' });

  useEffect(() => {
    loadCustomers();
  }, [search]);

  async function loadCustomers() {
    try {
      const data = await api.getCustomers(search);
      setCustomers(data);
    } catch (err) {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editingCustomer) {
        await api.updateCustomer(editingCustomer.id, form);
        toast.success('Customer updated');
      } else {
        await api.createCustomer(form);
        toast.success('Customer added');
      }
      setShowModal(false);
      setEditingCustomer(null);
      setForm({ name: '', phone: '', email: '', address: '', notes: '' });
      loadCustomers();
    } catch (err) {
      toast.error(err.message || 'Operation failed');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this customer?')) return;
    try {
      await api.deleteCustomer(id);
      toast.success('Customer deleted');
      if (selectedCustomer?.id === id) setSelectedCustomer(null);
      loadCustomers();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function viewCustomerDetails(customer) {
    try {
      const details = await api.getCustomer(customer.id);
      setSelectedCustomer(details);
    } catch (err) {
      setSelectedCustomer(customer);
    }
  }

  return (
    <div className="page-content">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="search-bar" style={{ maxWidth: 360, width: '100%' }}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingCustomer(null);
            setForm({ name: '', phone: '', email: '', address: '', notes: '' });
            setShowModal(true);
          }}
        >
          <Plus size={16} /> Add Customer
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedCustomer ? '1fr 380px' : '1fr', gap: '20px' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact</th>
                <th>Address</th>
                <th>Visits</th>
                <th>Total Spent</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
                    No customers found
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => viewCustomerDetails(c)}
                    style={{
                      cursor: 'pointer',
                      background: selectedCustomer?.id === c.id ? 'var(--bg-elevated)' : 'transparent',
                    }}
                  >
                    <td>
                      <div className="flex items-center gap-2">
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-purple))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            color: '#fff',
                            fontSize: '0.85rem',
                          }}
                        >
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{c.name}</div>
                          {c.notes && <div className="text-xs text-muted">{c.notes}</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="text-sm">
                        {c.phone && <div className="flex items-center gap-1"><Phone size={12} className="text-muted" /> {c.phone}</div>}
                        {c.email && <div className="flex items-center gap-1 text-muted text-xs"><Mail size={12} /> {c.email}</div>}
                      </div>
                    </td>
                    <td>
                      <span className="text-muted text-sm">{c.address || '—'}</span>
                    </td>
                    <td>
                      <span className="badge badge-primary">{c.total_visits || 0} visits</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: 'var(--accent-success)' }}>
                        ₹{(c.total_spent || 0).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setEditingCustomer(c);
                            setForm({
                              name: c.name,
                              phone: c.phone || '',
                              email: c.email || '',
                              address: c.address || '',
                              notes: c.notes || '',
                            });
                            setShowModal(true);
                          }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm text-danger"
                          onClick={() => handleDelete(c.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {selectedCustomer && (
          <div className="card animate-in" style={{ height: 'fit-content' }}>
            <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: '1px solid var(--border-primary)' }}>
              <div className="flex items-center gap-3">
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1.2rem',
                    color: '#fff',
                  }}
                >
                  {selectedCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{selectedCustomer.name}</h3>
                  <span className="text-xs text-muted">Customer #{selectedCustomer.id}</span>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedCustomer(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-sm mb-6">
              {selectedCustomer.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-muted" />
                  <span>{selectedCustomer.phone}</span>
                </div>
              )}
              {selectedCustomer.email && (
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-muted" />
                  <span>{selectedCustomer.email}</span>
                </div>
              )}
              {selectedCustomer.address && (
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-muted" />
                  <span>{selectedCustomer.address}</span>
                </div>
              )}
            </div>

            <div className="grid-2 mb-6">
              <div className="stat-card" style={{ padding: 12 }}>
                <span className="stat-card-title text-xs">Total Visits</span>
                <span className="stat-card-value" style={{ fontSize: '1.2rem' }}>{selectedCustomer.total_visits || 0}</span>
              </div>
              <div className="stat-card" style={{ padding: 12 }}>
                <span className="stat-card-title text-xs">Total Spent</span>
                <span className="stat-card-value text-success" style={{ fontSize: '1.2rem' }}>
                  ₹{(selectedCustomer.total_spent || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 12 }} className="flex items-center gap-2">
              <ShoppingBag size={16} /> Order History
            </h4>
            <div className="space-y-2" style={{ maxHeight: 250, overflowY: 'auto' }}>
              {!selectedCustomer.recent_orders || selectedCustomer.recent_orders.length === 0 ? (
                <div className="text-xs text-muted text-center py-4">No recent orders</div>
              ) : (
                selectedCustomer.recent_orders.map((ord) => (
                  <div
                    key={ord.id}
                    className="flex items-center justify-between p-2 rounded"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-secondary)' }}
                  >
                    <div>
                      <div className="font-semibold text-xs">{ord.order_number}</div>
                      <div className="text-xs text-muted">
                        Table {ord.table_number || 'Takeaway'} • {new Date(ord.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-xs">₹{ord.total_amount?.toLocaleString('en-IN')}</div>
                      <span className={`badge badge-${ord.status === 'completed' ? 'success' : 'warning'} text-xs`}>
                        {ord.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card animate-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-body space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted mb-1 block">Full Name *</label>
                <input
                  type="text"
                  className="input"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid-2">
                <div>
                  <label className="text-xs font-semibold text-muted mb-1 block">Phone Number</label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="e.g. 9876543210"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted mb-1 block">Email</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="e.g. rahul@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted mb-1 block">Address</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Address / locality"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted mb-1 block">Notes / Preferences</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Dietary preference, VIP, favorite table..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCustomer ? 'Save Changes' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
