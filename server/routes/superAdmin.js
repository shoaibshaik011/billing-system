const express = require('express');
const router = express.Router();
const { getDb, seedTenantData } = require('../database');

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

    // Automatically seed isolated tables, starter menu & admin user for this new restaurant
    try {
      seedTenantData(db, newTenant);
    } catch (e) {
      console.error('Seed tenant error:', e);
    }

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

// 8. Download Standalone Desktop App Launcher for a Tenant
router.get('/tenants/:slug/download-launcher', (req, res) => {
  try {
    const db = getDb();
    const { slug } = req.params;
    const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(slug);

    if (!tenant) {
      return res.status(404).send('Restaurant software instance not found');
    }

    const host = req.get('host');
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const clientAppUrl = `${protocol}://${host}/r/${slug}`;

    const launcherHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${tenant.name} - Desktop POS App</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f172a;
      color: #ffffff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 20px;
      padding: 36px 30px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      background: ${tenant.primary_color}25;
      color: ${tenant.primary_color};
      margin-bottom: 16px;
    }
    .logo {
      width: 80px;
      height: 80px;
      border-radius: 20px;
      background: ${tenant.primary_color};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 40px;
      margin: 0 auto 16px;
      box-shadow: 0 8px 24px ${tenant.primary_color}60;
    }
    h1 { font-size: 24px; font-weight: 800; margin-bottom: 6px; }
    p { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
    .btn {
      display: block;
      width: 100%;
      padding: 14px 20px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 800;
      color: #ffffff;
      background: ${tenant.primary_color};
      text-decoration: none;
      border: none;
      cursor: pointer;
      margin-bottom: 12px;
      box-shadow: 0 4px 14px ${tenant.primary_color}50;
      transition: transform 0.1s;
    }
    .btn:active { transform: scale(0.98); }
    .btn-secondary {
      background: #334155;
      color: #e2e8f0;
      box-shadow: none;
      font-size: 13px;
      padding: 10px;
    }
    .info {
      background: #0f172a;
      border-radius: 10px;
      padding: 12px;
      margin-top: 16px;
      font-size: 12px;
      color: #cbd5e1;
      text-align: left;
    }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Standalone Cloud POS Terminal</div>
    <div class="logo">${tenant.icon_emoji || '🍽️'}</div>
    <h1>${tenant.name}</h1>
    <p>${tenant.tagline || 'Restaurant Billing & KDS Terminal'}</p>

    <button class="btn" onclick="openFullscreenApp()">🚀 Launch Fullscreen POS App</button>
    <a class="btn btn-secondary" href="${clientAppUrl}" target="_blank">🌐 Open in Browser Tab</a>

    <div class="info">
      <div class="info-row"><span>License:</span><strong>${tenant.license_key || 'ACTIVE'}</strong></div>
      <div class="info-row"><span>Outlet:</span><strong>${tenant.address || 'Main Branch'}</strong></div>
      <div class="info-row"><span>Plan:</span><strong>${tenant.plan_name}</strong></div>
    </div>
  </div>

  <script>
    function openFullscreenApp() {
      const url = '${clientAppUrl}';
      const w = screen.availWidth || 1200;
      const h = screen.availHeight || 800;
      window.open(url, '_blank', 'width=' + w + ',height=' + h + ',menubar=no,status=no,toolbar=no,location=no');
    }
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${slug}-POS-Launcher.html"`);
    res.send(launcherHtml);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
