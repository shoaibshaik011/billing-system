const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

// GET all customers
router.get('/', (req, res) => {
  const db = getDb();
  const { search } = req.query;
  let query = 'SELECT * FROM customers';
  const params = [];
  if (search) {
    query += ' WHERE name LIKE ? OR phone LIKE ?';
    params.push(`%${search}%`, `%${search}%`);
  }
  query += ' ORDER BY name';
  const customers = db.prepare(query).all(...params);
  res.json(customers);
});

// GET single customer
router.get('/:id', (req, res) => {
  const db = getDb();
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  // Get recent orders
  const orders = db.prepare(`
    SELECT o.*, t.table_number 
    FROM orders o 
    LEFT JOIN tables t ON t.id = o.table_id 
    WHERE o.customer_id = ? 
    ORDER BY o.created_at DESC LIMIT 10
  `).all(req.params.id);

  res.json({ ...customer, recent_orders: orders });
});

// POST create customer
router.post('/', (req, res) => {
  const db = getDb();
  const { name, phone, email, address, notes } = req.body;
  try {
    const result = db.prepare(
      'INSERT INTO customers (name, phone, email, address, notes) VALUES (?, ?, ?, ?, ?)'
    ).run(name, phone || null, email || '', address || '', notes || '');
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(customer);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      res.status(400).json({ error: 'Phone number already exists' });
    } else {
      res.status(400).json({ error: err.message });
    }
  }
});

// PUT update customer
router.put('/:id', (req, res) => {
  const db = getDb();
  const { name, phone, email, address, notes } = req.body;
  try {
    db.prepare(
      "UPDATE customers SET name=?, phone=?, email=?, address=?, notes=?, updated_at=datetime('now') WHERE id=?"
    ).run(name, phone || null, email || '', address || '', notes || '', req.params.id);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    res.json(customer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE customer
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
