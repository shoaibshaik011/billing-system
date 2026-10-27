import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Search, ShoppingCart, Plus, Minus, Trash2, X, Clock, CheckCircle,
  ChefHat, Sparkles, AlertCircle, Bell, ArrowRight, Utensils,
  CreditCard, Smartphone, Check, ExternalLink, QrCode, Receipt, Printer
} from 'lucide-react';
import QRCode from 'qrcode';
import toast, { Toaster } from 'react-hot-toast';
import * as api from '../api';

export default function GuestOrder() {
  const { tableNumber, slug: paramSlug } = useParams();
  const effectiveSlug = paramSlug || window.location.pathname.match(/^\/r\/([^\/]+)/)?.[1] || '';
  const [data, setData] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);

  // Cart & Checkout
  const [cart, setCart] = useState({});
  const [showCart, setShowCart] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentPreference, setPaymentPreference] = useState('counter'); // 'counter' or 'pay_here'
  const [submitting, setSubmitting] = useState(false);

  // Live order tracker, UPI Modal, Digital Receipt Modal
  const [activeOrder, setActiveOrder] = useState(null);
  const [billRequested, setBillRequested] = useState(false);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [showGuestReceipt, setShowGuestReceipt] = useState(false);
  const [upiQrDataUrl, setUpiQrDataUrl] = useState('');
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  // Initial load and background polling every 3 seconds for real-time kitchen updates
  useEffect(() => {
    loadTableMenu(true);
    const interval = setInterval(() => {
      loadTableMenu(false);
    }, 3000);

    if (effectiveSlug) {
      api.getTenantConfig(effectiveSlug)
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

    return () => clearInterval(interval);
  }, [tableNumber, effectiveSlug]);

  async function loadTableMenu(isInitial = false) {
    try {
      if (isInitial) setLoading(true);
      const res = await api.getGuestTableMenu(tableNumber || 'T1', effectiveSlug);
      setData(res);
      if (res.activeOrder) {
        setActiveOrder(res.activeOrder);
      } else {
        setActiveOrder(null);
      }
      if (res.settings) {
        const color = res.settings.primary_color || '#e11d24';
        document.documentElement.style.setProperty('--empire-red', color);
        document.documentElement.style.setProperty('--accent-primary', color);
      }
    } catch (err) {
      if (isInitial) {
        setError(err.message || 'Table not found');
      }
    } finally {
      if (isInitial) setLoading(false);
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
    toast.success(`Added ${item.name}`, { duration: 1200, icon: '🍽️' });
  }

  function updateQty(itemId, delta) {
    setCart((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      const nextQty = current.quantity + delta;
      if (nextQty <= 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return {
        ...prev,
        [itemId]: {
          ...current,
          quantity: nextQty,
        },
      };
    });
  }

  const cartList = Object.values(cart);
  const cartItemCount = cartList.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cartList.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxRate = data?.settings?.tax_percentage || 5.0;
  const cartTax = (cartSubtotal * taxRate) / 100;
  const cartTotal = cartSubtotal + cartTax;

  // Generate UPI QR Code URL
  useEffect(() => {
    const amount = activeOrder ? activeOrder.total_amount : cartTotal;
    const upiId = data?.settings?.upi_id || 'empire.billing@upi';
    const restName = tenant?.name || data?.settings?.restaurant_name || 'Restaurant POS';
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(restName)}&am=${amount.toFixed(2)}&cu=INR`;

    QRCode.toDataURL(upiUri, { width: 260, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setUpiQrDataUrl)
      .catch(() => {});
  }, [cartTotal, activeOrder, data, tenant]);

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
        payment_preference: paymentPreference,
      };

      const res = await api.placeGuestOrder(tableNumber, payload, effectiveSlug);
      toast.success('🎉 Order sent directly to the kitchen!');
      setCart({});
      setShowCart(false);
      loadTableMenu(false);
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

  // Handle confirming online UPI payment from active order
  async function handleConfirmOnlinePayment() {
    if (!activeOrder?.id) return;
    setConfirmingPayment(true);
    try {
      const res = await api.payGuestOrder(activeOrder.id, {
        preference: 'pay_here',
        transaction_id: `UPI-${Date.now().toString().slice(-6)}`,
      });
      toast.success('Payment confirmed! Thank you.');
      setShowUpiModal(false);
      loadTableMenu(false);
    } catch (err) {
      toast.error('Failed to confirm payment');
    } finally {
      setConfirmingPayment(false);
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
    if (selectedCategory !== 'all' && item.category_id !== parseInt(selectedCategory, 10)) return false;
    if (vegOnly && !item.is_veg) return false;
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase()) && !item.description?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Calculate live preparation status for active order
  const prepStatus = activeOrder?.prep_status || 'received';
  const isFoodReady = prepStatus === 'ready';
  const isFoodServed = prepStatus === 'served';
  const isPaid = activeOrder?.payment_status === 'paid' || activeOrder?.payment_preference === 'pay_here';

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: cartItemCount > 0 ? 90 : 30 }}>
      {/* Mobile Top Header Banner */}
      <header
        style={{
          background: 'linear-gradient(135deg, var(--empire-red) 0%, #991b1b 100%)',
          color: '#ffffff',
          padding: '20px 20px 24px',
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
          boxShadow: '0 8px 24px rgba(225, 29, 36, 0.25)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '1.6rem' }}>{tenant?.icon_emoji || settings?.icon_emoji || '🍽️'}</span>
            <div>
              <h1 style={{ fontSize: '1.15rem', fontWeight: 900, margin: 0, letterSpacing: -0.3 }}>
                {tenant?.name || settings?.restaurant_name || 'RESTAURANT'}
              </h1>
              <span style={{ fontSize: '0.72rem', opacity: 0.9 }}>
                {tenant?.tagline || settings?.tagline || 'Fresh Food & Authentic Experience'}
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

        <div className="flex items-center justify-between text-xs opacity-90 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }}>
          <span>✨ Order from your phone directly to the kitchen</span>
          <span className="badge-open" style={{ background: '#ffffff', color: '#16a34a', border: 'none', padding: '2px 8px' }}>
            Live
          </span>
        </div>
      </header>

      {/* Real-time Kitchen Order Status Tracker */}
      {activeOrder && (
        <div style={{ padding: '16px 16px 0' }}>
          {/* Celebratory Alert when food is PREPARED & READY */}
          {isFoodReady && (
            <div
              style={{
                background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
                color: '#ffffff',
                padding: '14px 16px',
                borderRadius: '16px',
                marginBottom: '12px',
                boxShadow: '0 6px 20px rgba(22, 163, 74, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                animation: 'pulse 2s infinite',
              }}
            >
              <div style={{ fontSize: '1.8rem' }}>🎉</div>
              <div>
                <div style={{ fontWeight: 900, fontSize: '0.98rem' }}>
                  Your Order is Prepared & Hot!
                </div>
                <div style={{ fontSize: '0.78rem', opacity: 0.95, marginTop: '2px' }}>
                  Our staff is bringing your delicious dishes to Table {table.table_number} right now!
                </div>
              </div>
            </div>
          )}

          <div
            className="card"
            style={{
              border: isFoodReady ? '2px solid #16a34a' : '1.5px solid var(--empire-red-border)',
              background: '#ffffff',
              padding: '16px',
              borderRadius: '18px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            }}
          >
            {/* Header row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ChefHat className="text-primary" size={18} />
                <span style={{ fontWeight: 800, fontSize: '0.92rem' }}>
                  Order #{activeOrder.order_number}
                </span>
              </div>

              {/* Status Badge */}
              <span
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: '20px',
                  background: isFoodServed
                    ? '#dcfce7'
                    : isFoodReady
                    ? '#16a34a'
                    : prepStatus === 'preparing'
                    ? '#fef3c7'
                    : '#e0f2fe',
                  color: isFoodServed
                    ? '#15803d'
                    : isFoodReady
                    ? '#ffffff'
                    : prepStatus === 'preparing'
                    ? '#b45309'
                    : '#0369a1',
                }}
              >
                {isFoodServed
                  ? 'Served ✓'
                  : isFoodReady
                  ? 'Ready to Serve! 🔥'
                  : prepStatus === 'preparing'
                  ? '👨‍🍳 Cooking in Kitchen'
                  : '🟡 Order Received'}
              </span>
            </div>

            {/* 4-Step Visual Progress Bar */}
            <div style={{ margin: '14px 0 16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', textAlign: 'center' }}>
                {[
                  { key: 'received', label: 'Received', icon: '📝', active: true },
                  { key: 'preparing', label: 'Cooking', icon: '👨‍🍳', active: prepStatus === 'preparing' || prepStatus === 'ready' || isFoodServed },
                  { key: 'ready', label: 'Prepared!', icon: '🔥', active: prepStatus === 'ready' || isFoodServed },
                  { key: 'served', label: 'Served', icon: '✨', active: isFoodServed },
                ].map((step, idx) => (
                  <div key={step.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: step.active ? 'var(--empire-red)' : '#f1f5f9',
                        color: step.active ? '#ffffff' : '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.9rem',
                        fontWeight: 800,
                        boxShadow: step.active ? '0 2px 8px rgba(225, 29, 36, 0.3)' : 'none',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      {step.active ? step.icon : idx + 1}
                    </div>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: step.active ? 800 : 500,
                        color: step.active ? 'var(--text-primary)' : 'var(--text-secondary)',
                        marginTop: '4px',
                      }}
                    >
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Progress track line */}
              <div style={{ height: '4px', background: '#e2e8f0', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    background: isFoodReady || isFoodServed ? '#16a34a' : 'var(--empire-red)',
                    width: isFoodServed ? '100%' : isFoodReady ? '75%' : prepStatus === 'preparing' ? '50%' : '25%',
                    transition: 'width 0.5s ease',
                  }}
                />
              </div>
            </div>

            {/* Order Items Summary */}
            <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '10px 12px', fontSize: '0.8rem', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                <span>Items ({activeOrder.items?.length || 0}):</span>
                <span style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                  ₹{activeOrder.total_amount?.toLocaleString('en-IN')}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                {activeOrder.items?.map((it, i) => (
                  <span key={i} style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem' }}>
                    {it.quantity}x {it.item_name}
                  </span>
                ))}
              </div>
            </div>

            {/* Payment Status Pill */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: isPaid ? '#f0fdf4' : '#fffbeb', border: `1px solid ${isPaid ? '#bbf7d0' : '#fef08a'}`, marginBottom: '12px', fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{isPaid ? '🟢' : '💵'}</span>
                <span style={{ fontWeight: 700, color: isPaid ? '#15803d' : '#854d0e' }}>
                  {isPaid ? 'Paid Online via UPI ✓' : 'Payment: Pay at Counter'}
                </span>
              </div>

              {!isPaid && (
                <button
                  onClick={() => setShowUpiModal(true)}
                  style={{
                    background: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Pay Online (UPI) ↗
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                className="btn btn-secondary btn-sm"
                style={{ flex: 1, justifyContent: 'center', gap: 6, fontWeight: 700, borderColor: '#cbd5e1' }}
                onClick={() => setShowGuestReceipt(true)}
              >
                <Receipt size={14} className="text-primary" /> View Bill / Receipt
              </button>
              <button
                className="btn btn-outline-red btn-sm"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={handleRequestBill}
                disabled={billRequested}
              >
                <Bell size={13} /> {billRequested ? 'Bill Requested ✓' : 'Call Waiter / Bill'}
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

          {/* Pure Veg Switcher */}
          <button
            onClick={() => setVegOnly(!vegOnly)}
            style={{
              padding: '6px 10px',
              borderRadius: '20px',
              border: vegOnly ? '1.5px solid #16a34a' : '1px solid var(--border-primary)',
              background: vegOnly ? '#f0fdf4' : '#ffffff',
              color: vegOnly ? '#15803d' : 'var(--text-secondary)',
              fontSize: '0.78rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            <span className="veg-indicator veg" style={{ width: 10, height: 10 }} />
            Veg Only
          </button>
        </div>
      </div>

      {/* Menu Dishes Grid */}
      <div style={{ padding: '8px 16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredItems.map((item) => {
            const inCartQty = cart[item.id]?.quantity || 0;
            return (
              <div
                key={item.id}
                className="card"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 14,
                  border: inCartQty > 0 ? '1.5px solid var(--empire-red-border)' : '1px solid var(--border-primary)',
                  background: inCartQty > 0 ? 'var(--empire-red-tint)' : '#ffffff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ flex: 1, paddingRight: 12 }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={`veg-indicator ${item.is_veg ? 'veg' : 'non-veg'}`} style={{ width: 12, height: 12 }} />
                    <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{item.name}</span>
                  </div>
                  {item.description && (
                    <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '0 0 6px', lineHeight: 1.3 }}>
                      {item.description}
                    </p>
                  )}
                  <span style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-primary)' }}>
                    ₹{item.price}
                  </span>
                </div>

                <div>
                  {inCartQty === 0 ? (
                    <button
                      className="btn btn-outline-red btn-sm"
                      style={{ padding: '6px 16px', borderRadius: 20, fontWeight: 700, fontSize: '0.82rem' }}
                      onClick={() => addToCart(item)}
                    >
                      + ADD
                    </button>
                  ) : (
                    <div className="qty-controls" style={{ background: 'var(--empire-red)', color: '#ffffff', borderRadius: 20, padding: '3px 8px' }}>
                      <button className="qty-btn" style={{ color: '#ffffff' }} onClick={() => updateQty(item.id, -1)}>
                        <Minus size={12} />
                      </button>
                      <span style={{ fontWeight: 800, minWidth: 20, textAlign: 'center', fontSize: '0.85rem' }}>
                        {inCartQty}
                      </span>
                      <button className="qty-btn" style={{ color: '#ffffff' }} onClick={() => updateQty(item.id, 1)}>
                        <Plus size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating View Cart Sticky Bar */}
      {cartItemCount > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(10px)',
            borderTop: '1px solid var(--border-primary)',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
            zIndex: 100,
          }}
        >
          <button
            onClick={() => setShowCart(true)}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '14px 18px',
              borderRadius: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.95rem',
              fontWeight: 800,
              boxShadow: '0 6px 20px rgba(225, 29, 36, 0.35)',
            }}
          >
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} />
              <span>{cartItemCount} {cartItemCount === 1 ? 'item' : 'items'} in tray</span>
            </div>
            <div className="flex items-center gap-2">
              <span>View Cart • ₹{cartTotal.toFixed(0)}</span>
              <ArrowRight size={16} />
            </div>
          </button>
        </div>
      )}

      {/* Full-Page Checkout & Cart Modal */}
      {showCart && (
        <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setShowCart(false)}>
          <div
            className="modal-card"
            style={{
              maxWidth: 480,
              height: '90vh',
              display: 'flex',
              flexDirection: 'column',
              margin: 'auto 16px',
              borderRadius: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <Utensils size={18} className="text-primary" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Your Table {table.table_number} Order</h3>
              </div>
              <button onClick={() => setShowCart(false)} className="btn-close" style={{ background: 'none', border: 'none', fontSize: '1.4rem' }}>
                ×
              </button>
            </div>

            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {/* Order Items */}
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

              {/* Special Cooking Notes */}
              <div className="mb-4">
                <label className="text-xs font-semibold text-muted mb-1 block">Special Cooking Notes (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Less spicy, serve hot, extra onions & lemon"
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                />
              </div>

              {/* Guest Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div>
                  <label className="text-xs font-semibold text-muted mb-1 block">Your Name (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Guest name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted mb-1 block">Phone (For E-Bill)</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="Mobile number"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* HOW TO PAY SELECTOR */}
              <div className="mb-4">
                <label className="text-xs font-bold text-muted mb-2 block" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Choose How to Pay
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {/* Option 1: Pay at Counter */}
                  <div
                    onClick={() => setPaymentPreference('counter')}
                    style={{
                      border: paymentPreference === 'counter' ? '2px solid var(--empire-red)' : '1px solid var(--border-primary)',
                      background: paymentPreference === 'counter' ? 'var(--empire-red-tint)' : '#ffffff',
                      borderRadius: 12,
                      padding: '12px 10px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: 4,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>💵</span>
                    <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>Pay at Counter</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Cash, Card or UPI when leaving</span>
                  </div>

                  {/* Option 2: Pay Here via UPI */}
                  <div
                    onClick={() => setPaymentPreference('pay_here')}
                    style={{
                      border: paymentPreference === 'pay_here' ? '2px solid #16a34a' : '1px solid var(--border-primary)',
                      background: paymentPreference === 'pay_here' ? '#f0fdf4' : '#ffffff',
                      borderRadius: 12,
                      padding: '12px 10px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: 4,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>📱</span>
                    <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#15803d' }}>Pay Here (UPI)</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>PhonePe, GPay, Paytm</span>
                  </div>
                </div>
              </div>

              {/* If Pay Here is selected, show UPI QR code preview */}
              {paymentPreference === 'pay_here' && (
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1.5px dashed #86efac',
                    borderRadius: 14,
                    padding: '14px',
                    textAlign: 'center',
                    marginBottom: 16,
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#15803d', marginBottom: 4 }}>
                    Instant UPI Scan & Pay
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#166534', marginBottom: 10 }}>
                    Scan with any UPI App or tap the direct payment button below
                  </div>

                  {upiQrDataUrl && (
                    <img
                      src={upiQrDataUrl}
                      alt="UPI QR Code"
                      style={{ width: 140, height: 140, margin: '0 auto 10px', borderRadius: 8, border: '1px solid #bbf7d0' }}
                    />
                  )}

                  <a
                    href={`upi://pay?pa=${encodeURIComponent(data?.settings?.upi_id || 'empire.billing@upi')}&pn=${encodeURIComponent(tenant?.name || data?.settings?.restaurant_name || 'Restaurant')}&am=${cartTotal.toFixed(2)}&cu=INR`}
                    className="btn btn-sm"
                    style={{
                      background: '#16a34a',
                      color: '#ffffff',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: '0.78rem',
                    }}
                  >
                    <Smartphone size={14} /> Open in GPay / PhonePe / Paytm
                  </a>
                </div>
              )}

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

            <div className="modal-footer" style={{ background: '#ffffff', borderTop: '1px solid var(--border-primary)', padding: '14px 16px' }}>
              <button
                className="btn btn-primary w-full"
                style={{
                  padding: '14px',
                  justifyContent: 'center',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  background: paymentPreference === 'pay_here' ? '#16a34a' : 'var(--empire-red)',
                  borderColor: paymentPreference === 'pay_here' ? '#16a34a' : 'var(--empire-red)',
                }}
                onClick={handlePlaceOrder}
                disabled={submitting}
              >
                <ChefHat size={18} />
                <span>
                  {submitting
                    ? 'Sending to Kitchen...'
                    : paymentPreference === 'pay_here'
                    ? `Confirm & Pay via UPI (₹${cartTotal.toFixed(0)})`
                    : `Confirm Order • Pay at Counter (₹${cartTotal.toFixed(0)})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Online UPI Payment Modal (from Active Order Card) */}
      {showUpiModal && activeOrder && (
        <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setShowUpiModal(false)}>
          <div className="modal-card" style={{ maxWidth: 420, padding: 24, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Pay via UPI</h3>
              <button onClick={() => setShowUpiModal(false)} className="btn-close" style={{ background: 'none', border: 'none', fontSize: '1.4rem' }}>
                ×
              </button>
            </div>

            <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#16a34a', marginBottom: 4 }}>
              ₹{activeOrder.total_amount?.toLocaleString('en-IN')}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
              Scan the QR code with any UPI app (GPay, PhonePe, Paytm, CRED)
            </p>

            {upiQrDataUrl && (
              <img
                src={upiQrDataUrl}
                alt="UPI QR Code"
                style={{ width: 180, height: 180, margin: '0 auto 16px', borderRadius: 12, border: '2px solid #e2e8f0' }}
              />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a
                href={`upi://pay?pa=${encodeURIComponent(data?.settings?.upi_id || 'empire.billing@upi')}&pn=${encodeURIComponent(tenant?.name || data?.settings?.restaurant_name || 'Restaurant')}&am=${activeOrder.total_amount}&cu=INR`}
                className="btn btn-primary"
                style={{ background: '#16a34a', borderColor: '#16a34a', justifyContent: 'center', gap: 8 }}
              >
                <Smartphone size={16} /> Pay via PhonePe / GPay / Paytm
              </a>

              <button
                onClick={handleConfirmOnlinePayment}
                disabled={confirmingPayment}
                className="btn btn-outline"
                style={{ justifyContent: 'center', gap: 6, fontWeight: 700 }}
              >
                <Check size={16} color="#16a34a" />
                {confirmingPayment ? 'Verifying...' : 'I Have Completed the Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Customer Digital Receipt Modal */}
      {showGuestReceipt && activeOrder && (
        <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setShowGuestReceipt(false)}>
          <div
            className="modal-card animate-in"
            style={{ maxWidth: 420, padding: 20, background: '#ffffff', borderRadius: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 no-print">
              <div className="flex items-center gap-2">
                <Receipt className="text-primary" size={20} />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Digital Bill Receipt</h3>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>
                  <Printer size={15} /> Print
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowGuestReceipt(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Thermal Receipt Preview */}
            <div
              className="receipt-preview p-4 rounded"
              style={{
                background: '#ffffff',
                color: '#111827',
                fontFamily: 'monospace, Courier New, sans-serif',
                fontSize: '0.82rem',
                border: '1.5px dashed #cbd5e1',
                padding: '16px',
                lineHeight: 1.4,
              }}
            >
              {/* Restaurant Header */}
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: '0 0 2px' }}>
                  {tenant?.name || data?.settings?.restaurant_name || 'EMPIRE RESTAURANT'}
                </h2>
                <div style={{ fontSize: '0.74rem', color: '#4b5563' }}>
                  {data?.settings?.address || 'Main Branch'}
                </div>
                {data?.settings?.gst_number && (
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, marginTop: 3 }}>
                    GSTIN: {data.settings.gst_number}
                  </div>
                )}
              </div>

              {/* Bill Details */}
              <div style={{ borderTop: '1px dashed #94a3b8', borderBottom: '1px dashed #94a3b8', padding: '6px 0', margin: '8px 0', fontSize: '0.75rem' }}>
                <div className="flex justify-between">
                  <span>Order: <strong>{activeOrder.order_number}</strong></span>
                  <span>{new Date(activeOrder.created_at).toLocaleDateString('en-IN')}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Table: <strong>Table {table.table_number}</strong></span>
                  <span>{new Date(activeOrder.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {activeOrder.guest_name && (
                  <div className="flex justify-between mt-1">
                    <span>Guest: {activeOrder.guest_name}</span>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <table style={{ width: '100%', fontSize: '0.76rem', borderCollapse: 'collapse', margin: '8px 0' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #94a3b8' }}>
                    <th style={{ textAlign: 'left', padding: '4px 0' }}>Item</th>
                    <th style={{ textAlign: 'center', padding: '4px 0', width: 40 }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: '4px 0', width: 60 }}>Rate</th>
                    <th style={{ textAlign: 'right', padding: '4px 0', width: 70 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {activeOrder.items?.map((item, i) => (
                    <tr key={item.id || i} style={{ borderBottom: '1px dotted #e2e8f0' }}>
                      <td style={{ padding: '4px 0', fontWeight: 600 }}>{item.item_name}</td>
                      <td style={{ textAlign: 'center', padding: '4px 0' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right', padding: '4px 0' }}>₹{item.item_price}</td>
                      <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: 700 }}>₹{item.total_price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Financial Totals */}
              <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: 6, fontSize: '0.76rem' }}>
                <div className="flex justify-between py-1">
                  <span>Subtotal</span>
                  <span>₹{(activeOrder.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>GST ({data?.settings?.tax_percentage || 5}%)</span>
                  <span>₹{(activeOrder.tax_amount || 0).toFixed(2)}</span>
                </div>
                <div
                  className="flex justify-between py-2"
                  style={{
                    borderTop: '1.5px solid #0f172a',
                    borderBottom: '1.5px solid #0f172a',
                    fontWeight: 900,
                    fontSize: '0.98rem',
                    margin: '6px 0',
                  }}
                >
                  <span>GRAND TOTAL</span>
                  <span>₹{Math.round(activeOrder.total_amount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1" style={{ fontSize: '0.74rem' }}>
                  <span>Payment Status</span>
                  <span style={{ fontWeight: 800 }}>
                    {isPaid ? '🟢 ONLINE (UPI) - PAID ✓' : '💵 PAY AT COUNTER'}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div style={{ textAlign: 'center', marginTop: 12, fontSize: '0.72rem', color: '#64748b' }}>
                Thank you for dining with us! 🙏<br />
                Please visit again!
              </div>
            </div>

            <div className="modal-footer flex justify-between mt-4 no-print" style={{ padding: 0 }}>
              <button className="btn btn-secondary" onClick={() => setShowGuestReceipt(false)}>
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => window.print()}
                style={{ gap: 6, fontWeight: 800 }}
              >
                <Printer size={16} /> Print / Save PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
