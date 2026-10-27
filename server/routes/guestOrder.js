const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

// Helper to flexibly find table by 'T1', '1', 't1', 'table-1', etc.
function findTable(db, tableParam, tenantSlug = '') {
  const tenantClause = tenantSlug ? 'AND tenant_slug = ?' : "AND (tenant_slug = '' OR tenant_slug IS NULL)";
  const tenantParams = tenantSlug ? [tenantSlug] : [];

  if (!tableParam) return db.prepare(`SELECT * FROM tables WHERE 1=1 ${tenantClause} ORDER BY id ASC LIMIT 1`).get(...tenantParams);
  const raw = tableParam.toString().trim();
  const lower = raw.toLowerCase();
  const numOnly = lower.replace(/[^0-9]/g, '');

  // 1. Exact or case-insensitive match
  let table = db.prepare(`SELECT * FROM tables WHERE LOWER(table_number) = ? ${tenantClause}`).get(lower, ...tenantParams);
  if (table) return table;

  // 2. Try 'T' + param (e.g. '1' -> 'T1')
  table = db.prepare(`SELECT * FROM tables WHERE LOWER(table_number) = ? ${tenantClause}`).get(`t${lower}`, ...tenantParams);
  if (table) return table;

  // 3. Try number-only match ('T' + numOnly or exact numOnly)
  if (numOnly) {
    table = db.prepare(`SELECT * FROM tables WHERE (LOWER(table_number) = ? OR LOWER(table_number) = ?) ${tenantClause}`).get(`t${numOnly}`, numOnly, ...tenantParams);
    if (table) return table;

    // Try matching by table id
    table = db.prepare(`SELECT * FROM tables WHERE id = ? ${tenantClause}`).get(parseInt(numOnly, 10), ...tenantParams);
    if (table) return table;
  }

  // 4. Fallback to first available table for this tenant
  return db.prepare(`SELECT * FROM tables WHERE 1=1 ${tenantClause} ORDER BY id ASC LIMIT 1`).get(...tenantParams);
}

// Generate guaranteed unique KOT number
function generateKotNumber(db) {
  const now = new Date();
  const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '');
  const rand = Math.floor(10 + Math.random() * 90);
  let kotNum = `KOT-${timeStr}-${rand}`;
  while (db.prepare('SELECT id FROM kot WHERE kot_number = ?').get(kotNum)) {
    kotNum = `KOT-${timeStr}-${Math.floor(100 + Math.random() * 900)}`;
  }
  return kotNum;
}

// Helper to calculate preparation status from KOTs and order items
function computePrepStatus(kots = [], items = []) {
  if (!kots.length && !items.length) return 'received';

  const kotStatuses = kots.map(k => k.status);
  const itemStatuses = items.map(i => i.status);

  // Ready to serve takes high precedence so customer gets notified immediately!
  if (kotStatuses.includes('ready') || itemStatuses.includes('ready')) {
    return 'ready';
  }
  if (kotStatuses.includes('preparing') || itemStatuses.includes('preparing')) {
    return 'preparing';
  }
  if (kotStatuses.length > 0 && kotStatuses.every(s => s === 'completed')) {
    return 'served';
  }
  if (itemStatuses.length > 0 && itemStatuses.every(s => s === 'served')) {
    return 'served';
  }

  return 'received';
}

