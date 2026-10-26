const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

// GET all menu items (with optional category filter)
router.get('/', (req, res) => {
  const db = getDb();
  const { category_id, available_only } = req.query;
  let query = `
    SELECT m.*, c.name as category_name 
    FROM menu_items m 
    LEFT JOIN categories c ON c.id = m.category_id
  `;
  const params = [];
  const conditions = [];

  if (category_id) {
    conditions.push('m.category_id = ?');
    params.push(category_id);
  }
  if (available_only === 'true') {
    conditions.push('m.is_available = 1');
  }
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY c.sort_order, m.name';

  const items = db.prepare(query).all(...params);
  res.json(items);
});

// GET single menu item
router.get('/:id', (req, res) => {
  const db = getDb();
  const item = db.prepare(`
    SELECT m.*, c.name as category_name 
    FROM menu_items m 
    LEFT JOIN categories c ON c.id = m.category_id 
    WHERE m.id = ?
  `).get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});

// POST create menu item
router.post('/', (req, res) => {
  const db = getDb();
  const { name, description, price, category_id, is_veg, is_available, preparation_time, image_url } = req.body;
  try {
    const result = db.prepare(
      `INSERT INTO menu_items (name, description, price, category_id, is_veg, is_available, preparation_time, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(name, description || '', price, category_id || null, is_veg ?? 1, is_available ?? 1, preparation_time || 15, image_url || '');
    const item = db.prepare('SELECT m.*, c.name as category_name FROM menu_items m LEFT JOIN categories c ON c.id = m.category_id WHERE m.id = ?').get(result.lastInsertRowid);
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update menu item
router.put('/:id', (req, res) => {
  const db = getDb();
  const { name, description, price, category_id, is_veg, is_available, preparation_time, image_url } = req.body;
  try {
    db.prepare(
      `UPDATE menu_items SET name=?, description=?, price=?, category_id=?, is_veg=?, is_available=?, preparation_time=?, image_url=?, updated_at=datetime('now')
       WHERE id=?`
    ).run(name, description || '', price, category_id || null, is_veg ?? 1, is_available ?? 1, preparation_time || 15, image_url || '', req.params.id);
    const item = db.prepare('SELECT m.*, c.name as category_name FROM menu_items m LEFT JOIN categories c ON c.id = m.category_id WHERE m.id = ?').get(req.params.id);
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH toggle availability
router.patch('/:id/toggle', (req, res) => {
  const db = getDb();
  db.prepare("UPDATE menu_items SET is_available = NOT is_available, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id);
  res.json(item);
});

// DELETE menu item
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
