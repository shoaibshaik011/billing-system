const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

// GET dashboard stats
router.get('/dashboard', (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  // Today's stats: counts both active and completed orders so revenue and counts update live!
  const todayStats = db.prepare(`
    SELECT 
      COUNT(*) as total_orders,
      COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_amount ELSE 0 END), 0) as total_revenue,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0) as settled_revenue,
      COALESCE(SUM(CASE WHEN status = 'active' THEN total_amount ELSE 0 END), 0) as active_revenue,
      COALESCE(AVG(CASE WHEN status != 'cancelled' AND total_amount > 0 THEN total_amount END), 0) as avg_order_value,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active_orders,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders
    FROM orders WHERE DATE(created_at) = ?
  `).get(today);

  // Today's payment breakdown (settled + active preferences)
  const paymentBreakdown = db.prepare(`
    SELECT 
      CASE 
        WHEN payment_status = 'paid' OR payment_preference = 'pay_here' THEN 'UPI (Online)'
        ELSE 'Pay at Counter'
      END as payment_method,
      COUNT(*) as count, 
      COALESCE(SUM(total_amount), 0) as total
    FROM orders 
    WHERE DATE(created_at) = ? AND status != 'cancelled'
    GROUP BY (CASE WHEN payment_status = 'paid' OR payment_preference = 'pay_here' THEN 'UPI (Online)' ELSE 'Pay at Counter' END)
  `).all(today);

  // Top selling items today (live from all active + completed orders)
  const topItems = db.prepare(`
    SELECT oi.item_name, SUM(oi.quantity) as total_qty, SUM(oi.total_price) as total_revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE DATE(o.created_at) = ? AND o.status != 'cancelled' AND oi.status != 'cancelled'
    GROUP BY oi.item_name
    ORDER BY total_qty DESC
    LIMIT 10
  `).all(today);

  // Table occupancy
  const tableStats = db.prepare(`
    SELECT 
      COUNT(*) as total_tables,
      COUNT(CASE WHEN status = 'available' THEN 1 END) as available,
      COUNT(CASE WHEN status = 'occupied' THEN 1 END) as occupied,
      COUNT(CASE WHEN status = 'reserved' THEN 1 END) as reserved
    FROM tables
  `).get();

  // Last 7 days revenue trend
  const revenueTrend = db.prepare(`
    SELECT DATE(created_at) as date, 
      COUNT(*) as orders,
      COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_amount ELSE 0 END), 0) as revenue
    FROM orders
    WHERE DATE(created_at) >= DATE('now', '-7 days')
    GROUP BY DATE(created_at)
    ORDER BY date
  `).all();

  // Category-wise revenue today
  const categoryRevenue = db.prepare(`
    SELECT COALESCE(cat.name, 'Other') as category, COALESCE(SUM(oi.total_price), 0) as revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN menu_items m ON m.id = oi.menu_item_id
    LEFT JOIN categories cat ON cat.id = m.category_id
    WHERE DATE(o.created_at) = ? AND o.status != 'cancelled' AND oi.status != 'cancelled'
    GROUP BY cat.name
    ORDER BY revenue DESC
  `).all(today);

  // Hourly sales distribution today
  const hourlySales = db.prepare(`
    SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour,
      COUNT(*) as orders,
      COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_amount ELSE 0 END), 0) as revenue
    FROM orders 
    WHERE DATE(created_at) = ? AND status != 'cancelled'
    GROUP BY hour
    ORDER BY hour
  `).all(today);

  // Recent live orders
  const recentOrders = db.prepare(`
    SELECT o.id, o.order_number, o.order_source, o.table_id, t.table_number, o.guest_name,
      o.total_amount, o.status, o.payment_preference, o.payment_status, o.created_at
    FROM orders o
    LEFT JOIN tables t ON t.id = o.table_id
    ORDER BY o.id DESC
    LIMIT 6
  `).all();

  res.json({
    today: todayStats,
    paymentBreakdown,
    topItems,
    tableStats,
    revenueTrend,
    categoryRevenue,
    hourlySales,
    recentOrders,
  });
});

// GET detailed reports
router.get('/reports', (req, res) => {
  const db = getDb();
  const { start_date, end_date } = req.query;
  const startDate = start_date || new Date().toISOString().slice(0, 10);
  const endDate = end_date || startDate;

  const summary = db.prepare(`
    SELECT 
      COUNT(*) as total_orders,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0) as total_revenue,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN tax_amount ELSE 0 END), 0) as total_tax,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN discount_amount ELSE 0 END), 0) as total_discounts,
      COALESCE(AVG(CASE WHEN status = 'completed' THEN total_amount END), 0) as avg_order_value,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders
    FROM orders 
    WHERE DATE(created_at) BETWEEN ? AND ?
  `).get(startDate, endDate);

  const dailyBreakdown = db.prepare(`
    SELECT DATE(created_at) as date,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as orders,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0) as revenue
    FROM orders
    WHERE DATE(created_at) BETWEEN ? AND ?
    GROUP BY DATE(created_at)
    ORDER BY date
  `).all(startDate, endDate);

  const itemWise = db.prepare(`
    SELECT oi.item_name, SUM(oi.quantity) as total_qty, SUM(oi.total_price) as total_revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE DATE(o.created_at) BETWEEN ? AND ? AND o.status = 'completed' AND oi.status != 'cancelled'
    GROUP BY oi.item_name
    ORDER BY total_revenue DESC
  `).all(startDate, endDate);

  res.json({ summary, dailyBreakdown, itemWise });
});

// GET/PUT settings
router.get('/settings', (req, res) => {
  const db = getDb();
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  res.json(settings);
});

router.put('/settings', (req, res) => {
  const db = getDb();
  const {
    restaurant_name, address, phone, email, gst_number,
    tax_percentage, service_charge_percentage, currency_symbol,
    primary_color, tagline, icon_emoji, since_year
  } = req.body;
  db.prepare(`
    UPDATE settings SET restaurant_name=?, address=?, phone=?, email=?, gst_number=?,
    tax_percentage=?, service_charge_percentage=?, currency_symbol=?,
    primary_color=?, tagline=?, icon_emoji=?, since_year=?,
    updated_at=datetime('now')
    WHERE id=1
  `).run(
    restaurant_name, address || '', phone || '', email || '', gst_number || '',
    tax_percentage ?? 5, service_charge_percentage ?? 0, currency_symbol || '₹',
    primary_color || '#e11d24', tagline || 'Restaurant & Hotel POS', icon_emoji || '🍽️', since_year || '1966'
  );
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  res.json(settings);
});

module.exports = router;
