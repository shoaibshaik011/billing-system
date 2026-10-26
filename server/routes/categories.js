const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

// GET all categories
router.get('/', (req, res) => {
  const db = getDb();
  const categories = db.prepare(`
    SELECT c.*, COUNT(m.id) as item_count 
    FROM categories c 
    LEFT JOIN menu_items m ON m.category_id = c.id AND m.is_available = 1
    GROUP BY c.id 
    ORDER BY c.sort_order
  `).all();
  res.json(categories);
});

// POST create category
router.post('/', (req, res) => {
  const db = getDb();
  const { name, description, icon, sort_order } = req.body;
  try {
    const result = db.prepare(
      'INSERT INTO categories (name, description, icon, sort_order) VALUES (?, ?, ?, ?)'
    ).run(name, description || '', icon || '🍽️', sort_order || 0);
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update category
router.put('/:id', (req, res) => {
  const db = getDb();
  const { name, description, icon, sort_order, is_active } = req.body;
  try {
    db.prepare(
      'UPDATE categories SET name = ?, description = ?, icon = ?, sort_order = ?, is_active = ? WHERE id = ?'
    ).run(name, description || '', icon || '🍽️', sort_order || 0, is_active ?? 1, req.params.id);
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    res.json(category);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE category
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
