import React, { useState, useEffect } from 'react';
import {
  Sparkles, CheckCircle2, ShieldCheck, Zap, RefreshCw, Key,
  Calendar, Layers, Store, ArrowRight, DollarSign, Award, Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as api from '../api';

export default function Subscription() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [upgrading, setUpgrading] = useState(false);
  const [renewing, setRenewing] = useState(false);

  useEffect(() => {
    loadSubscription();
  }, []);

  async function loadSubscription() {
    try {
      const res = await api.getSubscription();
      setData(res);
      if (res.subscription?.billing_cycle) {
        setBillingCycle(res.subscription.billing_cycle);
      }
    } catch (err) {
      toast.error('Failed to load subscription details');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade(planId) {
    setUpgrading(true);
    try {
      const res = await api.upgradeSubscription({ plan_id: planId, billing_cycle: billingCycle });
      toast.success(res.message || 'Plan updated successfully!');
      loadSubscription();
    } catch (err) {
      toast.error(err.message || 'Upgrade failed');
    } finally {
      setUpgrading(false);
    }
  }

  async function handleRenew() {
    setRenewing(true);
    try {
      const res = await api.renewSubscription();
      toast.success('Subscription renewed for next cycle!');
      loadSubscription();
    } catch (err) {
      toast.error(err.message || 'Renewal failed');
    } finally {
      setRenewing(false);
    }
  }

  if (loading) {
    return <div className="page-content text-center py-12 text-muted">Loading subscription...</div>;
  }

  const { subscription, daysRemaining, plans } = data || {};

  return (
    <div className="page-content" style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      {/* Reseller / Commercial SaaS Banner */}
      <div
        className="card mb-6 animate-in"
        style={{
          background: 'linear-gradient(135deg, rgba(225, 29, 36, 0.08) 0%, rgba(245, 158, 11, 0.08) 100%)',
          borderColor: 'var(--empire-red-border)',
          padding: 24,
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge badge-primary">SaaS Multi-Restaurant Ready</span>
              <span className="badge badge-open">Active License</span>
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '4px 0' }}>
              Commercial Restaurant Subscription & Licensing
            </h2>
            <p className="text-sm text-muted" style={{ margin: 0, maxWidth: 640 }}>
              Sell this all-in-one hotel billing software to restaurants on recurring monthly or annual subscriptions. Charge per outlet and provide table QR ordering, KDS, and POS.
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs text-muted block mb-1">Estimated MRR Potential</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--empire-red)' }}>
              ₹50,000 – ₹1,50,000 <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>/ month</span>
            </div>
            <span className="text-xs text-muted">@ 15 to 50 restaurant clients</span>
          </div>
        </div>
      </div>

      {/* Active Subscription Status Card */}
      <div className="card mb-8">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-primary" size={20} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Current Software License & Entitlements</h3>
          </div>
          <span className="badge badge-open" style={{ fontSize: '0.8rem', padding: '4px 12px' }}>
            ● {subscription?.status?.toUpperCase()}
          </span>
        </div>

        <div className="card-body">
          <div className="grid-4 mb-6">
            <div className="stat-card" style={{ padding: 14 }}>
              <div>
                <span className="stat-card-title text-xs">Active Plan</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--empire-red)' }}>
                  {subscription?.plan_name || 'Pro Plan'}
                </div>
                <span className="text-xs text-muted">₹{subscription?.plan_price?.toLocaleString('en-IN')} / {subscription?.billing_cycle}</span>
              </div>
            </div>

            <div className="stat-card" style={{ padding: 14 }}>
              <div>
                <span className="stat-card-title text-xs">Days Remaining</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  {daysRemaining} Days
                </div>
                <span className="text-xs text-muted">Renews: {new Date(subscription?.renew_date || Date.now()).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="stat-card" style={{ padding: 14 }}>
              <div>
                <span className="stat-card-title text-xs">Max Tables</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  {subscription?.max_tables} Tables
                </div>
                <span className="text-xs text-muted">Dining + Rooftop + AC</span>
              </div>
            </div>

            <div className="stat-card" style={{ padding: 14 }}>
              <div>
                <span className="stat-card-title text-xs">Guest QR Ordering</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-success)' }}>
                  {subscription?.qr_ordering_enabled ? 'Enabled ✓' : 'Disabled ✗'}
                </div>
                <span className="text-xs text-muted">Direct Mobile Ordering</span>
              </div>
            </div>
          </div>

          <div
            className="flex items-center justify-between p-3 rounded"
            style={{ background: '#f8fafc', border: '1px solid var(--border-primary)' }}
          >
            <div className="flex items-center gap-2">
              <Key size={16} className="text-muted" />
              <span className="text-xs text-muted">Software License Key:</span>
              <code style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                {subscription?.license_key || 'EMP-PRO-8924-X992-LIVE'}
              </code>
            </div>

            <button className="btn btn-secondary btn-sm" onClick={handleRenew} disabled={renewing}>
              <RefreshCw size={13} className={renewing ? 'animate-spin' : ''} />
              <span>{renewing ? 'Renewing...' : 'Simulate Renewal / Extend'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Plan Tiers Matrix */}
      <div className="mb-6 text-center">
        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: 6 }}>
          Choose Software Subscription Plan
        </h2>
        <p className="text-sm text-muted mb-4">
          Transparent pricing tiers tailored for restaurants, cafes, and multi-branch hotel groups.
        </p>

        {/* Monthly vs Annual Toggle */}
        <div className="tabs" style={{ display: 'inline-flex' }}>
          <button
            className={`tab ${billingCycle === 'monthly' ? 'active' : ''}`}
            onClick={() => setBillingCycle('monthly')}
          >
            Monthly Billing
          </button>
          <button
            className={`tab ${billingCycle === 'annual' ? 'active' : ''}`}
            onClick={() => setBillingCycle('annual')}
          >
            Annual Billing (Save 20% 🎉)
          </button>
        </div>
      </div>

      {/* 3 Pricing Cards */}
      <div className="grid-3 mb-8" style={{ marginTop: 20 }}>
        {(plans || []).map((plan) => {
          const isCurrent = subscription?.plan_name?.toLowerCase().includes(plan.id);
          const price = billingCycle === 'annual' ? plan.price_annual : plan.price_monthly;

          return (
            <div
              key={plan.id}
              className={`card ${plan.recommended ? 'highlighted' : ''} animate-in`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                padding: '28px 24px 24px',
                overflow: 'visible',
                background: '#ffffff',
              }}
            >
              {plan.recommended && (
                <div
                  style={{
                    position: 'absolute',
                    top: -14,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--empire-red)',
                    color: '#ffffff',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    padding: '4px 14px',
                    borderRadius: 'var(--radius-full)',
                    letterSpacing: 0.5,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 4px 14px rgba(225, 29, 36, 0.35)',
                    zIndex: 10,
                  }}
                >
                  ★ RECOMMENDED FOR RESTAURANTS
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{plan.name}</h3>
                <p className="text-xs text-muted" style={{ minHeight: 32, marginTop: 4 }}>
                  {plan.tagline}
                </p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--empire-red)' }}>
                  ₹{price.toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-muted"> / {billingCycle === 'annual' ? 'year' : 'month'}</span>
              </div>

              <div className="space-y-2 mb-6" style={{ flex: 1 }}>
                {plan.features.map((feat, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <CheckCircle2 size={14} className="text-success" style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: feat.includes('Guest Table QR') ? 700 : 500 }}>{feat}</span>
                  </div>
                ))}
              </div>

              <button
                className={`btn ${plan.recommended ? 'btn-primary' : 'btn-secondary'} w-full`}
                style={{ justifyContent: 'center' }}
                onClick={() => handleUpgrade(plan.id)}
                disabled={upgrading || isCurrent}
              >
                {isCurrent ? 'Current Active Plan' : `Upgrade to ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Commercial Onboarding How-To for Selling */}
      <div className="card" style={{ background: '#ffffff', padding: 24 }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 12 }}>
          💼 How to Sell This Software to Restaurants (Step-by-Step Playbook)
        </h3>
        <div className="grid-3 text-sm">
          <div className="p-3 rounded" style={{ background: '#f8fafc', border: '1px solid var(--border-primary)' }}>
            <div style={{ fontWeight: 800, color: 'var(--empire-red)', marginBottom: 4 }}>
              1. Demo Table QR Ordering
            </div>
            <p className="text-xs text-muted" style={{ lineHeight: 1.4 }}>
              Walk into any restaurant and scan a demo table QR on your phone. Show the manager how an order goes instantly to the kitchen KDS within 2 seconds without waiting for a waiter.
            </p>
          </div>

          <div className="p-3 rounded" style={{ background: '#f8fafc', border: '1px solid var(--border-primary)' }}>
            <div style={{ fontWeight: 800, color: 'var(--empire-red)', marginBottom: 4 }}>
              2. Offer 14-Day Free Trial
            </div>
            <p className="text-xs text-muted" style={{ lineHeight: 1.4 }}>
              Set up their restaurant menu in 15 minutes, print table QR stand cards, and let them test during peak weekend dinner rushes.
            </p>
          </div>

          <div className="p-3 rounded" style={{ background: '#f8fafc', border: '1px solid var(--border-primary)' }}>
            <div style={{ fontWeight: 800, color: 'var(--empire-red)', marginBottom: 4 }}>
              3. Collect Monthly Subscription
            </div>
            <p className="text-xs text-muted" style={{ lineHeight: 1.4 }}>
              Charge ₹2,999/month (Pro plan) or ₹28,790/year upfront. Provide local support, paper thermal roll integration, and regular software updates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
