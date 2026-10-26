const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

// GET all tables
router.get('/', (req, res) => {
  const db = getDb();
  const tables = db.prepare(`
    SELECT t.*, 
      (SELECT o.id FROM orders o WHERE o.table_id = t.id AND o.status = 'active' LIMIT 1) as active_order_id,
      (SELECT o.order_number FROM orders o WHERE o.table_id = t.id AND o.status = 'active' LIMIT 1) as active_order_number,
      (SELECT o.total_amount FROM orders o WHERE o.table_id = t.id AND o.status = 'active' LIMIT 1) as running_amount
    FROM tables t 
    ORDER BY t.floor, t.table_number
  `).all();
  res.json(tables);
});

// POST create table
router.post('/', (req, res) => {
  const db = getDb();
  const { table_number, capacity, floor } = req.body;
  try {
    const result = db.prepare(
      'INSERT INTO tables (table_number, capacity, floor) VALUES (?, ?, ?)'
    ).run(table_number, capacity || 4, floor || 'Ground');
    const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(table);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update table
router.put('/:id', (req, res) => {
  const db = getDb();
  const { table_number, capacity, status, floor } = req.body;
  try {
    db.prepare(
      'UPDATE tables SET table_number=?, capacity=?, status=?, floor=? WHERE id=?'
    ).run(table_number, capacity || 4, status || 'available', floor || 'Ground', req.params.id);
    const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(req.params.id);
    res.json(table);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH update table status
router.patch('/:id/status', (req, res) => {
  const db = getDb();
  const { status } = req.body;
  db.prepare('UPDATE tables SET status = ? WHERE id = ?').run(status, req.params.id);
  const table = db.prepare('SELECT * FROM tables WHERE id = ?').get(req.params.id);
  res.json(table);
});

// DELETE table
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM tables WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
