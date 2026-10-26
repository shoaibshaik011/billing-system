const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// Generate unique license key
function generateLicenseKey(prefix = 'POS', plan = 'PRO') {
  const p = prefix.substring(0, 3).toUpperCase();
  const pl = plan.substring(0, 3).toUpperCase();
  const randNum = Math.floor(1000 + Math.random() * 9000);
  const randCode = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${p}-${pl}-${randNum}-${randCode}-LIVE`;
}

// Generate URL slug from restaurant name
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// 1. Get all provisioned restaurant clients (for the Vendor Hub)
router.get('/tenants', (req, res) => {
  try {
    const db = getDb();
    const tenants = db.prepare(`
      SELECT * FROM tenants 
      ORDER BY id DESC
    `).all();

    // Calculate MRR and subscription stats
    const now = new Date();
    const enriched = tenants.map(t => {
      const renewDate = t.renew_date ? new Date(t.renew_date) : null;
      const isExpired = renewDate && renewDate < now;
      const daysRemaining = renewDate ? Math.ceil((renewDate - now) / (1000 * 60 * 60 * 24)) : 0;

      return {
        ...t,
        computed_status: isExpired ? 'expired' : t.status,
        days_remaining: daysRemaining,
      };
    });

    const activeClients = enriched.filter(t => t.computed_status === 'active');
    const totalMRR = activeClients.reduce((sum, t) => sum + (t.plan_price || 0), 0);

    res.json({
      success: true,
      summary: {
        total_clients: enriched.length,
        active_clients: activeClients.length,
        total_mrr: totalMRR,
      },
      tenants: enriched,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get specific restaurant config by slug (called by client software when loaded at /r/:slug)
router.get('/tenants/:slug', (req, res) => {
  try {
    const db = getDb();
    const { slug } = req.params;
    const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(slug);

    if (!tenant) {
      return res.status(404).json({ error: 'Restaurant software instance not found' });
    }

    const now = new Date();
    const renewDate = tenant.renew_date ? new Date(tenant.renew_date) : null;
    const isExpired = renewDate && renewDate < now;

    res.json({
      success: true,
      tenant: {
        ...tenant,
        is_expired: isExpired,
        days_remaining: renewDate ? Math.ceil((renewDate - now) / (1000 * 60 * 60 * 24)) : 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Provision a new customized restaurant software instance (Vendor action)
router.post('/tenants', (req, res) => {
  try {
    const db = getDb();
    const {
      name,
      niche = 'cafe',
      primary_color = '#e11d24',
      icon_emoji = '🍽️',
      since_year = new Date().getFullYear().toString(),
      tagline = '',
      owner_name = '',
      owner_phone = '',
      plan_name = 'Pro Plan',
      plan_price = 2999,
      billing_cycle = 'monthly',
      months = 1,
      max_tables = 25,
      address = '',
      gst_number = '',
      tax_percentage = 5.0,
      custom_slug,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Restaurant name is required' });
    }

    let slug = custom_slug ? slugify(custom_slug) : slugify(name);
    // Ensure slug uniqueness
    const existing = db.prepare('SELECT id FROM tenants WHERE slug = ?').get(slug);
    if (existing) {
      slug = `${slug}-${Math.floor(100 + Math.random() * 900)}`;
    }

    const licenseKey = generateLicenseKey(name, plan_name);
    const renewDate = new Date();
    renewDate.setDate(renewDate.getDate() + (parseInt(months, 10) || 1) * 30);

    const insert = db.prepare(`
      INSERT INTO tenants (
        slug, name, niche, primary_color, icon_emoji, since_year, tagline,
        owner_name, owner_phone, plan_name, plan_price, billing_cycle,
        status, renew_date, license_key, max_tables, address, gst_number,
        tax_percentage
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      slug,
      name,
      niche,
      primary_color,
      icon_emoji,
      since_year,
      tagline,
      owner_name,
      owner_phone,
      plan_name,
      plan_price,
      billing_cycle,
      'active',
      renewDate.toISOString(),
      licenseKey,
      max_tables,
      address,
      gst_number,
      tax_percentage
    );

    const newTenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      message: 'Restaurant customized and provisioned successfully!',
      tenant: newTenant,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Update / Re-customize an existing restaurant (Vendor edits color, name, tables, etc.)
router.put('/tenants/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const {
      name,
      niche,
      primary_color,
      icon_emoji,
      since_year,
      tagline,
      owner_name,
      owner_phone,
      plan_name,
      plan_price,
      max_tables,
      address,
      gst_number,
      tax_percentage,
    } = req.body;

    const update = db.prepare(`
      UPDATE tenants SET
        name = COALESCE(?, name),
        niche = COALESCE(?, niche),
        primary_color = COALESCE(?, primary_color),
        icon_emoji = COALESCE(?, icon_emoji),
        since_year = COALESCE(?, since_year),
        tagline = COALESCE(?, tagline),
        owner_name = COALESCE(?, owner_name),
        owner_phone = COALESCE(?, owner_phone),
        plan_name = COALESCE(?, plan_name),
        plan_price = COALESCE(?, plan_price),
        max_tables = COALESCE(?, max_tables),
        address = COALESCE(?, address),
        gst_number = COALESCE(?, gst_number),
        tax_percentage = COALESCE(?, tax_percentage),
        updated_at = datetime('now')
      WHERE id = ?
    `);

    update.run(
      name, niche, primary_color, icon_emoji, since_year, tagline,
      owner_name, owner_phone, plan_name, plan_price, max_tables,
      address, gst_number, tax_percentage, id
    );

    const updatedTenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id);
    res.json({ success: true, tenant: updatedTenant });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Extend / Renew subscription by N days (Vendor button)
router.patch('/tenants/:id/renew', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { days = 30 } = req.body;

    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    let currentExpiry = tenant.renew_date ? new Date(tenant.renew_date) : new Date();
    // If already expired in the past, renew from today
    if (currentExpiry < new Date()) {
      currentExpiry = new Date();
    }
    currentExpiry.setDate(currentExpiry.getDate() + parseInt(days, 10));

    db.prepare(`
      UPDATE tenants 
      SET renew_date = ?, status = 'active', updated_at = datetime('now')
      WHERE id = ?
    `).run(currentExpiry.toISOString(), id);

    const updated = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id);
    res.json({
      success: true,
      message: `Subscription extended by ${days} days!`,
      tenant: updated,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Toggle Active / Suspended status
router.patch('/tenants/:id/status', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { status } = req.body; // 'active' or 'suspended'

    db.prepare(`
      UPDATE tenants SET status = ?, updated_at = datetime('now') WHERE id = ?
    `).run(status, id);

    const updated = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id);
    res.json({ success: true, tenant: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Delete tenant
router.delete('/tenants/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    db.prepare('DELETE FROM tenants WHERE id = ?').run(id);
    res.json({ success: true, message: 'Client removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
