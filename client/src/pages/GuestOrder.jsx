import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Search, ShoppingCart, Plus, Minus, Trash2, X, Clock, CheckCircle,
  ChefHat, Sparkles, AlertCircle, Bell, ArrowRight, Utensils
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import * as api from '../api';

export default function GuestOrder() {
  const { tableNumber, slug } = useParams();
  const [data, setData] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);

  // Cart
  const [cart, setCart] = useState({});
  const [showCart, setShowCart] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Live order tracker
  const [activeOrder, setActiveOrder] = useState(null);
  const [billRequested, setBillRequested] = useState(false);

  useEffect(() => {
    loadTableMenu();
    if (slug) {
      api.getTenantConfig(slug)
        .then((res) => {
          if (res.success && res.tenant) {
            setTenant(res.tenant);
            const color = res.tenant.primary_color || '#e11d24';
            document.documentElement.style.setProperty('--empire-red', color);
            document.documentElement.style.setProperty('--accent-primary', color);
            document.documentElement.style.setProperty('--empire-red-tint', `${color}14`);
            document.documentElement.style.setProperty('--empire-red-border', `${color}35`);
          }
        })
        .catch(() => {});
    }
  }, [tableNumber, slug]);

  async function loadTableMenu() {
    try {
      setLoading(true);
      const res = await api.getGuestTableMenu(tableNumber || 'T1');
      setData(res);
      if (res.activeOrder) {
        setActiveOrder(res.activeOrder);
      }
    } catch (err) {
      setError(err.message || 'Table not found');
    } finally {
      setLoading(false);
    }
  }

  function addToCart(item) {
    setCart((prev) => {
      const currentQty = prev[item.id]?.quantity || 0;
      return {
        ...prev,
        [item.id]: {
          ...item,
          quantity: currentQty + 1,
        },
      };
    });
    toast.success(`Added ${item.name}`, { duration: 1200, position: 'bottom-center' });
  }

  function updateQty(itemId, delta) {
    setCart((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      const newQty = current.quantity + delta;
      if (newQty <= 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return {
        ...prev,
        [itemId]: { ...current, quantity: newQty },
      };
    });
  }

  const cartList = Object.values(cart);
  const cartItemCount = cartList.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cartList.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxRate = data?.settings?.tax_percentage || 5.0;
  const cartTax = (cartSubtotal * taxRate) / 100;
  const cartTotal = cartSubtotal + cartTax;

  async function handlePlaceOrder() {
    if (!cartList.length) return;
    setSubmitting(true);
    try {
      const payload = {
        items: cartList.map((i) => ({
          id: i.id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          is_veg: i.is_veg,
        })),
        guest_name: guestName,
        guest_phone: guestPhone,
        special_instructions: specialInstructions,
      };

      const res = await api.placeGuestOrder(tableNumber, payload);
      toast.success('🎉 Order sent directly to the kitchen!');
      setCart({});
      setShowCart(false);
      // Reload table status
      loadTableMenu();
    } catch (err) {
      toast.error(err.message || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestBill() {
    if (!activeOrder?.id) return;
    try {
      await api.requestGuestBill(activeOrder.id);
      setBillRequested(true);
      toast.success('Captain notified! Your bill is on the way.');
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', animation: 'spin 1.5s infinite linear' }}>🍽️</div>
          <p style={{ marginTop: 12, fontWeight: 700, color: 'var(--empire-red)' }}>Loading Table Menu...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#f8fafc' }}>
        <div className="card text-center p-6" style={{ maxWidth: 400 }}>
          <AlertCircle size={48} className="text-danger" style={{ margin: '0 auto 12px' }} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Table Not Found</h2>
          <p className="text-sm text-muted mb-4">{error || 'Please ask your server for assistance or scan the table QR again.'}</p>
          <a href="/table/T1" className="btn btn-primary btn-sm">Try Demo Table T1</a>
        </div>
      </div>
    );
  }

  const { table, settings, categories, menuItems } = data;

  // Filter items
  const filteredItems = menuItems.filter((item) => {
    if (selectedCategory !== 'all' && item.category_id !== parseInt(selectedCategory)) return false;
    if (vegOnly && !item.is_veg) return false;
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase()) && !item.description?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: cartItemCount > 0 ? 90 : 40, maxWidth: 640, margin: '0 auto' }}>
      <Toaster position="top-center" />

      {/* Guest Mobile Header */}
      <header
        style={{
          background: 'linear-gradient(135deg, #d31219, #e11d24)',
          color: '#ffffff',
          padding: '20px 20px 24px',
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
          boxShadow: '0 8px 24px rgba(225, 29, 36, 0.25)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '1.6rem' }}>{tenant?.icon_emoji || '👨‍🍳'}</span>
            <div>
              <h1 style={{ fontSize: '1.15rem', fontWeight: 900, margin: 0, letterSpacing: -0.3 }}>
                {tenant?.name || settings?.restaurant_name || 'EMPIRE RESTAURANT'}
              </h1>
              <span style={{ fontSize: '0.72rem', opacity: 0.9 }}>
                {tenant?.tagline || 'Since 1966 • Authentic Taste'}
              </span>
            </div>
          </div>
          <div
            style={{
              background: '#ffffff',
              color: 'var(--empire-red)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              fontWeight: 800,
              fontSize: '0.85rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            TABLE {table.table_number}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs" style={{ opacity: 0.95 }}>
          <span className="badge-open" style={{ background: '#ffffff', color: '#15803d', border: 'none', padding: '3px 8px' }}>
            Ready to Order
          </span>
          <span>• {table.floor} Floor Area</span>
        </div>
      </header>

      {/* Active Order Live Tracker (if table already ordered) */}
      {activeOrder && activeOrder.items?.length > 0 && (
        <div style={{ padding: '16px 16px 0' }}>
          <div
            className="card animate-in"
            style={{
              border: '1.5px solid var(--empire-red-border)',
              background: '#ffffff',
              padding: 16,
              boxShadow: '0 4px 14px rgba(225, 29, 36, 0.08)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ChefHat className="text-primary" size={18} />
                <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>Live Table Order ({activeOrder.order_number})</span>
              </div>
              <span className="badge badge-success">Kitchen Preparing</span>
            </div>

            <p className="text-xs text-muted mb-3">
              {activeOrder.items.length} items ordered • Total: <strong>₹{activeOrder.total_amount?.toLocaleString('en-IN')}</strong>
            </p>

            <div className="flex items-center gap-2">
              <button
                className="btn btn-outline-red btn-sm"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={handleRequestBill}
                disabled={billRequested}
              >
                <Bell size={13} /> {billRequested ? 'Bill Requested ✓' : 'Request Bill at Table'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search & Veg Filter */}
      <div style={{ padding: '16px 16px 8px' }}>
        <div className="search-bar mb-3" style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <Search size={16} className="text-muted" />
          <input
            type="text"
            placeholder="Search dishes (e.g. Kebab, Biryani, Naan)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="btn btn-ghost btn-sm" style={{ padding: 4 }} onClick={() => setSearchQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          {/* Horizontal category slider */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, flex: 1 }}>
            <button
              className={`category-chip ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              All Items ({menuItems.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`category-chip ${selectedCategory === String(cat.id) ? 'active' : ''}`}
                onClick={() => setSelectedCategory(String(cat.id))}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>

          {/* Veg Only Toggle */}
          <button
            onClick={() => setVegOnly(!vegOnly)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              borderRadius: 'var(--radius-full)',
              border: `1.5px solid ${vegOnly ? '#16a34a' : 'var(--border-primary)'}`,
              background: vegOnly ? '#ecfdf5' : '#ffffff',
              color: vegOnly ? '#15803d' : 'var(--text-secondary)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <span className="veg-badge" style={{ width: 12, height: 12 }} />
            <span>Veg</span>
          </button>
        </div>
      </div>

      {/* Menu Dishes List */}
      <div style={{ padding: '8px 16px' }} className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 card text-muted">
            <p>No dishes found matching your search</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const inCartQty = cart[item.id]?.quantity || 0;

            return (
              <div
                key={item.id}
                className="card animate-in"
                style={{
                  padding: 16,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 14,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  border: inCartQty > 0 ? '1.5px solid var(--empire-red)' : '1px solid var(--border-primary)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`veg-indicator ${item.is_veg ? 'veg' : 'non-veg'}`} />
                    <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      {item.name}
                    </h3>
                  </div>

                  <div style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--empire-red)', marginBottom: 4 }}>
                    ₹{item.price}
                  </div>

                  {item.description && (
                    <p style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)', margin: '0 0 6px', lineHeight: 1.3 }}>
                      {item.description}
                    </p>
                  )}

                  <div className="flex items-center gap-1 text-xs text-muted">
                    <Clock size={11} />
                    <span>~{item.preparation_time || 15} mins</span>
                  </div>
                </div>

                {/* Add / Qty Control */}
                <div style={{ flexShrink: 0, marginTop: 4 }}>
                  {inCartQty === 0 ? (
                    <button
                      className="btn btn-outline-red btn-sm"
                      style={{ borderRadius: 'var(--radius-full)', padding: '6px 16px', fontWeight: 800 }}
                      onClick={() => addToCart(item)}
                    >
                      <Plus size={14} /> Add
                    </button>
                  ) : (
                    <div className="qty-controls" style={{ background: 'var(--empire-red-tint)', border: '1px solid var(--empire-red-border)' }}>
                      <button className="qty-btn" onClick={() => updateQty(item.id, -1)}>
                        <Minus size={12} />
                      </button>
                      <span style={{ fontWeight: 800, minWidth: 20, textAlign: 'center', color: 'var(--empire-red)' }}>
                        {inCartQty}
                      </span>
                      <button className="qty-btn" onClick={() => updateQty(item.id, 1)}>
                        <Plus size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Bottom Cart Bar (Mobile Sticky) */}
      {cartItemCount > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 16,
            left: 16,
            right: 16,
            maxWidth: 608,
            margin: '0 auto',
            zIndex: 90,
          }}
        >
          <div
            onClick={() => setShowCart(true)}
            style={{
              background: 'linear-gradient(135deg, #d31219, #e11d24)',
              color: '#ffffff',
              borderRadius: varRadius(18),
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 8px 28px rgba(225, 29, 36, 0.4)',
              cursor: 'pointer',
            }}
          >
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800 }}>
                {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'} in Table Cart
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>
                ₹{cartTotal.toFixed(0)} <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>(incl. GST)</span>
              </div>
            </div>

            <div className="flex items-center gap-2" style={{ fontWeight: 800, fontSize: '0.9rem' }}>
              <span>View Order</span>
              <ArrowRight size={18} />
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer / Modal */}
      {showCart && (
        <div className="modal-overlay" onClick={() => setShowCart(false)}>
          <div
            className="modal-card animate-in"
            style={{ maxWidth: 480, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <Utensils size={18} className="text-primary" />
                <h3>Your Table {table.table_number} Order</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCart(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
              {/* Items */}
              <div className="space-y-3 mb-4">
                {cartList.map((item) => (
                  <div key={item.id} className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ flex: 1 }}>
                      <div className="flex items-center gap-1.5">
                        <span className={`veg-indicator ${item.is_veg ? 'veg' : 'non-veg'}`} style={{ width: 12, height: 12 }} />
                        <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{item.name}</span>
                      </div>
                      <span className="text-xs text-muted">₹{item.price} each</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="qty-controls">
                        <button className="qty-btn" onClick={() => updateQty(item.id, -1)}><Minus size={11} /></button>
                        <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{item.quantity}</span>
                        <button className="qty-btn" onClick={() => updateQty(item.id, 1)}><Plus size={11} /></button>
                      </div>
                      <span style={{ fontWeight: 800, minWidth: 50, textAlign: 'right', fontSize: '0.9rem' }}>
                        ₹{item.price * item.quantity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cooking Instructions */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-muted mb-1 block">Special Cooking Notes (Optional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Less spicy, serve hot, extra onions & lemon"
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                />
              </div>

              {/* Guest Details */}
              <div className="grid-2 mb-4">
                <div>
                  <label className="text-xs font-semibold text-muted mb-1 block">Your Name (Optional)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Guest name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted mb-1 block">Phone (For E-Bill)</label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="Mobile number"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* Bill Summary */}
              <div className="p-3 rounded" style={{ background: '#f8fafc', border: '1px solid var(--border-primary)' }}>
                <div className="flex justify-between text-xs py-1">
                  <span>Items Subtotal</span>
                  <span>₹{cartSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs py-1">
                  <span>GST ({taxRate}%)</span>
                  <span>₹{cartTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm pt-2" style={{ borderTop: '1px solid #e2e8f0', color: 'var(--empire-red)' }}>
                  <span>Grand Total</span>
                  <span>₹{cartTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ background: '#ffffff' }}>
              <button
                className="btn btn-primary w-full"
                style={{ padding: '12px', justifyContent: 'center', fontSize: '0.95rem' }}
                onClick={handlePlaceOrder}
                disabled={submitting}
              >
                <ChefHat size={18} />
                <span>{submitting ? 'Sending to Kitchen...' : `Confirm & Place Order (₹${cartTotal.toFixed(0)})`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function varRadius(val) {
  return `${val}px`;
}
