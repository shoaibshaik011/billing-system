const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

// GET all KOTs (with optional status filter)
router.get('/', (req, res) => {
  const db = getDb();
  const { status } = req.query;
  let query = `
    SELECT k.*, o.order_number, o.order_type, o.guest_name
    FROM kot k
    LEFT JOIN orders o ON o.id = k.order_id
  `;
  const params = [];
  if (status) {
    query += ' WHERE k.status = ?';
    params.push(status);
  } else {
    query += " WHERE k.status != 'completed'";
  }
  query += ' ORDER BY k.created_at DESC';

  const kots = db.prepare(query).all(...params);
  // Parse JSON items
  const parsed = kots.map((k) => ({
    ...k,
    items: JSON.parse(k.items || '[]'),
  }));
  res.json(parsed);
});

// PATCH update KOT status
router.patch('/:id/status', (req, res) => {
  const db = getDb();
  const { status } = req.body;
  db.prepare("UPDATE kot SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, req.params.id);

  const kot = db.prepare('SELECT * FROM kot WHERE id = ?').get(req.params.id);
  if (kot) {
    if (status === 'ready') {
      db.prepare("UPDATE order_items SET status = 'ready', updated_at = datetime('now') WHERE order_id = ? AND status != 'cancelled'")
        .run(kot.order_id);
      db.prepare("UPDATE orders SET updated_at = datetime('now') WHERE id = ?").run(kot.order_id);
    } else if (status === 'preparing') {
      db.prepare("UPDATE order_items SET status = 'preparing', updated_at = datetime('now') WHERE order_id = ? AND status != 'cancelled'")
        .run(kot.order_id);
      db.prepare("UPDATE orders SET updated_at = datetime('now') WHERE id = ?").run(kot.order_id);
    } else if (status === 'completed') {
      db.prepare("UPDATE order_items SET status = 'served', updated_at = datetime('now') WHERE order_id = ? AND status != 'cancelled'")
        .run(kot.order_id);
      db.prepare("UPDATE orders SET updated_at = datetime('now') WHERE id = ?").run(kot.order_id);
    }
  }

  const updatedKot = db.prepare('SELECT * FROM kot WHERE id = ?').get(req.params.id);
  res.json({ ...updatedKot, items: JSON.parse(updatedKot?.items || '[]') });
});

module.exports = router;
