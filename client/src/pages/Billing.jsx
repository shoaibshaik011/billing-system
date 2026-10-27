import React, { useState, useEffect } from 'react';
import { Search, Calendar, Receipt, Printer, ArrowDownRight, Eye, CheckCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import * as api from '../api';

export default function Billing() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    loadOrders();
    loadSettings();
  }, [paymentFilter]);

  async function loadOrders() {
    try {
      const params = { status: 'completed' };
      if (paymentFilter !== 'all') params.payment_method = paymentFilter;
      const data = await api.getOrders(params);
      setOrders(data);
    } catch (err) {
      toast.error('Failed to load billing history');
    } finally {
      setLoading(false);
    }
  }

  async function loadSettings() {
    try {
      const data = await api.getSettings();
      setSettings(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function viewInvoice(id) {
    try {
      const order = await api.getOrder(id);
      setSelectedOrder(order);
    } catch (err) {
      toast.error('Failed to load invoice');
    }
  }

  function handlePrint() {
    window.print();
  }

  const filteredOrders = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.order_number?.toLowerCase().includes(q) ||
      o.customer_name?.toLowerCase().includes(q) ||
      o.customer_phone?.includes(q) ||
      (o.table_number && `table ${o.table_number}`.toLowerCase().includes(q))
    );
  });

  const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const totalTax = filteredOrders.reduce((sum, o) => sum + (o.tax_amount || 0), 0);
  const totalDiscount = filteredOrders.reduce((sum, o) => sum + (o.discount_amount || 0), 0);

  return (
    <div className="page-content">
      {/* Summary Cards */}
      <div className="grid-4 mb-6">
        <div className="stat-card">
          <span className="stat-card-title">Completed Bills</span>
          <span className="stat-card-value">{filteredOrders.length}</span>
          <span className="text-xs text-muted">Settled invoices</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-title">Total Revenue</span>
          <span className="stat-card-value text-success">₹{totalRevenue.toLocaleString('en-IN')}</span>
          <span className="text-xs text-muted">Net sales collected</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-title">Total GST Tax</span>
          <span className="stat-card-value text-info">₹{totalTax.toLocaleString('en-IN')}</span>
          <span className="text-xs text-muted">Collected GST</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-title">Discounts Given</span>
          <span className="stat-card-value text-warning">₹{totalDiscount.toLocaleString('en-IN')}</span>
          <span className="text-xs text-muted">Promos & concessions</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="search-bar" style={{ maxWidth: 340, width: '100%' }}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Search invoice #, customer, table..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          {['all', 'cash', 'card', 'upi'].map((method) => (
            <button
              key={method}
              className={`btn btn-sm ${paymentFilter === method ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPaymentFilter(method)}
            >
              {method === 'all' ? 'All Payments' : method.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Date & Time</th>
              <th>Type / Table</th>
              <th>Customer</th>
              <th>Payment</th>
              <th>Subtotal</th>
              <th>Tax</th>
              <th>Total Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
                  No completed invoices found
                </td>
              </tr>
            ) : (
              filteredOrders.map((ord) => (
                <tr key={ord.id} onClick={() => viewInvoice(ord.id)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Receipt size={16} className="text-primary" />
                      <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{ord.order_number}</span>
                    </div>
                  </td>
                  <td>
                    <div className="text-sm">
                      {new Date(ord.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                      <div className="text-xs text-muted">
                        {new Date(ord.created_at).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-secondary">
                      {ord.order_type === 'dine_in' ? `Table ${ord.table_number || '—'}` : 'Takeaway'}
                    </span>
                  </td>
                  <td>
                    <div className="text-sm">
                      <div style={{ fontWeight: 600 }}>{ord.customer_name || 'Walk-in'}</div>
                      {ord.customer_phone && <div className="text-xs text-muted">{ord.customer_phone}</div>}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-info">{ord.payment_method?.toUpperCase() || 'PAID'}</span>
                  </td>
                  <td>₹{(ord.subtotal || 0).toLocaleString('en-IN')}</td>
                  <td className="text-muted">₹{(ord.tax_amount || 0).toLocaleString('en-IN')}</td>
                  <td>
                    <span style={{ fontWeight: 800, color: 'var(--accent-success)', fontSize: '0.95rem' }}>
                      ₹{(ord.total_amount || 0).toLocaleString('en-IN')}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        viewInvoice(ord.id);
                      }}
                    >
                      <Eye size={16} /> View Bill
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Invoice Modal for Printable Receipt */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div
            className="modal-card animate-in"
            style={{ maxWidth: 450, padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 no-print">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Tax Invoice Receipt</h3>
              <div className="flex items-center gap-2">
                <button className="btn btn-secondary btn-sm" onClick={handlePrint}>
                  <Printer size={16} /> Print
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedOrder(null)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div
              className="receipt-preview p-4 rounded"
              style={{
                background: '#ffffff',
                color: '#111827',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                border: '1px solid #e5e7eb',
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0 }}>
                  {settings?.restaurant_name || 'HOTEL BILLFLOW'}
                </h2>
                <div style={{ fontSize: '0.75rem', color: '#4b5563' }}>{settings?.address}</div>
                {settings?.phone && <div style={{ fontSize: '0.75rem', color: '#4b5563' }}>Ph: {settings?.phone}</div>}
                {settings?.gst_number && (
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, marginTop: 4 }}>
                    GSTIN: {settings?.gst_number}
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px dashed #9ca3af', borderBottom: '1px dashed #9ca3af', padding: '6px 0', margin: '8px 0', fontSize: '0.75rem' }}>
                <div className="flex justify-between">
                  <span>Bill: {selectedOrder.order_number}</span>
                  <span>{new Date(selectedOrder.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Type: {selectedOrder.order_type === 'dine_in' ? `Table ${selectedOrder.table_number}` : 'Takeaway'}</span>
                  <span>{new Date(selectedOrder.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {selectedOrder.customer_name && (
                  <div className="flex justify-between">
                    <span>Customer: {selectedOrder.customer_name}</span>
                  </div>
                )}
              </div>

              <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', marginBottom: 8 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #d1d5db' }}>
                    <th style={{ textAlign: 'left', padding: '4px 0' }}>Item</th>
                    <th style={{ textAlign: 'center', padding: '4px 0' }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: '4px 0' }}>Price</th>
                    <th style={{ textAlign: 'right', padding: '4px 0' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items?.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px dotted #e5e7eb' }}>
                      <td style={{ padding: '4px 0' }}>{item.item_name}</td>
                      <td style={{ textAlign: 'center', padding: '4px 0' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right', padding: '4px 0' }}>₹{(item.item_price ?? item.unit_price ?? (item.total_price / (item.quantity || 1)))}</td>
                      <td style={{ textAlign: 'right', padding: '4px 0' }}>₹{item.total_price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ borderTop: '1px dashed #9ca3af', paddingTop: 6, fontSize: '0.75rem' }}>
                <div className="flex justify-between py-1">
                  <span>Subtotal</span>
                  <span>₹{selectedOrder.subtotal?.toFixed(2)}</span>
                </div>
                {selectedOrder.discount_amount > 0 && (
                  <div className="flex justify-between py-1 text-danger">
                    <span>Discount</span>
                    <span>-₹{selectedOrder.discount_amount?.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span>GST ({settings?.tax_percentage || 5}%)</span>
                  <span>₹{selectedOrder.tax_amount?.toFixed(2)}</span>
                </div>
                <div
                  className="flex justify-between py-2"
                  style={{ borderTop: '1px solid #111827', borderBottom: '1px solid #111827', fontWeight: 900, fontSize: '0.9rem', marginTop: 4 }}
                >
                  <span>GRAND TOTAL</span>
                  <span>₹{selectedOrder.total_amount?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1" style={{ fontSize: '0.75rem', color: '#4b5563' }}>
                  <span>Payment Mode</span>
                  <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{selectedOrder.payment_method || 'CASH'}</span>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: 14, fontSize: '0.75rem', color: '#6b7280' }}>
                Thank you for dining with us! 🙏<br />Visit Again!
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