// GET table menu & active status for QR ordering
router.get('/table/:tableNumber', (req, res) => {
  const db = getDb();
  const { tableNumber } = req.params;
  const tenantSlug = req.headers['x-tenant-slug'] || req.query.tenant_slug || '';

  // Find table flexibly scoped by tenant
  const table = findTable(db, tableNumber, tenantSlug);
  if (!table) {
    return res.status(404).json({ error: 'Table not found. Please verify the QR code.' });
  }

  const effectiveTenantSlug = table.tenant_slug || tenantSlug;

  // Get restaurant profile & settings
  let settings;
  if (effectiveTenantSlug) {
    const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(effectiveTenantSlug);
    if (tenant) {
      settings = {
        restaurant_name: tenant.name,
        address: tenant.address || 'Main Branch',
        phone: tenant.owner_phone || '',
        gst_number: tenant.gst_number || '',
        tax_percentage: tenant.tax_percentage ?? 5.0,
        service_charge_percentage: 0,
        currency_symbol: '₹',
        primary_color: tenant.primary_color || '#e11d24',
        tagline: tenant.tagline || 'Fresh Food & Authentic Experience',
        icon_emoji: tenant.icon_emoji || '🍽️',
        since_year: tenant.since_year || '2024',
        upi_id: 'empire.billing@upi',
        tenant_slug: tenant.slug,
      };
    }
  }

  if (!settings) {
    settings = db.prepare(`
      SELECT restaurant_name, address, phone, gst_number, tax_percentage, service_charge_percentage, currency_symbol, primary_color, tagline, icon_emoji, upi_id 
      FROM settings WHERE id = 1
    `).get();
  }

  // Get active menu categories and items strictly scoped to tenant
  const catClause = effectiveTenantSlug ? 'AND tenant_slug = ?' : "AND (tenant_slug = '' OR tenant_slug IS NULL)";
  const itemClause = effectiveTenantSlug ? 'AND m.tenant_slug = ?' : "AND (m.tenant_slug = '' OR m.tenant_slug IS NULL)";
  const tenantParams = effectiveTenantSlug ? [effectiveTenantSlug] : [];

  const categories = db.prepare(`SELECT * FROM categories WHERE is_active = 1 ${catClause} ORDER BY sort_order, name`).all(...tenantParams);
  const menuItems = db.prepare(`
    SELECT m.*, c.name as category_name 
    FROM menu_items m
    LEFT JOIN categories c ON c.id = m.category_id
    WHERE m.is_available = 1 ${itemClause}
    ORDER BY m.name
  `).all(...tenantParams);

  // Check if this table has an active order
  const activeOrder = db.prepare(`
    SELECT * FROM orders 
    WHERE table_id = ? AND status = 'active'
    ORDER BY id DESC LIMIT 1
  `).get(table.id);

  let activeOrderItems = [];
  let kots = [];
  let prepStatus = 'received';

  if (activeOrder) {
    activeOrderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(activeOrder.id);
    kots = db.prepare('SELECT * FROM kot WHERE order_id = ? ORDER BY id DESC').all(activeOrder.id);
    prepStatus = computePrepStatus(kots, activeOrderItems);
  }

  res.json({
    table: {
      id: table.id,
      table_number: table.table_number,
      capacity: table.capacity,
      floor: table.floor,
      status: table.status,
      tenant_slug: table.tenant_slug,
    },
    settings,
    categories,
    menuItems,
    activeOrder: activeOrder ? {
      ...activeOrder,
      items: activeOrderItems,
      kots,
      prep_status: prepStatus,
    } : null,
  });
});

