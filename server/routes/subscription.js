const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

const PLANS = [
  {
    id: 'starter',
    name: 'Starter Plan',
    price_monthly: 1499,
    price_annual: 14390,
    max_tables: 15,
    tagline: 'Best for cafes, quick bites & small eateries',
    features: [
      'Up to 15 Tables',
      'Fast POS Billing & Receipts',
      'Kitchen Order Tickets (KOT)',
      'GST & Tax Invoicing',
      'Daily Settlement Reports',
      'Email Support',
    ],
    qr_ordering: false,
    recommended: false,
  },
  {
    id: 'pro',
    name: 'Pro Plan',
    price_monthly: 2999,
    price_annual: 28790,
    max_tables: 50,
    tagline: 'Ideal for busy dine-in restaurants & hotel chains',
    features: [
      'Up to 50 Tables',
      '✨ Guest Table QR Code Mobile Ordering',
      'Kitchen Display System (KDS)',
      'Customer Loyalty & CRM',
      'Advanced Sales & Revenue Analytics',
      'Table Tent Card QR Generator',
      'Priority Phone & Chat Support',
    ],
    qr_ordering: true,
    recommended: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise Plan',
    price_monthly: 5999,
    price_annual: 57590,
    max_tables: 999,
    tagline: 'Complete white-label solution for fine dine & multi-outlet chains',
    features: [
      'Unlimited Tables & Floors',
      '✨ Guest Table QR Code Mobile Ordering',
      'Multi-Branch Consolidated Dashboard',
      'WhatsApp Bill & Receipt Dispatch',
      'Custom White-labeling & Branding',
      'API & ERP Integration',
      '24/7 Dedicated Account Manager',
    ],
    qr_ordering: true,
    recommended: false,
  },
];

// GET current subscription
router.get('/', (req, res) => {
  const db = getDb();
  let sub = db.prepare('SELECT * FROM subscription WHERE id = 1').get();
  if (!sub) {
    db.prepare('INSERT INTO subscription (id) VALUES (1)').run();
    sub = db.prepare('SELECT * FROM subscription WHERE id = 1').get();
  }

  // Calculate days remaining
  const renewDate = new Date(sub.renew_date || Date.now());
  const now = new Date();
  const diffTime = renewDate - now;
  const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  res.json({
    subscription: sub,
    daysRemaining,
    plans: PLANS,
  });
});

// GET plans
router.get('/plans', (req, res) => {
  res.json(PLANS);
});

// POST upgrade subscription
router.post('/upgrade', (req, res) => {
  const db = getDb();
  const { plan_id, billing_cycle } = req.body;

  const selectedPlan = PLANS.find((p) => p.id === plan_id) || PLANS[1];
  const price = billing_cycle === 'annual' ? selectedPlan.price_annual : selectedPlan.price_monthly;
  const daysToAdd = billing_cycle === 'annual' ? 365 : 30;

  const newLicenseKey = `EMP-${selectedPlan.name.substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-LIVE`;

  db.prepare(`
    UPDATE subscription 
    SET plan_name = ?, plan_price = ?, billing_cycle = ?, status = 'active',
        max_tables = ?, qr_ordering_enabled = ?, license_key = ?,
        renew_date = datetime('now', '+' || ? || ' days'),
        updated_at = datetime('now')
    WHERE id = 1
  `).run(
    selectedPlan.name,
    price,
    billing_cycle || 'monthly',
    selectedPlan.max_tables,
    selectedPlan.qr_ordering ? 1 : 0,
    newLicenseKey,
    daysToAdd
  );

  const updatedSub = db.prepare('SELECT * FROM subscription WHERE id = 1').get();
  res.json({
    success: true,
    message: `Successfully activated ${selectedPlan.name}!`,
    subscription: updatedSub,
  });
});

// POST renew existing plan
router.post('/renew', (req, res) => {
  const db = getDb();
  const sub = db.prepare('SELECT * FROM subscription WHERE id = 1').get();
  const daysToAdd = sub.billing_cycle === 'annual' ? 365 : 30;

  db.prepare(`
    UPDATE subscription 
    SET status = 'active', renew_date = datetime('now', '+' || ? || ' days'), updated_at = datetime('now')
    WHERE id = 1
  `).run(daysToAdd);

  const updatedSub = db.prepare('SELECT * FROM subscription WHERE id = 1').get();
  res.json({
    success: true,
    message: 'Subscription renewed successfully!',
    subscription: updatedSub,
  });
});

module.exports = router;
