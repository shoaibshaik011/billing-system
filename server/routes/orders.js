const express = require('express');
const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

function generateOrderNumber() {
  const now = new Date();
  const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD-${dateStr}-${rand}`;
}

function generateKotNumber() {
  const now = new Date();
  const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '');
  const rand = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return `KOT-${timeStr}-${rand}`;
}

function recalculateOrder(db, orderId) {
  const items = db.prepare(
    "SELECT * FROM order_items WHERE order_id = ? AND status != 'cancelled'"
  ).all(orderId);

  const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);

  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);

  const taxAmount = subtotal * (settings.tax_percentage / 100);
  const serviceCharge = subtotal * (settings.service_charge_percentage / 100);

  let discountAmount = 0;
  if (order.discount_type === 'percentage' && order.discount_amount > 0) {
    discountAmount = subtotal * (order.discount_amount / 100);
  } else {
    discountAmount = order.discount_amount || 0;
  }

  const totalAmount = subtotal + taxAmount + serviceCharge - discountAmount;

  db.prepare(`
    UPDATE orders SET subtotal=?, tax_amount=?, service_charge=?, total_amount=?, updated_at=datetime('now')
    WHERE id=?
  `).run(
    Math.round(subtotal * 100) / 100,
    Math.round(taxAmount * 100) / 100,
    Math.round(serviceCharge * 100) / 100,
    Math.round(totalAmount * 100) / 100,
    orderId
  );

  return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
}

// GET all orders
router.get('/', (req, res) => {
  const db = getDb();
  const { status, date, limit, order_type } = req.query;
  let query = `
    SELECT o.*, t.table_number, c.name as customer_name, c.phone as customer_phone,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.status != 'cancelled') as item_count
    FROM orders o
    LEFT JOIN tables t ON t.id = o.table_id
    LEFT JOIN customers c ON c.id = o.customer_id
  `;
  const conditions = [];
  const params = [];

  const tenantSlug = req.headers['x-tenant-slug'] || req.query.tenant_slug || '';

  if (tenantSlug) {
    conditions.push('o.tenant_slug = ?');
    params.push(tenantSlug);
  } else {
    conditions.push("(o.tenant_slug = '' OR o.tenant_slug IS NULL)");
  }

  if (status) {
    conditions.push('o.status = ?');
    params.push(status);
  }
  if (order_type) {
    conditions.push('o.order_type = ?');
    params.push(order_type);
  }
  if (date) {
    conditions.push("DATE(o.created_at) = ?");
    params.push(date);
  }
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY o.created_at DESC';
  if (limit) {
    query += ' LIMIT ?';
    params.push(parseInt(limit));
  }

  const orders = db.prepare(query).all(...params);
  res.json(orders);
});

// GET single order with items
router.get('/:id', (req, res) => {
  const db = getDb();

  try {
    recalculateOrder(db, req.params.id);
  } catch (err) {}

  const order = db.prepare(`
    SELECT o.*, t.table_number, c.name as customer_name, c.phone as customer_phone
    FROM orders o
    LEFT JOIN tables t ON t.id = o.table_id
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE o.id = ?
  `).get(req.params.id);

  if (!order) return res.status(404).json({ error: 'Order not found' });

  const items = db.prepare(`
    SELECT oi.*, m.is_veg, m.category_id, cat.name as category_name
    FROM order_items oi
    LEFT JOIN menu_items m ON m.id = oi.menu_item_id
    LEFT JOIN categories cat ON cat.id = m.category_id
    WHERE oi.order_id = ?
    ORDER BY oi.created_at
  `).all(req.params.id);

  const kots = db.prepare('SELECT * FROM kot WHERE order_id = ? ORDER BY created_at').all(req.params.id);
  
  let settings = null;
  if (order.tenant_slug) {
    const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(order.tenant_slug);
    if (tenant) {
      settings = {
        restaurant_name: tenant.name,
        address: tenant.address,
        phone: tenant.owner_phone,
        gst_number: tenant.gst_number,
        tax_percentage: tenant.tax_percentage || 5.0,
        primary_color: tenant.primary_color,
      };
    }
  }
  if (!settings) {
    settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  }

  res.json({ ...order, items, kots, settings });
});

// POST create new order
router.post('/', (req, res) => {
  const db = getDb();
  const { table_id, customer_id, order_type, waiter_name, notes } = req.body;
  const tenantSlug = req.headers['x-tenant-slug'] || req.body.tenant_slug || '';

  try {
    const orderNumber = generateOrderNumber();

    const result = db.prepare(`
      INSERT INTO orders (order_number, table_id, customer_id, order_type, waiter_name, notes, tenant_slug)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(orderNumber, table_id || null, customer_id || null, order_type || 'dine-in', waiter_name || '', notes || '', tenantSlug);

    // Update table status if dine-in
    if (table_id && order_type !== 'takeaway' && order_type !== 'delivery') {
      db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(table_id);
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST add items to order
router.post('/:id/items', (req, res) => {
  const db = getDb();
  const orderId = req.params.id;
  const { items } = req.body; // Array of { menu_item_id, quantity, notes }

  try {
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, menu_item_id, item_name, item_price, quantity, total_price, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const kotItems = [];

    const addItems = db.transaction(() => {
      for (const item of items) {
        const menuItem = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(item.menu_item_id);
        if (!menuItem) continue;

        const qty = item.quantity || 1;
        const totalPrice = menuItem.price * qty;

        insertItem.run(orderId, menuItem.id, menuItem.name, menuItem.price, qty, totalPrice, item.notes || '');

        kotItems.push({
          name: menuItem.name,
          quantity: qty,
          notes: item.notes || '',
          is_veg: menuItem.is_veg,
        });
      }
    });
    addItems();

    // Create KOT
    if (kotItems.length > 0) {
      const kotNumber = generateKotNumber();
      const order = db.prepare('SELECT o.*, t.table_number FROM orders o LEFT JOIN tables t ON t.id = o.table_id WHERE o.id = ?').get(orderId);

      db.prepare(`
        INSERT INTO kot (kot_number, order_id, table_number, items, notes)
        VALUES (?, ?, ?, ?, ?)
      `).run(kotNumber, orderId, order.table_number || '', JSON.stringify(kotItems), '');
    }

    const updatedOrder = recalculateOrder(db, orderId);
    const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

    res.json({ ...updatedOrder, items: orderItems });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update order item quantity
router.put('/:orderId/items/:itemId', (req, res) => {
  const db = getDb();
  const { quantity, notes, status } = req.body;

  if (quantity !== undefined) {
    const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(req.params.itemId);
    if (item) {
      const totalPrice = item.item_price * quantity;
      db.prepare("UPDATE order_items SET quantity=?, total_price=?, notes=?, updated_at=datetime('now') WHERE id=?")
        .run(quantity, totalPrice, notes ?? item.notes, req.params.itemId);
    }
  }
  if (status) {
    db.prepare("UPDATE order_items SET status=?, updated_at=datetime('now') WHERE id=?")
      .run(status, req.params.itemId);
  }

  const updatedOrder = recalculateOrder(db, req.params.orderId);
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.orderId);
  res.json({ ...updatedOrder, items });
});

// DELETE remove item from order
router.delete('/:orderId/items/:itemId', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM order_items WHERE id = ? AND order_id = ?').run(req.params.itemId, req.params.orderId);
  const updatedOrder = recalculateOrder(db, req.params.orderId);
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.orderId);
  res.json({ ...updatedOrder, items });
});

// PATCH apply discount
router.patch('/:id/discount', (req, res) => {
  const db = getDb();
  const { discount_amount, discount_type } = req.body;
  db.prepare("UPDATE orders SET discount_amount=?, discount_type=?, updated_at=datetime('now') WHERE id=?")
    .run(discount_amount || 0, discount_type || 'flat', req.params.id);
  const updatedOrder = recalculateOrder(db, req.params.id);
  res.json(updatedOrder);
});

// PATCH complete order (generate bill)
router.patch('/:id/complete', (req, res) => {
  const db = getDb();
  const { payment_method, customer_id, items } = req.body;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  // If unsaved items were passed with the settlement
  if (items && Array.isArray(items) && items.length > 0) {
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, menu_item_id, item_name, item_price, quantity, total_price, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const kotItems = [];

    const addItems = db.transaction(() => {
      for (const item of items) {
        const menuItem = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(item.menu_item_id);
        if (!menuItem) continue;

        const qty = item.quantity || 1;
        const totalPrice = menuItem.price * qty;

        insertItem.run(req.params.id, menuItem.id, menuItem.name, menuItem.price, qty, totalPrice, item.notes || '');

        kotItems.push({
          name: menuItem.name,
          quantity: qty,
          notes: item.notes || '',
          is_veg: menuItem.is_veg,
        });
      }
    });
    addItems();

    if (kotItems.length > 0) {
      const kotNumber = generateKotNumber();
      db.prepare(`
        INSERT INTO kot (kot_number, order_id, table_number, items, notes, status)
        VALUES (?, ?, ?, ?, ?, 'completed')
      `).run(kotNumber, req.params.id, order.table_number || '', JSON.stringify(kotItems), '');
    }
  }

  // Always recalculate order totals from order_items
  recalculateOrder(db, req.params.id);

  db.prepare(`
    UPDATE orders SET status='completed', payment_method=?, payment_status='paid', 
    customer_id=COALESCE(?, customer_id), completed_at=datetime('now'), updated_at=datetime('now')
    WHERE id=?
  `).run(payment_method || 'cash', customer_id || null, req.params.id);

  // Free up table
  if (order.table_id) {
    db.prepare("UPDATE tables SET status = 'available' WHERE id = ?").run(order.table_id);
  }

  // Update customer stats
  const finalOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (finalOrder.customer_id) {
    db.prepare(`
      UPDATE customers SET total_visits = total_visits + 1, total_spent = total_spent + ?,
      loyalty_points = loyalty_points + ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(finalOrder.total_amount, Math.floor(finalOrder.total_amount / 10), finalOrder.customer_id);
  }

  // Complete all KOTs
  db.prepare("UPDATE kot SET status = 'completed', updated_at = datetime('now') WHERE order_id = ?").run(req.params.id);

  res.json(finalOrder);
});

// PATCH cancel order
router.patch('/:id/cancel', (req, res) => {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  db.prepare("UPDATE orders SET status='cancelled', updated_at=datetime('now') WHERE id=?").run(req.params.id);

  if (order.table_id) {
    db.prepare("UPDATE tables SET status = 'available' WHERE id = ?").run(order.table_id);
  }

  res.json({ success: true });
});

module.exports = router;