// POST guest places order via QR code
router.post('/table/:tableNumber/order', (req, res) => {
  const db = getDb();
  const { tableNumber } = req.params;
  const tenantSlug = req.headers['x-tenant-slug'] || req.query.tenant_slug || req.body.tenant_slug || '';
  const {
    items,
    guest_name,
    guest_phone,
    special_instructions,
    payment_preference = 'counter', // 'counter' or 'pay_here'
  } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({ error: 'No items in order' });
  }

  const table = findTable(db, tableNumber, tenantSlug);
  if (!table) {
    return res.status(404).json({ error: 'Table not found' });
  }

  const effectiveTenantSlug = table.tenant_slug || tenantSlug || '';

  let taxRate = 5.0;
  if (effectiveTenantSlug) {
    const tenant = db.prepare('SELECT tax_percentage FROM tenants WHERE slug = ?').get(effectiveTenantSlug);
    if (tenant && tenant.tax_percentage != null) taxRate = tenant.tax_percentage;
  } else {
    const settings = db.prepare('SELECT tax_percentage FROM settings WHERE id = 1').get();
    if (settings && settings.tax_percentage != null) taxRate = settings.tax_percentage;
  }

  const isPayOnline = payment_preference === 'pay_here' || payment_preference === 'upi';
  const paymentMethod = isPayOnline ? 'upi' : 'cash';
  const paymentStatus = isPayOnline ? 'paid' : 'pending';

  const transaction = db.transaction(() => {
    // Check if table already has an active order
    let order = db.prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'active'").get(table.id);

    if (!order) {
      // Create new order
      const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const rand = Math.floor(100 + Math.random() * 900);
      const orderNumber = `ORD-${dateStr}-${rand}`;

      const result = db.prepare(`
        INSERT INTO orders (
          order_number, table_id, order_type, order_source, guest_name, guest_phone,
          special_instructions, payment_preference, payment_method, payment_status, status, tenant_slug
        )
        VALUES (?, ?, 'dine-in', 'qr_guest', ?, ?, ?, ?, ?, ?, 'active', ?)
      `).run(
        orderNumber,
        table.id,
        guest_name || 'Table Guest',
        guest_phone || '',
        special_instructions || '',
        isPayOnline ? 'pay_here' : 'counter',
        paymentMethod,
        paymentStatus,
        effectiveTenantSlug
      );

      order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
    } else {
      // Update existing order with guest info & payment preference if provided
      db.prepare(`
        UPDATE orders SET
          order_source = 'qr_guest',
          guest_name = CASE WHEN ? != '' THEN ? ELSE guest_name END,
          guest_phone = CASE WHEN ? != '' THEN ? ELSE guest_phone END,
          payment_preference = ?,
          payment_method = ?,
          payment_status = CASE WHEN ? = 'paid' THEN 'paid' ELSE payment_status END,
          tenant_slug = CASE WHEN (tenant_slug IS NULL OR tenant_slug = '') THEN ? ELSE tenant_slug END,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        guest_name || '', guest_name || '',
        guest_phone || '', guest_phone || '',
        isPayOnline ? 'pay_here' : 'counter',
        paymentMethod,
        paymentStatus,
        effectiveTenantSlug,
        order.id
      );
    }

    // Insert order items
    const insertItem = db.prepare(`
      INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, item_price, total_price, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const kotItemsList = [];
    for (const item of items) {
      const itemName = item.name || item.item_name || 'Item';
      const menuItemId = item.id || item.menu_item_id || null;
      const unitPrice = parseFloat(item.price || item.item_price || 0);
      const qty = parseInt(item.quantity, 10) || 1;
      const totalItemPrice = unitPrice * qty;

      insertItem.run(
        order.id,
        menuItemId,
        itemName,
        qty,
        unitPrice,
        totalItemPrice,
        item.notes || ''
      );

      kotItemsList.push({
        name: itemName,
        quantity: qty,
        is_veg: item.is_veg ?? 1,
        notes: item.notes || '',
      });
    }

    // Recalculate order subtotal and taxes
    const totalRow = db.prepare(`
      SELECT COALESCE(SUM(total_price), 0) as subtotal 
      FROM order_items 
      WHERE order_id = ? AND status != 'cancelled'
    `).get(order.id);

    const subtotal = totalRow.subtotal;
    const taxAmount = (subtotal * taxRate) / 100;
    const totalAmount = subtotal + taxAmount;

    db.prepare(`
      UPDATE orders 
      SET subtotal = ?, tax_amount = ?, total_amount = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(subtotal, taxAmount, totalAmount, order.id);

    // Generate KOT immediately for kitchen display!
    const kotNumber = generateKotNumber(db);
    const payNote = isPayOnline ? ' • [PAID ONLINE VIA UPI]' : ' • [PAY AT COUNTER]';
    const kotNotes = `📱 QR Order Table ${table.table_number}${special_instructions ? ` • Note: ${special_instructions}` : ''}${payNote}`;

    db.prepare(`
      INSERT INTO kot (kot_number, order_id, table_number, status, items, notes, tenant_slug)
      VALUES (?, ?, ?, 'pending', ?, ?, ?)
    `).run(kotNumber, order.id, table.table_number, JSON.stringify(kotItemsList), kotNotes, effectiveTenantSlug);

    // Update table status to occupied
    db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(table.id);

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      kotNumber,
      totalAmount,
      paymentPreference: isPayOnline ? 'pay_here' : 'counter',
    };
  });

  try {
    const result = transaction();
    res.status(201).json({
      success: true,
      message: 'Order sent directly to kitchen!',
      ...result,
    });
  } catch (err) {
    console.error('QR order placement error:', err);
    res.status(500).json({ error: err.message || 'Failed to place order' });
  }
});

// GET order live status for guest (polled by customer phone)
router.get('/order/:orderId/status', (req, res) => {
  const db = getDb();
  const { orderId } = req.params;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
  const kots = db.prepare('SELECT * FROM kot WHERE order_id = ? ORDER BY id DESC').all(orderId);
  const prepStatus = computePrepStatus(kots, items);

  res.json({
    order: {
      ...order,
      prep_status: prepStatus,
    },
    items,
    kots,
  });
});

// POST guest updates payment preference (Pay Here via UPI vs Pay at Counter)
router.post('/order/:orderId/pay', (req, res) => {
  const db = getDb();
  const { orderId } = req.params;
  const { preference = 'pay_here', transaction_id } = req.body;

  const isOnline = preference === 'pay_here';
  const noteAppend = isOnline
    ? ` [PAID ONLINE VIA UPI - Ref: ${transaction_id || 'CONFIRMED'}]`
    : ` [GUEST CONFIRMED PAY AT COUNTER]`;

  db.prepare(`
    UPDATE orders SET
      payment_preference = ?,
      payment_method = ?,
      payment_status = ?,
      notes = COALESCE(notes, '') || ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    isOnline ? 'pay_here' : 'counter',
    isOnline ? 'upi' : 'cash',
    isOnline ? 'paid' : 'pending',
    noteAppend,
    orderId
  );

  const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  res.json({
    success: true,
    message: isOnline ? 'Payment confirmed! Thank you.' : 'Preference saved: You can pay at the counter.',
    order: updatedOrder,
  });
});

// POST guest requests digital bill at table
router.post('/order/:orderId/request-bill', (req, res) => {
  const db = getDb();
  const { orderId } = req.params;

  db.prepare("UPDATE orders SET notes = COALESCE(notes, '') || ' [GUEST REQUESTED BILL AT TABLE]', updated_at = datetime('now') WHERE id = ?").run(orderId);
  res.json({ success: true, message: 'Captain notified! Your bill is being brought to your table.' });
});

module.exports = router;
