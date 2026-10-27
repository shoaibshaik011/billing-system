const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

// GET dashboard stats
router.get('/dashboard', (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const tenantSlug = req.headers['x-tenant-slug'] || req.query.tenant_slug || '';

  const orderTenantClause = tenantSlug ? 'AND o.tenant_slug = ?' : "AND (o.tenant_slug = '' OR o.tenant_slug IS NULL)";
  const directOrderTenantClause = tenantSlug ? 'AND tenant_slug = ?' : "AND (tenant_slug = '' OR tenant_slug IS NULL)";
  const tableTenantClause = tenantSlug ? 'WHERE tenant_slug = ?' : "WHERE (tenant_slug = '' OR tenant_slug IS NULL)";
  const tenantParams = tenantSlug ? [tenantSlug] : [];

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
    FROM orders WHERE DATE(created_at) = ? ${directOrderTenantClause}
  `).get(today, ...tenantParams);

  // Today's payment breakdown (settled + active preferences)
  const paymentBreakdown = db.prepare(`
    SELECT 
      CASE 
        WHEN payment_method = 'cash' THEN 'Cash'
        WHEN payment_method = 'card' THEN 'Card'
        WHEN payment_method = 'upi' OR payment_preference = 'pay_here' THEN 'UPI (Online)'
        WHEN payment_method = 'split' THEN 'Split Bill'
        WHEN payment_status = 'paid' THEN 'Cash'
        ELSE 'Pay at Counter'
      END as payment_method,
      COUNT(*) as count, 
      COALESCE(SUM(total_amount), 0) as total
    FROM orders 
    WHERE DATE(created_at) = ? AND status != 'cancelled' ${directOrderTenantClause}
    GROUP BY (
      CASE 
        WHEN payment_method = 'cash' THEN 'Cash'
        WHEN payment_method = 'card' THEN 'Card'
        WHEN payment_method = 'upi' OR payment_preference = 'pay_here' THEN 'UPI (Online)'
        WHEN payment_method = 'split' THEN 'Split Bill'
        WHEN payment_status = 'paid' THEN 'Cash'
        ELSE 'Pay at Counter'
      END
    )
  `).all(today, ...tenantParams);

  // Top selling items today (live from all active + completed orders)
  const topItems = db.prepare(`
    SELECT oi.item_name, SUM(oi.quantity) as total_qty, SUM(oi.total_price) as total_revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE DATE(o.created_at) = ? AND o.status != 'cancelled' AND oi.status != 'cancelled' ${orderTenantClause}
    GROUP BY oi.item_name
    ORDER BY total_qty DESC
    LIMIT 10
  `).all(today, ...tenantParams);

  // Table occupancy
  const tableStats = db.prepare(`
    SELECT 
      COUNT(*) as total_tables,
      COUNT(CASE WHEN status = 'available' THEN 1 END) as available,
      COUNT(CASE WHEN status = 'occupied' THEN 1 END) as occupied,
      COUNT(CASE WHEN status = 'reserved' THEN 1 END) as reserved
    FROM tables ${tableTenantClause}
  `).get(...tenantParams);

  // Last 7 days revenue trend
  const revenueTrend = db.prepare(`
    SELECT DATE(created_at) as date, 
      COUNT(*) as orders,
      COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_amount ELSE 0 END), 0) as revenue
    FROM orders
    WHERE DATE(created_at) >= DATE('now', '-7 days') ${directOrderTenantClause}
    GROUP BY DATE(created_at)
    ORDER BY date
  `).all(...tenantParams);

  // Category-wise revenue today
  const categoryRevenue = db.prepare(`
    SELECT COALESCE(cat.name, 'Other') as category, COALESCE(SUM(oi.total_price), 0) as revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN menu_items m ON m.id = oi.menu_item_id
    LEFT JOIN categories cat ON cat.id = m.category_id
    WHERE DATE(o.created_at) = ? AND o.status != 'cancelled' AND oi.status != 'cancelled' ${orderTenantClause}
    GROUP BY cat.name
    ORDER BY revenue DESC
  `).all(today, ...tenantParams);

  // Hourly sales distribution today
  const hourlySales = db.prepare(`
    SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour,
      COUNT(*) as orders,
      COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_amount ELSE 0 END), 0) as revenue
    FROM orders 
    WHERE DATE(created_at) = ? AND status != 'cancelled' ${directOrderTenantClause}
    GROUP BY hour
    ORDER BY hour
  `).all(today, ...tenantParams);

  // Recent live orders
  const recentOrders = db.prepare(`
    SELECT o.id, o.order_number, o.order_source, o.table_id, t.table_number, o.guest_name,
      o.total_amount, o.status, o.payment_preference, o.payment_status, o.created_at
    FROM orders o
    LEFT JOIN tables t ON t.id = o.table_id
    WHERE 1=1 ${orderTenantClause}
    ORDER BY o.id DESC
    LIMIT 6
  `).all(...tenantParams);

  let settings;
  if (tenantSlug) {
    const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(tenantSlug);
    if (tenant) {
      settings = {
        restaurant_name: tenant.name,
        primary_color: tenant.primary_color || '#e11d24',
        tagline: tenant.tagline || 'Restaurant POS',
        icon_emoji: tenant.icon_emoji || '🧁',
        since_year: tenant.since_year || '2024',
        address: tenant.address || 'Main Branch',
        tenant_slug: tenant.slug,
      };
    }
  }
  if (!settings) {
    settings = db.prepare('SELECT restaurant_name, primary_color, tagline, icon_emoji, since_year, address FROM settings WHERE id = 1').get();
  }

  res.json({
    today: todayStats,
    paymentBreakdown,
    topItems,
    tableStats,
    revenueTrend,
    categoryRevenue,
    hourlySales,
    recentOrders,
    settings,
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
  const tenantSlug = req.headers['x-tenant-slug'] || req.query.tenant_slug || '';
  if (tenantSlug) {
    const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(tenantSlug);
    if (tenant) {
      return res.json({
        id: tenant.id,
        restaurant_name: tenant.name,
        address: tenant.address || 'Main Branch',
        phone: tenant.owner_phone || '',
        email: '',
        gst_number: tenant.gst_number || '',
        tax_percentage: tenant.tax_percentage ?? 5,
        service_charge_percentage: 0,
        currency_symbol: '₹',
        primary_color: tenant.primary_color || '#e11d24',
        tagline: tenant.tagline || 'Restaurant POS',
        icon_emoji: tenant.icon_emoji || '🍽️',
        since_year: tenant.since_year || '2024',
        tenant_slug: tenant.slug,
      });
    }
  }
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  res.json(settings);
});

router.put('/settings', (req, res) => {
  const db = getDb();
  const tenantSlug = req.headers['x-tenant-slug'] || req.query.tenant_slug || '';
  const {
    restaurant_name, address, phone, email, gst_number,
    tax_percentage, service_charge_percentage, currency_symbol,
    primary_color, tagline, icon_emoji, since_year
  } = req.body;

  if (tenantSlug) {
    db.prepare(`
      UPDATE tenants SET
        name = COALESCE(?, name),
        address = COALESCE(?, address),
        owner_phone = COALESCE(?, owner_phone),
        gst_number = COALESCE(?, gst_number),
        tax_percentage = COALESCE(?, tax_percentage),
        primary_color = COALESCE(?, primary_color),
        tagline = COALESCE(?, tagline),
        icon_emoji = COALESCE(?, icon_emoji),
        since_year = COALESCE(?, since_year),
        updated_at = datetime('now')
      WHERE slug = ?
    `).run(
      restaurant_name, address || '', phone || '', gst_number || '',
      tax_percentage ?? 5, primary_color || '#e11d24', tagline || '',
      icon_emoji || '🍽️', since_year || '2024', tenantSlug
    );
    const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(tenantSlug);
    return res.json({
      id: tenant.id,
      restaurant_name: tenant.name,
      address: tenant.address,
      phone: tenant.owner_phone,
      gst_number: tenant.gst_number,
      tax_percentage: tenant.tax_percentage,
      service_charge_percentage: 0,
      currency_symbol: '₹',
      primary_color: tenant.primary_color,
      tagline: tenant.tagline,
      icon_emoji: tenant.icon_emoji,
      since_year: tenant.since_year,
      tenant_slug: tenant.slug,
    });
  }

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
