import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Plus, Minus, Trash2, X, CreditCard, Banknote, Smartphone, Percent, Receipt, ArrowLeft } from 'lucide-react';
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

  // List view states
  const [orders, setOrders] = useState([]);
  const [viewMode, setViewMode] = useState('pos'); // 'pos' or 'list'
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const newOrder = searchParams.get('new');
    const tableId = searchParams.get('table_id');
    const orderId = searchParams.get('order_id');

    if (newOrder && tableId) {
      createNewOrder(parseInt(tableId));
    } else if (orderId) {
      loadExistingOrder(parseInt(orderId));
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
      items = items.filter((i) => i.category_id === parseInt(activeCategory));
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

  async function handlePayment(method) {
    if (!currentOrder) return;
    try {
      await api.completeOrder(currentOrder.id, { payment_method: method });
      toast.success(`Payment received via ${method}! 🎉`);
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

  // POS mode
  if (viewMode === 'pos' && currentOrder) {
    return (
      <div className="pos-layout">
        {/* Menu Side */}
        <div className="pos-menu">
          <div className="pos-menu-header">
            <button className="btn btn-ghost btn-sm" onClick={() => { setCurrentOrder(null); setCartItems([]); setViewMode('list'); }}>
              <ArrowLeft size={16} /> Back
            </button>
            <div style={{ flex: 1 }}>
              <div className="search-bar">
                <Search className="search-icon" size={18} />
                <input placeholder="Search menu items..." value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="pos-categories">
            <button className={`category-chip ${activeCategory === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCategory('all')}>All</button>
            {categories.filter((c) => c.is_active).map((cat) => (
              <button key={cat.id}
                className={`category-chip ${activeCategory === String(cat.id) ? 'active' : ''}`}
                onClick={() => setActiveCategory(String(cat.id))}>
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>

          <div className="pos-items-grid">
            {filteredItems.map((item) => (
              <div key={item.id} className={`menu-item-card ${!item.is_available ? 'unavailable' : ''}`}
                onClick={() => item.is_available && addToCart(item)}>
                <div className="item-top">
                  <div className="flex items-center gap-2">
                    <span className={`veg-indicator ${item.is_veg ? 'veg' : 'non-veg'}`} />
                    <span className="item-name">{item.name}</span>
                  </div>
                </div>
                <div className="item-price">₹{item.price}</div>
                {item.description && <div className="item-desc">{item.description}</div>}
              </div>
            ))}
            {filteredItems.length === 0 && (
              <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                <div className="empty-icon">🔍</div>
                <h3>No items found</h3>
                <p>Try a different search or category</p>
              </div>
            )}
          </div>
        </div>

        {/* Cart Side */}
        <div className="pos-cart">
          <div className="pos-cart-header">
            <h3>
              🧾 {currentOrder.order_number}
              {currentOrder.table_number && (
                <span className="badge badge-info" style={{ marginLeft: 8 }}>
                  {currentOrder.table_number}
                </span>
              )}
            </h3>
            <span className="badge badge-purple">{currentOrder.order_type}</span>
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
                  <button className="btn btn-icon btn-ghost btn-sm" onClick={() => removeCartItem(i)}
                    style={{ padding: 4, minWidth: 'auto', color: 'var(--accent-danger)' }}>
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
                  <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={() => setShowPayment(true)}>
                    <CreditCard size={14} /> Pay & Close
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={handleCancelOrder}
                    style={{ color: 'var(--accent-danger)' }}>
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
                <div style={{
                  background: 'var(--empire-red-tint)',
                  border: '1.5px solid var(--empire-red-border)',
                  borderRadius: 14,
                  padding: '18px 20px',
                  textAlign: 'center',
                  marginBottom: 20,
                }}>
                  <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--empire-red)', lineHeight: 1.1 }}>
                    ₹{Math.round(currentOrder.total_amount || total).toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-tertiary)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Total Bill Amount
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
                    <button className={`tab ${discountType === 'flat' ? 'active' : ''}`}
                      onClick={() => setDiscountType('flat')}>Flat (₹)</button>
                    <button className={`tab ${discountType === 'percentage' ? 'active' : ''}`}
                      onClick={() => setDiscountType('percentage')}>Percentage (%)</button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Amount</label>
                  <input className="form-input" type="number" value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={discountType === 'flat' ? 'Enter amount in ₹' : 'Enter percentage'} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setShowDiscount(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleApplyDiscount}>Apply Discount</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // List view (default)
  return (
    <div className="page-content">
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => startNewOrder('dine-in')}>
            <Plus size={16} /> New Dine-in
          </button>
          <button className="btn btn-ghost" onClick={() => startNewOrder('takeaway')}>
            <Plus size={16} /> Takeaway
          </button>
          <button className="btn btn-ghost" onClick={() => startNewOrder('delivery')}>
            <Plus size={16} /> Delivery
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Active Orders ({orders.length})</h3>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {orders.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h3>No active orders</h3>
              <p>Create a new order to get started</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Type</th>
                  <th>Table</th>
                  <th>Items</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} style={{ cursor: 'pointer' }}
                    onClick={() => loadExistingOrder(order.id)}>
                    <td style={{ fontWeight: 700 }}>{order.order_number}</td>
                    <td>
                      <span className={`badge ${order.order_type === 'dine-in' ? 'badge-info' : order.order_type === 'takeaway' ? 'badge-warning' : 'badge-purple'}`}>
                        {order.order_type}
                      </span>
                    </td>
                    <td>{order.table_number || '—'}</td>
                    <td>{order.item_count} items</td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-success-light)' }}>
                      ₹{order.total_amount.toLocaleString('en-IN')}
                    </td>
                    <td><span className="badge badge-warning">{order.status}</span></td>
                    <td className="text-muted text-sm">
                      {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                      <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); loadExistingOrder(order.id); }}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
