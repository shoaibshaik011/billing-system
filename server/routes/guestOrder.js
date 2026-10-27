const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

// Helper to flexibly find table by 'T1', '1', 't1', 'table-1', etc.
function findTable(db, tableParam) {
  if (!tableParam) return db.prepare('SELECT * FROM tables ORDER BY id ASC LIMIT 1').get();
  const raw = tableParam.toString().trim();
  const lower = raw.toLowerCase();
  const numOnly = lower.replace(/[^0-9]/g, '');

  // 1. Exact or case-insensitive match
  let table = db.prepare('SELECT * FROM tables WHERE LOWER(table_number) = ?').get(lower);
  if (table) return table;

  // 2. Try 'T' + param (e.g. '1' -> 'T1')
  table = db.prepare('SELECT * FROM tables WHERE LOWER(table_number) = ?').get(`t${lower}`);
  if (table) return table;

  // 3. Try number-only match ('T' + numOnly or exact numOnly)
  if (numOnly) {
    table = db.prepare('SELECT * FROM tables WHERE LOWER(table_number) = ? OR LOWER(table_number) = ?').get(`t${numOnly}`, numOnly);
    if (table) return table;

    // Try matching by table id
    table = db.prepare('SELECT * FROM tables WHERE id = ?').get(parseInt(numOnly, 10));
    if (table) return table;
  }

  // 4. Fallback to first available table
  return db.prepare('SELECT * FROM tables ORDER BY id ASC LIMIT 1').get();
}

// GET table menu & active status for QR ordering
router.get('/table/:tableNumber', (req, res) => {
  const db = getDb();
  const { tableNumber } = req.params;

  // Find table flexibly
  const table = findTable(db, tableNumber);
  if (!table) {
    return res.status(404).json({ error: 'Table not found. Please verify the QR code.' });
  }

  // Get restaurant profile & settings
  const settings = db.prepare('SELECT restaurant_name, address, phone, gst_number, tax_percentage, currency_symbol FROM settings WHERE id = 1').get();

  // Get active menu categories and items
  const categories = db.prepare('SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order, name').all();
  const menuItems = db.prepare(`
    SELECT m.*, c.name as category_name 
    FROM menu_items m
    LEFT JOIN categories c ON c.id = m.category_id
    WHERE m.is_available = 1
    ORDER BY m.name
  `).all();

  // Check if this table has an active order
  const activeOrder = db.prepare(`
    SELECT * FROM orders 
    WHERE table_id = ? AND status = 'active'
    ORDER BY id DESC LIMIT 1
  `).get(table.id);

  let activeOrderItems = [];
  let kots = [];
  if (activeOrder) {
    activeOrderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(activeOrder.id);
    kots = db.prepare('SELECT * FROM kot WHERE order_id = ? ORDER BY id DESC').all(activeOrder.id);
  }

  res.json({
    table: {
      id: table.id,
      table_number: table.table_number,
      capacity: table.capacity,
      floor: table.floor,
      status: table.status,
    },
    settings,
    categories,
    menuItems,
    activeOrder: activeOrder ? { ...activeOrder, items: activeOrderItems, kots } : null,
  });
});

// POST guest places order via QR code
router.post('/table/:tableNumber/order', (req, res) => {
  const db = getDb();
  const { tableNumber } = req.params;
  const { items, guest_name, guest_phone, special_instructions } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({ error: 'No items in order' });
  }

  const table = findTable(db, tableNumber);
  if (!table) {
    return res.status(404).json({ error: 'Table not found' });
  }

  const settings = db.prepare('SELECT tax_percentage, service_charge_percentage FROM settings WHERE id = 1').get();
  const taxRate = settings ? settings.tax_percentage : 5.0;

  const transaction = db.transaction(() => {
    // Check if table already has an active order
    let order = db.prepare("SELECT * FROM orders WHERE table_id = ? AND status = 'active'").get(table.id);

    if (!order) {
      // Create new order
      const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
      const result = db.prepare(`
        INSERT INTO orders (order_number, table_id, order_type, order_source, guest_name, guest_phone, special_instructions, status)
        VALUES (?, ?, 'dine-in', 'qr_guest', ?, ?, ?, 'active')
      `).run(orderNumber, table.id, guest_name || 'Table Guest', guest_phone || '', special_instructions || '');

      order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
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
    const kotCount = db.prepare('SELECT COUNT(*) as count FROM kot WHERE DATE(created_at) = DATE(?)').get(new Date().toISOString().slice(0, 10));
    const kotNumber = `KOT-${String(kotCount.count + 1).padStart(3, '0')}`;
    const kotNotes = `📱 QR Order Table ${table.table_number}${special_instructions ? ` • Note: ${special_instructions}` : ''}`;

    db.prepare(`
      INSERT INTO kot (kot_number, order_id, table_number, status, items, notes)
      VALUES (?, ?, ?, 'pending', ?, ?)
    `).run(kotNumber, order.id, table.table_number, JSON.stringify(kotItemsList), kotNotes);

    // Update table status to occupied
    db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(table.id);

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      kotNumber,
      totalAmount,
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

// GET order live status for guest
router.get('/order/:orderId/status', (req, res) => {
  const db = getDb();
  const { orderId } = req.params;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
  const kots = db.prepare('SELECT * FROM kot WHERE order_id = ? ORDER BY id DESC').all(orderId);

  res.json({
    order,
    items,
    kots,
  });
});

// POST guest requests digital bill at table
router.post('/order/:orderId/request-bill', (req, res) => {
  const db = getDb();
  const { orderId } = req.params;

  db.prepare("UPDATE orders SET notes = notes || ' [GUEST REQUESTED BILL AT TABLE]', updated_at = datetime('now') WHERE id = ?").run(orderId);
  res.json({ success: true, message: 'Captain notified! Your bill is being brought to your table.' });
});

module.exports = router;
