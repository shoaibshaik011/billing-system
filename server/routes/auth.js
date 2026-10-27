const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// Helper to generate simple token
function generateToken(user) {
  return `token_${user.id}_${Buffer.from(user.username + ':' + Date.now()).toString('base64')}`;
}

// 1. Login (supports username/password OR 4-digit quick PIN)
router.post('/login', (req, res) => {
  try {
    const db = getDb();
    const { username, password, pin } = req.body;

    const tenantSlug = req.headers['x-tenant-slug'] || req.body.tenant_slug || '';
    let user;

    if (pin) {
      // PIN-based fast counter login scoped to tenant if provided
      if (tenantSlug) {
        user = db.prepare('SELECT * FROM users WHERE pin = ? AND is_active = 1 AND tenant_slug = ?').get(pin.trim(), tenantSlug);
        // Fallback to superadmin/vendor if needed
        if (!user) {
          user = db.prepare("SELECT * FROM users WHERE pin = ? AND is_active = 1 AND role = 'superadmin'").get(pin.trim());
        }
      } else {
        user = db.prepare("SELECT * FROM users WHERE pin = ? AND is_active = 1 AND (tenant_slug = '' OR tenant_slug IS NULL OR role = 'superadmin')").get(pin.trim());
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid 4-digit PIN for this terminal' });
      }
    } else if (username && password) {
      // Username / Password login scoped to tenant if provided
      if (tenantSlug) {
        user = db.prepare(`
          SELECT * FROM users 
          WHERE (LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)) 
            AND password = ? 
            AND is_active = 1
            AND (tenant_slug = ? OR role = 'superadmin')
        `).get(username.trim(), username.trim(), password, tenantSlug);
      } else {
        user = db.prepare(`
          SELECT * FROM users 
          WHERE (LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)) 
            AND password = ? 
            AND is_active = 1
            AND (tenant_slug = '' OR tenant_slug IS NULL OR role = 'superadmin')
        `).get(username.trim(), username.trim(), password);
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
    } else {
      return res.status(400).json({ error: 'Please provide username & password or PIN' });
    }

    // Update last login
    db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);

    // Sanitize user object (exclude sensitive password)
    const { password: _, ...safeUser } = user;
    const token = generateToken(user);

    res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token,
      user: safeUser,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Get current staff list (for quick staff switcher or settings)
router.get('/users', (req, res) => {
  try {
    const db = getDb();
    const users = db.prepare(`
      SELECT id, username, name, email, pin, role, avatar, tenant_slug, is_active, last_login, created_at 
      FROM users 
      WHERE is_active = 1 
      ORDER BY id ASC
    `).all();

    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Create a new staff account
router.post('/users', (req, res) => {
  try {
    const db = getDb();
    const {
      name,
      username,
      password = 'password123',
      pin = '1234',
      role = 'cashier',
      email = '',
      avatar = '👨‍🍳',
      tenant_slug = '',
    } = req.body;

    if (!name || !username) {
      return res.status(400).json({ error: 'Name and Username are required' });
    }

    // Check username collision
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(username);
    if (existing) {
      return res.status(400).json({ error: 'Username already in use' });
    }

    const insert = db.prepare(`
      INSERT INTO users (name, username, password, pin, role, email, avatar, tenant_slug)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      name.trim(),
      username.trim(),
      password,
      pin.trim(),
      role,
      email.trim(),
      avatar,
      tenant_slug
    );

    const newUser = db.prepare(`
      SELECT id, username, name, email, pin, role, avatar, tenant_slug, is_active, created_at 
      FROM users WHERE id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({ success: true, user: newUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Update staff user
router.put('/users/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { name, role, email, pin, password, avatar } = req.body;

    const update = db.prepare(`
      UPDATE users SET
        name = COALESCE(?, name),
        role = COALESCE(?, role),
        email = COALESCE(?, email),
        pin = COALESCE(?, pin),
        password = COALESCE(?, password),
        avatar = COALESCE(?, avatar),
        updated_at = datetime('now')
      WHERE id = ?
    `);

    update.run(name, role, email, pin, password, avatar, id);

    const updatedUser = db.prepare(`
      SELECT id, username, name, email, pin, role, avatar, tenant_slug, is_active, updated_at 
      FROM users WHERE id = ?
    `).get(id);

    res.json({ success: true, user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Delete or deactivate user
router.delete('/users/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    // Prevent deleting primary admin
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(id);
    if (user && user.username === 'admin') {
      return res.status(400).json({ error: 'Cannot delete the primary admin account' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Reset / Set Admin Password and PIN for a Restaurant Tenant
router.post('/reset-tenant-password', (req, res) => {
  try {
    const db = getDb();
    const tenant_slug = req.body.tenant_slug || req.headers['x-tenant-slug'];
    const passwordToSet = req.body.password || req.body.new_password;
    const pinToSet = req.body.pin || req.body.new_pin;
    const usernameToSet = req.body.username;
    const nameToSet = req.body.name;

    if (!tenant_slug) {
      return res.status(400).json({ error: 'Restaurant slug is required' });
    }
    if (!passwordToSet && !pinToSet) {
      return res.status(400).json({ error: 'Please provide a password or 4-digit PIN' });
    }

    const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(tenant_slug);
    if (!tenant) {
      return res.status(404).json({ error: 'Restaurant software instance not found' });
    }

    let user = db.prepare("SELECT * FROM users WHERE tenant_slug = ? AND role = 'admin'").get(tenant_slug);

    if (!user) {
      // Create admin user for this tenant
      const insert = db.prepare(`
        INSERT INTO users (name, username, password, pin, role, email, avatar, tenant_slug)
        VALUES (?, ?, ?, ?, 'admin', ?, '👑', ?)
      `);
      const desiredUsername = usernameToSet || `${tenant_slug}_admin`;
      const result = insert.run(
        nameToSet || `${tenant.name} Admin`,
        desiredUsername,
        passwordToSet || 'admin123',
        pinToSet || '1234',
        tenant.owner_phone ? `${tenant.owner_phone.replace(/[^0-9]/g, '')}@pos.local` : '',
        tenant_slug
      );
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    } else {
      // Update existing admin
      const desiredUsername = usernameToSet && usernameToSet.trim() ? usernameToSet.trim() : user.username;
      const desiredName = nameToSet && nameToSet.trim() ? nameToSet.trim() : user.name;
      db.prepare(`
        UPDATE users SET
          name = ?,
          username = ?,
          password = COALESCE(?, password),
          pin = COALESCE(?, pin),
          updated_at = datetime('now')
        WHERE id = ?
      `).run(desiredName, desiredUsername, passwordToSet || null, pinToSet || null, user.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    }

    const { password: _, ...safeUser } = user;
    const token = generateToken(user);

    res.json({
      success: true,
      message: `Admin credentials successfully saved for ${tenant.name}!`,
      token,
      user: safeUser,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
