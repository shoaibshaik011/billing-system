import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search, Plus, Minus, Trash2, X, CreditCard, Banknote, Smartphone,
  Percent, Receipt, ArrowLeft, RefreshCw, QrCode, Bell, User, Clock, Check,
  Printer, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as api from '../api';

export default function Orders() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [currentOrder, setCurrentOrder] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [settings, setSettings] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountValue, setDiscountValue] = useState('');
  const [discountType, setDiscountType] = useState('flat');
  const [receiptOrder, setReceiptOrder] = useState(null); // Tax invoice receipt modal state

  // List view states
  const [orders, setOrders] = useState([]);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'pos'
  const [orderFilter, setOrderFilter] = useState('all'); // 'all', 'qr', 'dine-in', 'takeaway'

  // Initial data load and 3-second live polling
  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      api.getOrders({ status: 'active' }).then(setOrders).catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const newOrder = searchParams.get('new');
    const tableId = searchParams.get('table_id');
    const orderId = searchParams.get('order_id');

    if (newOrder && tableId) {
      createNewOrder(parseInt(tableId, 10));
    } else if (orderId) {
      loadExistingOrder(parseInt(orderId, 10));
    }
  }, [searchParams]);

  async function loadData() {
    try {
      const [cats, items, s, orderList] = await Promise.all([
        api.getCategories(),
        api.getMenuItems({ available_only: 'true' }),
        api.getSettings(),
        api.getOrders({ status: 'active' }),
      ]);
      setCategories(cats);
      setMenuItems(items);
      setSettings(s);
      setOrders(orderList);
    } catch (err) {
      toast.error('Failed to load data');
    }
  }

  async function createNewOrder(tableId) {
    try {
      const order = await api.createOrder({
        table_id: tableId,
        order_type: 'dine-in',
      });
      setCurrentOrder(order);
      setCartItems([]);
      setViewMode('pos');
      toast.success(`Order ${order.order_number} created`);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function loadExistingOrder(orderId) {
    try {
      const order = await api.getOrder(orderId);
      setCurrentOrder(order);
      setCartItems(order.items || []);
      setSettings(order.settings || settings);
      setViewMode('pos');
    } catch (err) {
      toast.error('Failed to load order');
    }
  }

  async function startNewOrder(orderType = 'dine-in', tableId = null) {
    try {
      const order = await api.createOrder({ order_type: orderType, table_id: tableId });
      setCurrentOrder(order);
      setCartItems([]);
      setViewMode('pos');
      toast.success(`Order ${order.order_number} created`);
    } catch (err) {
      toast.error(err.message);
    }
  }

  const filteredItems = useMemo(() => {
    let items = menuItems;
    if (activeCategory !== 'all') {
      items = items.filter((i) => i.category_id === parseInt(activeCategory, 10));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter((i) => i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q));
    }
    return items;
  }, [menuItems, activeCategory, searchQuery]);

  function addToCart(menuItem) {
    const existing = cartItems.find((ci) => ci.menu_item_id === menuItem.id && !ci.id);
    if (existing) {
      setCartItems(cartItems.map((ci) =>
        ci === existing ? { ...ci, quantity: ci.quantity + 1, total_price: (ci.quantity + 1) * ci.item_price } : ci
      ));
    } else {
      setCartItems([...cartItems, {
        menu_item_id: menuItem.id,
        item_name: menuItem.name,
        item_price: menuItem.price,
        quantity: 1,
        total_price: menuItem.price,
        is_veg: menuItem.is_veg,
        notes: '',
        isNew: true,
      }]);
    }
  }

  function updateCartQty(index, delta) {
    const newItems = [...cartItems];
    newItems[index].quantity += delta;
    if (newItems[index].quantity <= 0) {
      newItems.splice(index, 1);
    } else {
      newItems[index].total_price = newItems[index].quantity * newItems[index].item_price;
    }
    setCartItems(newItems);
  }

  function removeCartItem(index) {
    const newItems = [...cartItems];
    newItems.splice(index, 1);
    setCartItems(newItems);
  }

  async function sendToKitchen() {
    if (!currentOrder) return;
    const newItems = cartItems.filter((ci) => ci.isNew);
    if (newItems.length === 0) {
      toast('No new items to send');
      return;
    }
    try {
      const result = await api.addOrderItems(currentOrder.id, newItems.map((ci) => ({
        menu_item_id: ci.menu_item_id,
        quantity: ci.quantity,
        notes: ci.notes,
      })));
      setCurrentOrder(result);
      setCartItems(result.items || []);
      toast.success('KOT sent to kitchen! 🍳');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleApplyDiscount() {
    if (!currentOrder) return;
    try {
      const result = await api.applyDiscount(currentOrder.id, {
        discount_amount: parseFloat(discountValue) || 0,
        discount_type: discountType,
      });
      setCurrentOrder({ ...currentOrder, ...result });
      setShowDiscount(false);
      toast.success('Discount applied');
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function openReceipt(orderId) {
    try {
      // If currently editing this order with unsaved items in cart, save them first
      if (currentOrder && currentOrder.id === orderId) {
        const newItems = cartItems.filter((ci) => ci.isNew);
        if (newItems.length > 0) {
          const res = await api.addOrderItems(orderId, newItems.map((ci) => ({
            menu_item_id: ci.menu_item_id,
            quantity: ci.quantity,
            notes: ci.notes,
          })));
          setCurrentOrder(res);
          setCartItems(res.items || []);
        }
      }
      const order = await api.getOrder(orderId);
      setReceiptOrder(order);
    } catch (err) {
      toast.error('Failed to load bill receipt');
    }
  }

  function handlePrintReceipt() {
    window.print();
  }

  async function handlePayment(method) {
    if (!currentOrder) return;
    try {
      // 1. If any items in cart have not been saved/sent to kitchen yet, save them first!
      const newItems = cartItems.filter((ci) => ci.isNew);
      if (newItems.length > 0) {
        await api.addOrderItems(currentOrder.id, newItems.map((ci) => ({
          menu_item_id: ci.menu_item_id,
          quantity: ci.quantity,
          notes: ci.notes,
        })));
      }

      const orderId = currentOrder.id;
      await api.completeOrder(orderId, {
        payment_method: method,
        items: newItems.map((ci) => ({
          menu_item_id: ci.menu_item_id,
          quantity: ci.quantity,
          notes: ci.notes,
        })),
      });

      toast.success(`Payment received via ${method.toUpperCase()}! 🎉`);
      
      // 2. Load freshly completed order with all items & recalculated totals
      const completed = await api.getOrder(orderId);
      setReceiptOrder(completed);

      setCurrentOrder(null);
      setCartItems([]);
      setShowPayment(false);
      setViewMode('list');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleCancelOrder() {
    if (!currentOrder) return;
    if (!window.confirm('Cancel this order?')) return;
    try {
      await api.cancelOrder(currentOrder.id);
      toast.success('Order cancelled');
      setCurrentOrder(null);
      setCartItems([]);
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  }

  // Calculate totals
  const subtotal = cartItems.reduce((sum, ci) => sum + ci.total_price, 0);
  const taxRate = settings?.tax_percentage || 5;
  const serviceRate = settings?.service_charge_percentage || 0;
  const tax = subtotal * (taxRate / 100);
  const serviceCharge = subtotal * (serviceRate / 100);
  const discount = currentOrder
    ? (currentOrder.discount_type === 'percentage'
      ? subtotal * ((currentOrder.discount_amount || 0) / 100)
      : (currentOrder.discount_amount || 0))
    : 0;
  const total = subtotal + tax + serviceCharge - discount;

  // Filtered orders list for list view
  const displayOrders = orders.filter((o) => {
    const isOnline = o.payment_status === 'paid' || o.payment_preference === 'pay_here';
    if (orderFilter === 'qr') return o.order_source === 'qr_guest';
    if (orderFilter === 'counter') return !isOnline;
    if (orderFilter === 'paid_online') return isOnline;
    if (orderFilter === 'dine-in') return o.order_type === 'dine-in' && o.order_source !== 'qr_guest';
    if (orderFilter === 'takeaway') return o.order_type === 'takeaway';
    return true;
  });

  function renderReceiptModal() {
    if (!receiptOrder) return null;

    const receiptItems = receiptOrder.items && receiptOrder.items.length > 0 ? receiptOrder.items : [];
    const hasItems = receiptItems.length > 0;

    return (
      <div className="modal-overlay" onClick={() => setReceiptOrder(null)} style={{ zIndex: 1000 }}>
        <div
          className="modal-card animate-in"
          style={{ maxWidth: 450, padding: 22, background: '#ffffff', borderRadius: 16 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3 no-print">
            <div className="flex items-center gap-2">
              <Receipt className="text-primary" size={20} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>Tax Invoice Receipt</h3>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn btn-primary btn-sm" onClick={handlePrintReceipt} style={{ gap: 4, fontWeight: 700 }}>
                <Printer size={15} /> Print
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setReceiptOrder(null)}>
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Thermal 80mm Receipt Preview */}
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
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: '0 0 2px', letterSpacing: -0.5 }}>
                {settings?.restaurant_name || 'EMPIRE RESTAURANT'}
              </h2>
              <div style={{ fontSize: '0.74rem', color: '#4b5563' }}>
                {settings?.address || 'Main Branch, City'}
              </div>
              {settings?.phone && (
                <div style={{ fontSize: '0.74rem', color: '#4b5563' }}>Ph: {settings?.phone}</div>
              )}
              {settings?.gst_number && (
                <div style={{ fontSize: '0.75rem', fontWeight: 800, marginTop: 4, letterSpacing: 0.5 }}>
                  GSTIN: {settings?.gst_number}
                </div>
              )}
            </div>

            {/* Bill Details */}
            <div style={{ borderTop: '1px dashed #94a3b8', borderBottom: '1px dashed #94a3b8', padding: '6px 0', margin: '8px 0', fontSize: '0.75rem' }}>
              <div className="flex justify-between">
                <span>Bill No: <strong>{receiptOrder.order_number}</strong></span>
                <span>{new Date(receiptOrder.created_at).toLocaleDateString('en-IN')}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span>Type / Table: <strong>{receiptOrder.table_number ? `Table ${receiptOrder.table_number}` : (receiptOrder.order_type || 'Dine-In')}</strong></span>
                <span>{new Date(receiptOrder.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {receiptOrder.guest_name && (
                <div className="flex justify-between mt-1">
                  <span>Guest: {receiptOrder.guest_name}</span>
                  {receiptOrder.guest_phone && <span>{receiptOrder.guest_phone}</span>}
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
                  <th style={{ textAlign: 'right', padding: '4px 0', width: 70 }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {hasItems ? (
                  receiptItems.map((item, i) => (
                    <tr key={item.id || i} style={{ borderBottom: '1px dotted #e2e8f0' }}>
                      <td style={{ padding: '4px 0', fontWeight: 600 }}>{item.item_name}</td>
                      <td style={{ textAlign: 'center', padding: '4px 0' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right', padding: '4px 0' }}>₹{(item.item_price ?? item.unit_price ?? (item.total_price / (item.quantity || 1)))}</td>
                      <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: 700 }}>₹{item.total_price}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '8px 0', color: '#94a3b8' }}>
                      No items recorded
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Financial Totals */}
            <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: 6, fontSize: '0.76rem' }}>
              <div className="flex justify-between py-1">
                <span>Subtotal</span>
                <span>₹{(receiptOrder.subtotal || 0).toFixed(2)}</span>
              </div>
              {receiptOrder.discount_amount > 0 && (
                <div className="flex justify-between py-1 text-danger">
                  <span>Discount</span>
                  <span>-₹{receiptOrder.discount_amount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span>GST ({settings?.tax_percentage || 5}%)</span>
                <span>₹{(receiptOrder.tax_amount || 0).toFixed(2)}</span>
              </div>
              {receiptOrder.service_charge > 0 && (
                <div className="flex justify-between py-1">
                  <span>Service Charge</span>
                  <span>₹{receiptOrder.service_charge.toFixed(2)}</span>
                </div>
              )}

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
                <span>₹{Math.round(receiptOrder.total_amount || 0).toLocaleString('en-IN')}</span>
              </div>

              <div className="flex justify-between py-1" style={{ fontSize: '0.74rem' }}>
                <span>Payment Mode</span>
                <span style={{ fontWeight: 800, textTransform: 'uppercase' }}>
                  {receiptOrder.payment_method === 'cash'
                    ? '💵 CASH (PAID ✓)'
                    : receiptOrder.payment_method === 'card'
                    ? '💳 CARD (PAID ✓)'
                    : receiptOrder.payment_method === 'upi'
                    ? (receiptOrder.payment_preference === 'pay_here' ? '🟢 ONLINE (UPI) - PAID ✓' : '📱 UPI / QR (PAID ✓)')
                    : receiptOrder.payment_method === 'split'
                    ? '🧾 SPLIT (PAID ✓)'
                    : receiptOrder.status === 'completed'
                    ? `${(receiptOrder.payment_method || 'CASH').toUpperCase()} (PAID ✓)`
                    : (receiptOrder.payment_preference === 'pay_here' ? '🟢 ONLINE (UPI) - PAID ✓' : '💵 PAY AT COUNTER')}
                </span>
              </div>

              <div className="flex justify-between py-1" style={{ fontSize: '0.74rem' }}>
                <span>Status</span>
                <span style={{ fontWeight: 800, color: receiptOrder.status === 'completed' || receiptOrder.payment_status === 'paid' ? '#15803d' : '#b45309' }}>
                  {receiptOrder.status === 'completed' || receiptOrder.payment_status === 'paid' ? 'SETTLED / PAID' : 'PENDING SETTLEMENT'}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', marginTop: 14, fontSize: '0.72rem', color: '#64748b' }}>
              ✨ Thank you for dining with us! 🙏<br />
              Visit Again soon!
            </div>
          </div>

          <div className="modal-footer flex justify-between mt-4 no-print" style={{ padding: 0 }}>
            <button className="btn btn-secondary" onClick={() => setReceiptOrder(null)}>
              Close
            </button>
            <button className="btn btn-primary" onClick={handlePrintReceipt} style={{ gap: 6, fontWeight: 800 }}>
              <Printer size={16} /> Print Tax Receipt
            </button>
          </div>
        </div>
      </div>
    );
  }

  // POS mode
  if (viewMode === 'pos' && currentOrder) {
    const isQrOrder = currentOrder.order_source === 'qr_guest';
    const isPaidOnline = currentOrder.payment_status === 'paid' || currentOrder.payment_preference === 'pay_here';

    return (
      <div className="pos-layout">
        {/* Menu Side */}
        <div className="pos-menu">
          {/* Incoming QR Order Alert Banner in POS Mode */}
          {orders.some((o) => o.order_source === 'qr_guest' && o.id !== currentOrder?.id) && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 8,
                padding: '8px 12px',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.8rem',
                color: '#991b1b',
                fontWeight: 700,
              }}
            >
              <div className="flex items-center gap-2">
                <span>🔔</span>
                <span>
                  {orders.filter((o) => o.order_source === 'qr_guest' && o.id !== currentOrder?.id).length} Table QR
                  Order(s) Waiting in Queue!
                </span>
              </div>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  setCurrentOrder(null);
                  setCartItems([]);
                  setViewMode('list');
                }}
                style={{ fontSize: '0.74rem', padding: '3px 10px' }}
              >
                View Orders Queue ↗
              </button>
            </div>
          )}

          <div className="pos-menu-header">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setCurrentOrder(null);
                setCartItems([]);
                setViewMode('list');
              }}
              style={{ fontWeight: 700, gap: 6 }}
            >
              <ArrowLeft size={16} /> All Active Orders ({orders.length})
              {orders.some((o) => o.order_source === 'qr_guest') && (
                <span
                  style={{
                    background: 'var(--empire-red)',
                    color: '#ffffff',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: 10,
                  }}
                >
                  📱 {orders.filter((o) => o.order_source === 'qr_guest').length} QR
                </span>
              )}
            </button>
            <div style={{ flex: 1 }}>
              <div className="search-bar">
                <Search className="search-icon" size={18} />
                <input
                  placeholder="Search menu items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="pos-categories">
            <button
              className={`category-chip ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCategory('all')}
            >
              All
            </button>
            {categories.filter((c) => c.is_active).map((cat) => (
              <button
                key={cat.id}
                className={`category-chip ${activeCategory === String(cat.id) ? 'active' : ''}`}
                onClick={() => setActiveCategory(String(cat.id))}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>

          <div className="pos-items-grid">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className={`menu-item-card ${!item.is_available ? 'unavailable' : ''}`}
                onClick={() => item.is_available && addToCart(item)}
              >
                <div className="item-top">
                  <div className="flex items-center gap-2">
                    <span className={`veg-indicator ${item.is_veg ? 'veg' : 'non-veg'}`} />
                    <span className="item-name">{item.name}</span>
                  </div>
                </div>
                <div className="item-bottom">
                  <span className="item-price">₹{item.price}</span>
                  <span className="item-prep">⏱ {item.preparation_time}m</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cart Side */}
        <div className="pos-cart">
          {/* Order Header Banner */}
          <div
            className="cart-header"
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-primary)',
              background: isQrOrder ? 'var(--empire-red-tint)' : '#ffffff',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>
                    {currentOrder.order_number}
                  </span>
                  {isQrOrder && (
                    <span
                      style={{
                        background: 'var(--empire-red)',
                        color: '#ffffff',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <QrCode size={11} /> Table {currentOrder.table_number} QR
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                  {currentOrder.table_number ? `Table ${currentOrder.table_number}` : currentOrder.order_type}
                  {currentOrder.guest_name ? ` • Guest: ${currentOrder.guest_name}` : ''}
                </div>
              </div>

              {/* Payment Status Pill */}
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: 20,
                  background: isPaidOnline ? '#dcfce7' : '#fef3c7',
                  color: isPaidOnline ? '#15803d' : '#854d0e',
                }}
              >
                {isPaidOnline ? 'Paid Online (UPI) ✓' : 'Pay at Counter'}
              </span>
            </div>

            {/* If guest requested bill banner */}
            {currentOrder.notes?.includes('GUEST REQUESTED BILL') && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fee2e2',
                  padding: '6px 10px',
                  borderRadius: 8,
                  marginTop: 8,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#991b1b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Bell size={13} color="#ef4444" />
                <span>Guest at Table {currentOrder.table_number} requested final bill!</span>
              </div>
            )}
          </div>

          <div className="cart-items">
            {cartItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🛒</div>
                <h3>Cart is empty</h3>
                <p>Tap items from the menu to add</p>
              </div>
            ) : (
              cartItems.map((item, i) => (
                <div key={i} className="cart-item">
                  <span className={`veg-indicator ${item.is_veg ? 'veg' : 'non-veg'}`} />
                  <div className="cart-item-info">
                    <div className="cart-item-name">{item.item_name}</div>
                    <div className="cart-item-price">₹{item.item_price} each</div>
                  </div>
                  <div className="qty-controls">
                    <button className="qty-btn" onClick={() => updateCartQty(i, -1)}>
                      <Minus size={12} />
                    </button>
                    <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
                    <button className="qty-btn" onClick={() => updateCartQty(i, 1)}>
                      <Plus size={12} />
                    </button>
                  </div>
                  <div className="cart-item-total">₹{item.total_price}</div>
                  <button
                    className="btn btn-icon btn-ghost btn-sm"
                    onClick={() => removeCartItem(i)}
                    style={{ padding: 4, minWidth: 'auto', color: 'var(--accent-danger)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          {cartItems.length > 0 && (
            <>
              <div className="cart-summary">
                <div className="cart-summary-row">
                  <span className="text-muted">Subtotal</span>
                  <span>₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="cart-summary-row">
                  <span className="text-muted">Tax ({taxRate}%)</span>
                  <span>₹{tax.toFixed(2)}</span>
                </div>
                {serviceRate > 0 && (
                  <div className="cart-summary-row">
                    <span className="text-muted">Service ({serviceRate}%)</span>
                    <span>₹{serviceCharge.toFixed(2)}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="cart-summary-row" style={{ color: 'var(--accent-success-light)' }}>
                    <span>Discount</span>
                    <span>-₹{discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="cart-summary-row total">
                  <span>Total</span>
                  <span>₹{Math.round(total).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Customer Payment Preference Callout in POS */}
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: isPaidOnline ? '#f0fdf4' : '#fffbeb',
                  border: `1.5px solid ${isPaidOnline ? '#86efac' : '#fde047'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: '1.2rem' }}>{isPaidOnline ? '🟢' : '💵'}</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.82rem', color: isPaidOnline ? '#15803d' : '#92400e' }}>
                      {isPaidOnline ? 'Paid Online via UPI' : 'Payment Preference: Pay at Counter'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: isPaidOnline ? '#166534' : '#a16207' }}>
                      {isPaidOnline
                        ? 'Customer verified online UPI payment'
                        : 'Customer will settle cash, card or UPI at counter'}
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    background: isPaidOnline ? '#16a34a' : '#d97706',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.68rem',
                    padding: '3px 8px',
                    borderRadius: 12,
                  }}
                >
                  {isPaidOnline ? 'PAID ✓' : 'PAY AT COUNTER'}
                </span>
              </div>

              <div className="cart-actions" style={{ flexDirection: 'column' }}>
                <div className="flex gap-2" style={{ width: '100%' }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={sendToKitchen}>
                    🍳 Send to Kitchen
                  </button>
                </div>
                <div className="flex gap-2" style={{ width: '100%' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowDiscount(true)}>
                    <Percent size={14} /> Discount
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => openReceipt(currentOrder.id)}
                    title="Preview Bill Receipt"
                  >
                    <Receipt size={14} /> Bill
                  </button>
                  <button
                    className="btn btn-success btn-sm"
                    style={{ flex: 1, fontWeight: 800 }}
                    onClick={() => {
                      if (cartItems.length === 0) {
                        toast.error('Please add dishes to order before settling bill!');
                        return;
                      }
                      setShowPayment(true);
                    }}
                  >
                    <CreditCard size={14} /> {isPaidOnline ? '🟢 Settle & Close' : '💵 Settle Bill'}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={handleCancelOrder}
                    style={{ color: 'var(--accent-danger)' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Payment Modal */}
        {showPayment && (
          <div className="modal-overlay" onClick={() => setShowPayment(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
              <div className="modal-header">
                <h2>Select Payment Method</h2>
                <button className="btn btn-icon btn-ghost" onClick={() => setShowPayment(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <div
                  style={{
                    background: 'var(--empire-red-tint)',
                    border: '1.5px solid var(--empire-red-border)',
                    borderRadius: 14,
                    padding: '18px 20px',
                    textAlign: 'center',
                    marginBottom: 20,
                  }}
                >
                  <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--empire-red)', lineHeight: 1.1 }}>
                    ₹{Math.round(currentOrder.total_amount || total).toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-tertiary)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {isPaidOnline ? 'Already Paid Online via UPI' : 'Total Bill Amount'}
                  </div>
                </div>

                <div className="grid-2" style={{ gap: 14 }}>
                  {[
                    { method: 'cash', icon: <Banknote size={32} />, label: 'Cash', color: 'var(--accent-success)' },
                    { method: 'card', icon: <CreditCard size={32} />, label: 'Card', color: 'var(--accent-info)' },
                    { method: 'upi', icon: <Smartphone size={32} />, label: 'UPI / QR', color: 'var(--empire-red)' },
                    { method: 'split', icon: <Receipt size={32} />, label: 'Split Bill', color: 'var(--accent-warning)' },
                  ].map((pm) => (
                    <button
                      key={pm.method}
                      className="card"
                      onClick={() => handlePayment(pm.method)}
                      style={{
                        cursor: 'pointer',
                        padding: '20px 16px',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 10,
                        border: '1.5px solid var(--border-primary)',
                        background: '#ffffff',
                        transition: 'all 150ms ease',
                      }}
                    >
                      <div style={{ color: pm.color }}>{pm.icon}</div>
                      <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{pm.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Discount Modal */}
        {showDiscount && (
          <div className="modal-overlay" onClick={() => setShowDiscount(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
              <div className="modal-header">
                <h2>Apply Discount</h2>
                <button className="btn btn-icon btn-ghost" onClick={() => setShowDiscount(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Discount Type</label>
                  <div className="tabs">
                    <button className={`tab ${discountType === 'flat' ? 'active' : ''}`} onClick={() => setDiscountType('flat')}>
                      Flat (₹)
                    </button>
                    <button className={`tab ${discountType === 'percentage' ? 'active' : ''}`} onClick={() => setDiscountType('percentage')}>
                      Percentage (%)
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Amount</label>
                  <input
                    className="form-input"
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={discountType === 'flat' ? 'Enter amount in ₹' : 'Enter percentage'}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setShowDiscount(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleApplyDiscount}>Apply Discount</button>
              </div>
            </div>
          </div>
        )}

        {/* Tax Invoice Receipt Modal */}
        {renderReceiptModal()}
      </div>
    );
  }

  // Active Orders List View (Default)
  return (
    <div className="page-content" style={{ paddingBottom: 60 }}>
      {/* Top Action & Navigation Bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => startNewOrder('dine-in')}>
            <Plus size={16} /> New Dine-in Table
          </button>
          <button className="btn btn-outline" onClick={() => startNewOrder('takeaway')}>
            <Plus size={16} /> Takeaway
          </button>
          <button className="btn btn-outline" onClick={() => startNewOrder('delivery')}>
            <Plus size={16} /> Delivery
          </button>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `All Orders (${orders.length})` },
            { id: 'qr', label: `📱 Table QR (${orders.filter((o) => o.order_source === 'qr_guest').length})` },
            {
              id: 'counter',
              label: `💵 Pay at Counter (${orders.filter((o) => !(o.payment_status === 'paid' || o.payment_preference === 'pay_here')).length})`,
            },
            {
              id: 'paid_online',
              label: `🟢 Paid Online (${orders.filter((o) => o.payment_status === 'paid' || o.payment_preference === 'pay_here').length})`,
            },
            {
              id: 'dine-in',
              label: `Dine-in (${orders.filter((o) => o.order_type === 'dine-in' && o.order_source !== 'qr_guest').length})`,
            },
            { id: 'takeaway', label: `Takeaway (${orders.filter((o) => o.order_type === 'takeaway').length})` },
          ].map((flt) => (
            <button
              key={flt.id}
              onClick={() => setOrderFilter(flt.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 20,
                border: orderFilter === flt.id ? '1.5px solid var(--empire-red)' : '1px solid var(--border-primary)',
                background: orderFilter === flt.id ? 'var(--empire-red-tint)' : '#ffffff',
                color: orderFilter === flt.id ? 'var(--empire-red)' : 'var(--text-secondary)',
                fontWeight: orderFilter === flt.id ? 800 : 600,
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              {flt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table Card */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 style={{ margin: 0 }}>Active Orders ({displayOrders.length})</h3>
            <span style={{ fontSize: '0.72rem', background: '#ecfdf5', color: '#15803d', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
              Live Polling Active (3s)
            </span>
          </div>

          <button onClick={loadData} className="btn btn-ghost btn-sm" style={{ gap: 4 }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
          {displayOrders.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div className="empty-icon" style={{ fontSize: '2.5rem', marginBottom: 8 }}>📋</div>
              <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 800 }}>No active orders found</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                When customers order via table QR or you create a counter order, they will appear here in real-time.
              </p>
            </div>
          ) : (
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid var(--border-primary)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Order #</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Source & Table</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Guest Info</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Items</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Amount</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Payment</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left' }}>Time</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayOrders.map((order) => {
                  const isQr = order.order_source === 'qr_guest';
                  const isPaidOnline = order.payment_status === 'paid' || order.payment_preference === 'pay_here';
                  const billRequested = order.notes?.includes('GUEST REQUESTED BILL');

                  return (
                    <tr
                      key={order.id}
                      style={{
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border-primary)',
                        background: billRequested ? '#fef2f2' : '#ffffff',
                      }}
                      onClick={() => loadExistingOrder(order.id)}
                    >
                      {/* Order Number */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                          {order.order_number}
                        </div>
                        {billRequested && (
                          <span
                            style={{
                              background: '#fee2e2',
                              color: '#991b1b',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: 4,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                              marginTop: 2,
                            }}
                          >
                            <Bell size={10} color="#ef4444" /> Bill Requested
                          </span>
                        )}
                      </td>

                      {/* Source & Table */}
                      <td style={{ padding: '14px 16px' }}>
                        <div className="flex items-center gap-1.5">
                          {isQr ? (
                            <span
                              style={{
                                background: 'var(--empire-red-tint)',
                                color: 'var(--empire-red)',
                                border: '1px solid var(--empire-red-border)',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: 12,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <QrCode size={12} /> Table {order.table_number || 'QR'}
                            </span>
                          ) : (
                            <span
                              className={`badge ${
                                order.order_type === 'dine-in'
                                  ? 'badge-info'
                                  : order.order_type === 'takeaway'
                                  ? 'badge-warning'
                                  : 'badge-purple'
                              }`}
                            >
                              {order.table_number ? `Table ${order.table_number}` : order.order_type}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Guest Details */}
                      <td style={{ padding: '14px 16px', fontSize: '0.82rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {order.guest_name || order.customer_name || 'Guest'}
                        </div>
                        {(order.guest_phone || order.customer_phone) && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            {order.guest_phone || order.customer_phone}
                          </div>
                        )}
                      </td>

                      {/* Item Count */}
                      <td style={{ padding: '14px 16px', fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 600 }}>{order.item_count} items</span>
                      </td>

                      {/* Total Amount */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--text-primary)' }}>
                          ₹{order.total_amount?.toLocaleString('en-IN')}
                        </span>
                      </td>

                      {/* Payment Status Pill */}
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            padding: '4px 10px',
                            borderRadius: 12,
                            background: isPaidOnline ? '#dcfce7' : '#fffbeb',
                            color: isPaidOnline ? '#15803d' : '#92400e',
                            border: `1.5px solid ${isPaidOnline ? '#86efac' : '#fde047'}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            boxShadow: isPaidOnline ? '0 1px 4px rgba(22, 163, 74, 0.15)' : '0 1px 4px rgba(217, 119, 6, 0.15)',
                          }}
                        >
                          {isPaidOnline ? '🟢 Paid Online (UPI) ✓' : '💵 Pay at Counter'}
                        </span>
                      </td>

                      {/* Time */}
                      <td style={{ padding: '14px 16px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      {/* Action Buttons */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="btn btn-sm btn-secondary"
                            style={{ fontSize: '0.78rem', padding: '5px 10px', fontWeight: 700, gap: 4 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openReceipt(order.id);
                            }}
                            title="View & Print Bill Receipt"
                          >
                            <Receipt size={14} /> Receipt
                          </button>
                          <button
                            className="btn btn-sm btn-primary"
                            style={{ fontSize: '0.78rem', padding: '5px 12px', fontWeight: 700 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              loadExistingOrder(order.id);
                            }}
                          >
                            Open in POS ↗
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Printable Tax Invoice / Receipt Modal */}
      {renderReceiptModal()}
    </div>
  );
}
