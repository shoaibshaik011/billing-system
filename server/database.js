const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'restaurant.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeDatabase();
  }
  return db;
}

function initializeDatabase() {
  db.exec(`
    -- Restaurant settings
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      restaurant_name TEXT DEFAULT 'My Restaurant',
      address TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      gst_number TEXT DEFAULT '',
      tax_percentage REAL DEFAULT 5.0,
      service_charge_percentage REAL DEFAULT 0.0,
      currency_symbol TEXT DEFAULT '₹',
      logo_url TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Insert default settings if not exists
    INSERT OR IGNORE INTO settings (id) VALUES (1);

    -- Menu categories
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      icon TEXT DEFAULT '🍽️',
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Menu items
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price REAL NOT NULL,
      category_id INTEGER,
      image_url TEXT DEFAULT '',
      is_veg INTEGER DEFAULT 1,
      is_available INTEGER DEFAULT 1,
      preparation_time INTEGER DEFAULT 15,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    -- Restaurant tables
    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_number TEXT NOT NULL UNIQUE,
      capacity INTEGER DEFAULT 4,
      status TEXT DEFAULT 'available' CHECK(status IN ('available', 'occupied', 'reserved', 'maintenance')),
      floor TEXT DEFAULT 'Ground',
      position_x REAL DEFAULT 0,
      position_y REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Customers
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE,
      email TEXT DEFAULT '',
      address TEXT DEFAULT '',
      loyalty_points INTEGER DEFAULT 0,
      total_visits INTEGER DEFAULT 0,
      total_spent REAL DEFAULT 0.0,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Orders
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      table_id INTEGER,
      customer_id INTEGER,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
      order_type TEXT DEFAULT 'dine-in' CHECK(order_type IN ('dine-in', 'takeaway', 'delivery')),
      subtotal REAL DEFAULT 0.0,
      tax_amount REAL DEFAULT 0.0,
      service_charge REAL DEFAULT 0.0,
      discount_amount REAL DEFAULT 0.0,
      discount_type TEXT DEFAULT 'flat' CHECK(discount_type IN ('flat', 'percentage')),
      total_amount REAL DEFAULT 0.0,
      payment_method TEXT DEFAULT '' CHECK(payment_method IN ('', 'cash', 'card', 'upi', 'split')),
      payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'paid', 'partial')),
      notes TEXT DEFAULT '',
      waiter_name TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE SET NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    );

    -- Order items
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      menu_item_id INTEGER,
      item_name TEXT NOT NULL,
      item_price REAL NOT NULL,
      quantity INTEGER DEFAULT 1,
      total_price REAL NOT NULL,
      notes TEXT DEFAULT '',
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'preparing', 'ready', 'served', 'cancelled')),
      kot_number TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL
    );

    -- KOT (Kitchen Order Tickets)
    CREATE TABLE IF NOT EXISTS kot (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kot_number TEXT NOT NULL UNIQUE,
      order_id INTEGER NOT NULL,
      table_number TEXT DEFAULT '',
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'preparing', 'ready', 'completed')),
      items TEXT NOT NULL, -- JSON string of items
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    -- Commercial SaaS Subscription Table
    CREATE TABLE IF NOT EXISTS subscription (
      id INTEGER PRIMARY KEY DEFAULT 1,
      restaurant_name TEXT DEFAULT 'Empire Restaurant',
      plan_name TEXT DEFAULT 'Pro Plan',
      plan_price REAL DEFAULT 2999,
      billing_cycle TEXT DEFAULT 'monthly',
      status TEXT DEFAULT 'active',
      trial_ends_at TEXT DEFAULT (datetime('now', '+14 days')),
      renew_date TEXT DEFAULT (datetime('now', '+30 days')),
      license_key TEXT DEFAULT 'EMP-PRO-8924-X992-LIVE',
      max_tables INTEGER DEFAULT 50,
      qr_ordering_enabled INTEGER DEFAULT 1,
      kds_enabled INTEGER DEFAULT 1,
      analytics_enabled INTEGER DEFAULT 1,
      whatsapp_alerts_enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO subscription (id) VALUES (1);

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items(status);
    CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
    CREATE INDEX IF NOT EXISTS idx_kot_status ON kot(status);
    CREATE INDEX IF NOT EXISTS idx_kot_order ON kot(order_id);
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
  `);

  // Safely alter tables if columns do not exist
  try {
    const tableCols = db.pragma('table_info(tables)').map(c => c.name);
    if (!tableCols.includes('qr_code_token')) {
      db.exec("ALTER TABLE tables ADD COLUMN qr_code_token TEXT;");
    }
    // Populate tokens for tables that don't have one
    const tablesWithoutToken = db.prepare("SELECT id, table_number FROM tables WHERE qr_code_token IS NULL OR qr_code_token = ''").all();
    for (const t of tablesWithoutToken) {
      const token = `table_${t.table_number.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Math.random().toString(36).substring(2, 8)}`;
      db.prepare("UPDATE tables SET qr_code_token = ? WHERE id = ?").run(token, t.id);
    }

    const orderCols = db.pragma('table_info(orders)').map(c => c.name);
    if (!orderCols.includes('order_source')) {
      db.exec("ALTER TABLE orders ADD COLUMN order_source TEXT DEFAULT 'pos';");
    }
    if (!orderCols.includes('guest_name')) {
      db.exec("ALTER TABLE orders ADD COLUMN guest_name TEXT DEFAULT '';");
    }
    if (!orderCols.includes('guest_phone')) {
      db.exec("ALTER TABLE orders ADD COLUMN guest_phone TEXT DEFAULT '';");
    }
    if (!orderCols.includes('special_instructions')) {
      db.exec("ALTER TABLE orders ADD COLUMN special_instructions TEXT DEFAULT '';");
    }

    const settingsCols = db.pragma('table_info(settings)').map(c => c.name);
    if (!settingsCols.includes('primary_color')) {
      db.exec("ALTER TABLE settings ADD COLUMN primary_color TEXT DEFAULT '#e11d24';");
    }
    if (!settingsCols.includes('tagline')) {
      db.exec("ALTER TABLE settings ADD COLUMN tagline TEXT DEFAULT 'Restaurant & Hotel POS';");
    }
    if (!settingsCols.includes('icon_emoji')) {
      db.exec("ALTER TABLE settings ADD COLUMN icon_emoji TEXT DEFAULT '🍽️';");
    }
    if (!settingsCols.includes('since_year')) {
      db.exec("ALTER TABLE settings ADD COLUMN since_year TEXT DEFAULT '1966';");
    }

    // Master Multi-Tenant Restaurants Table
    db.exec(`
      CREATE TABLE IF NOT EXISTS tenants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        niche TEXT DEFAULT 'cafe',
        primary_color TEXT DEFAULT '#e11d24',
        icon_emoji TEXT DEFAULT '🍽️',
        since_year TEXT DEFAULT '2024',
        tagline TEXT DEFAULT '',
        owner_name TEXT DEFAULT '',
        owner_phone TEXT DEFAULT '',
        plan_name TEXT DEFAULT 'Pro Plan',
        plan_price REAL DEFAULT 2999,
        billing_cycle TEXT DEFAULT 'monthly',
        status TEXT DEFAULT 'active',
        renew_date TEXT DEFAULT (datetime('now', '+30 days')),
        license_key TEXT,
        max_tables INTEGER DEFAULT 30,
        address TEXT DEFAULT '',
        gst_number TEXT DEFAULT '',
        tax_percentage REAL DEFAULT 5.0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // Seed default tenants if empty
    const tenantCount = db.prepare('SELECT COUNT(*) as count FROM tenants').get();
    if (tenantCount.count === 0) {
      const insertTenant = db.prepare(`
        INSERT INTO tenants (slug, name, niche, primary_color, icon_emoji, since_year, tagline, owner_name, owner_phone, plan_name, plan_price, status, license_key, address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertTenant.run(
        'empire',
        'Empire Restaurant',
        'Dine-in & Mughlai',
        '#e11d24',
        '👨‍🍳',
        '1966',
        'Serving Authentic Taste Since 1966',
        'Abdul Rahim',
        '+91 98450 12345',
        'Pro Plan',
        2999,
        'active',
        'EMP-PRO-8924-X992-LIVE',
        'Jayanagar 4th Block, Bengaluru'
      );

      insertTenant.run(
        'brew-bean',
        'Brew & Bean Cafe',
        'Coffee & Bakery',
        '#b45309',
        '☕',
        '2021',
        'Artisan Brews & Fresh Bakes',
        'Ananya Sharma',
        '+91 98111 22334',
        'Starter Plan',
        1499,
        'active',
        'BRW-STA-4102-M881-LIVE',
        'Indiranagar 100ft Road, Bengaluru'
      );

      insertTenant.run(
        'sagar-veg',
        'Sagar Pure Veg',
        'Pure Veg & South Indian',
        '#16a34a',
        '🥗',
        '1995',
        'Traditional South Indian & North Indian Delights',
        'Ramesh Bhat',
        '+91 94480 99887',
        'Enterprise Plan',
        5999,
        'active',
        'SGR-ENT-9301-K554-LIVE',
        'Malleshwaram 8th Cross, Bengaluru'
      );
    }

    // Staff & Users Table for Restaurant POS and SaaS Vendor
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        email TEXT DEFAULT '',
        password TEXT NOT NULL,
        pin TEXT DEFAULT '1234',
        role TEXT DEFAULT 'cashier' CHECK(role IN ('admin', 'manager', 'cashier', 'waiter', 'superadmin')),
        tenant_slug TEXT DEFAULT '',
        avatar TEXT DEFAULT '👨‍🍳',
        is_active INTEGER DEFAULT 1,
        last_login TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // Seed default users if empty
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (userCount.count === 0) {
      const insertUser = db.prepare(`
        INSERT INTO users (username, name, email, password, pin, role, avatar)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      insertUser.run('admin', 'Empire Admin', 'admin@empire.com', 'admin123', '9999', 'admin', '👑');
      insertUser.run('cashier', 'Counter Cashier', 'cashier@empire.com', 'cashier123', '1234', 'cashier', '💼');
      insertUser.run('vendor', 'SaaS Software Vendor', 'vendor@billflow.com', 'vendor123', '0000', 'superadmin', '⚡');
    }
  } catch (err) {
    console.error('Migration warning:', err.message);
  }


  // Seed default categories if empty
  const count = db.prepare('SELECT COUNT(*) as count FROM categories').get();
  if (count.count === 0) {
    const insertCategory = db.prepare(
      'INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)'
    );
    const defaultCategories = [
      ['Starters', '🥗', 1],
      ['Main Course', '🍛', 2],
      ['Breads', '🫓', 3],
      ['Rice & Biryani', '🍚', 4],
      ['Soups', '🍜', 5],
      ['Desserts', '🍰', 6],
      ['Beverages', '🥤', 7],
      ['Specials', '⭐', 8],
    ];
    const insertMany = db.transaction((cats) => {
      for (const cat of cats) insertCategory.run(...cat);
    });
    insertMany(defaultCategories);
  }

  // Seed default tables if empty
  const tableCount = db.prepare('SELECT COUNT(*) as count FROM tables').get();
  if (tableCount.count === 0) {
    const insertTable = db.prepare(
      'INSERT INTO tables (table_number, capacity, floor) VALUES (?, ?, ?)'
    );
    const insertTables = db.transaction(() => {
      for (let i = 1; i <= 12; i++) {
        insertTable.run(`T${i}`, i <= 4 ? 2 : i <= 8 ? 4 : 6, i <= 6 ? 'Ground' : 'First');
      }
    });
    insertTables();
  }

  // Seed sample menu items if empty
  const menuCount = db.prepare('SELECT COUNT(*) as count FROM menu_items').get();
  if (menuCount.count === 0) {
    const cats = db.prepare('SELECT id, name FROM categories').all();
    const catMap = {};
    cats.forEach((c) => (catMap[c.name] = c.id));

    const insertItem = db.prepare(
      'INSERT INTO menu_items (name, price, category_id, is_veg, preparation_time, description) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const sampleItems = [
      ['Paneer Tikka', 220, catMap['Starters'], 1, 15, 'Grilled cottage cheese with spices'],
      ['Chicken Tikka', 280, catMap['Starters'], 0, 15, 'Tender chicken marinated in spices'],
      ['Spring Rolls', 180, catMap['Starters'], 1, 10, 'Crispy vegetable spring rolls'],
      ['Fish Fingers', 300, catMap['Starters'], 0, 12, 'Golden fried fish fingers'],

      ['Butter Chicken', 320, catMap['Main Course'], 0, 25, 'Creamy tomato-based chicken curry'],
      ['Paneer Butter Masala', 280, catMap['Main Course'], 1, 20, 'Rich and creamy paneer curry'],
      ['Dal Makhani', 220, catMap['Main Course'], 1, 30, 'Slow-cooked black lentils'],
      ['Chicken Biryani', 350, catMap['Rice & Biryani'], 0, 30, 'Fragrant basmati rice with chicken'],
      ['Veg Biryani', 280, catMap['Rice & Biryani'], 1, 25, 'Aromatic vegetable biryani'],
      ['Jeera Rice', 150, catMap['Rice & Biryani'], 1, 15, 'Cumin-flavored basmati rice'],

      ['Butter Naan', 60, catMap['Breads'], 1, 8, 'Soft buttered flatbread'],
      ['Garlic Naan', 80, catMap['Breads'], 1, 8, 'Naan with garlic topping'],
      ['Tandoori Roti', 40, catMap['Breads'], 1, 8, 'Whole wheat flatbread'],
      ['Laccha Paratha', 70, catMap['Breads'], 1, 10, 'Layered flaky bread'],

      ['Tomato Soup', 120, catMap['Soups'], 1, 10, 'Classic creamy tomato soup'],
      ['Hot & Sour Soup', 140, catMap['Soups'], 1, 10, 'Spicy and tangy clear soup'],

      ['Gulab Jamun', 100, catMap['Desserts'], 1, 5, 'Sweet milk dumplings in syrup'],
      ['Ice Cream Sundae', 150, catMap['Desserts'], 1, 5, 'Assorted ice cream with toppings'],

      ['Fresh Lime Soda', 80, catMap['Beverages'], 1, 5, 'Refreshing lime drink'],
      ['Masala Chai', 40, catMap['Beverages'], 1, 5, 'Indian spiced tea'],
      ['Cold Coffee', 120, catMap['Beverages'], 1, 5, 'Chilled coffee with ice cream'],
      ['Mango Lassi', 100, catMap['Beverages'], 1, 5, 'Sweet mango yogurt drink'],
    ];
    const insertMany = db.transaction((items) => {
      for (const item of items) insertItem.run(...item);
    });
    insertMany(sampleItems);
  }
}

module.exports = { getDb };
