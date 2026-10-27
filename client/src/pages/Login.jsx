import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import {
  Lock, User, KeyRound, ShieldCheck, ArrowRight, Eye, EyeOff,
  Sparkles, CheckCircle2, Clock, ChefHat, Store, Delete
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';
import { applyTheme } from '../theme';

export default function Login({ tenant: propTenant }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { slug: routeSlug } = useParams();
  const pathMatch = location.pathname.match(/^\/r\/([^\/]+)/);
  const slug = propTenant?.slug || routeSlug || pathMatch?.[1] || '';
  const { loginWithPassword, loginWithPin, setAuthSession, isAuthenticated, user } = useAuth();

  const [activeTab, setActiveTab] = useState('pin'); // 'pin', 'password', or 'reset'
  const [tenant, setTenant] = useState(propTenant || null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState('');

  // Set / Reset credentials states
  const [resetName, setResetName] = useState('');
  const [resetUsername, setResetUsername] = useState('admin');
  const [resetPassword, setResetPassword] = useState('');
  const [resetPin, setResetPin] = useState('1234');
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Clock
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load tenant configuration if slug is in URL
  useEffect(() => {
    if (propTenant) {
      setTenant(propTenant);
      return;
    }
    if (slug) {
      api.getTenantConfig(slug)
        .then((res) => {
          if (res.success && res.tenant) {
            setTenant(res.tenant);
            const color = res.tenant.primary_color || '#e11d24';
            applyTheme(color);
          }
        })
        .catch(() => {});
    } else {
      // Default restaurant settings
      api.getSettings().then((s) => {
        if (s) {
          setTenant({
            name: s.restaurant_name,
            icon_emoji: s.icon_emoji || '👨‍🍳',
            tagline: s.tagline || 'Restaurant POS & Counter System',
            primary_color: s.primary_color || '#e11d24',
            since_year: s.since_year || '1966',
          });
        }
      }).catch(() => {});
    }
  }, [slug, propTenant]);

  // If already authenticated with matching tenant or superadmin, redirect to destination
  useEffect(() => {
    if (isAuthenticated) {
      if (slug) {
        if (user?.tenant_slug === slug || user?.role === 'superadmin') {
          navigate(`/r/${slug}`, { replace: true });
        }
      } else {
        if (!user?.tenant_slug || user?.role === 'superadmin') {
          navigate(user?.role === 'superadmin' ? '/admin' : '/', { replace: true });
        }
      }
    }
  }, [isAuthenticated, user, navigate, slug]);

  // Handle PIN Numpad button click
  const handlePinNum = (digit) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === 4) {
        submitPin(nextPin);
      }
    }
  };

  const handlePinBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handlePinClear = () => {
    setPin('');
  };

  // Submit PIN login
  const submitPin = async (pinToSubmit) => {
    setLoading(true);
    try {
      const res = await loginWithPin(pinToSubmit, slug);
      toast.success(`Welcome back, ${res.user.name}!`);
      const target = slug ? `/r/${slug}` : (res.user.role === 'superadmin' ? '/admin' : '/');
      navigate(target, { replace: true });
    } catch (err) {
      toast.error(err.message || 'Invalid PIN');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  // Submit Password login
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error('Please enter username and password');
      return;
    }

    setLoading(true);
    try {
      const res = await loginWithPassword(username, password, slug);
      toast.success(`Welcome back, ${res.user.name}!`);
      const target = slug ? `/r/${slug}` : (res.user.role === 'superadmin' ? '/admin' : '/');
      navigate(target, { replace: true });
    } catch (err) {
      toast.error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Submit Set / Reset Admin credentials
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (!resetUsername.trim() || !resetPassword) {
      toast.error('Please enter username and new password');
      return;
    }
    if (!/^\d{4}$/.test(resetPin)) {
      toast.error('Quick PIN must be exactly 4 digits');
      return;
    }

    setLoading(true);
    try {
      const res = await api.resetTenantPassword({
        tenant_slug: slug || '',
        name: resetName || `${tenant?.name || 'Restaurant'} Admin`,
        username: resetUsername.trim(),
        password: resetPassword,
        pin: resetPin,
      });

      if (res.success && res.user && res.token) {
        setAuthSession(res.user, res.token);
        toast.success(`Admin credentials saved! Welcome, ${res.user.name}`);
        const target = slug ? `/r/${slug}` : '/';
        navigate(target, { replace: true });
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save credentials');
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Quick Demo Login Helper
  const handleQuickDemoLogin = (pinCode) => {
    setPin(pinCode);
    submitPin(pinCode);
  };

  const brandColor = tenant?.primary_color || '#e11d24';
  const brandName = tenant?.name || 'EMPIRE RESTAURANT';
  const brandEmoji = tenant?.icon_emoji || '👨‍🍳';
  const brandTagline = tenant?.tagline || 'Restaurant POS & Counter System';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 20%, #ffffff 0%, #f1f5f9 100%)',
        padding: '24px',
        position: 'relative',
      }}
    >
      {/* Ambient Top Glow */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          width: '500px',
          height: '350px',
          borderRadius: '50%',
          background: `${brandColor}12`,
          filter: 'blur(90px)',
          pointerEvents: 'none',
        }}
      />

      {/* Main Glassmorphic Login Card */}
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '440px',
          borderRadius: '24px',
          padding: '36px 32px 28px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)',
          border: '1.5px solid var(--border-primary)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '18px',
              backgroundColor: `${brandColor}15`,
              border: `2px solid ${brandColor}35`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              margin: '0 auto 14px',
              boxShadow: `0 8px 20px ${brandColor}20`,
            }}
          >
            {brandEmoji}
          </div>

          <h1
            style={{
              fontSize: '1.45rem',
              fontWeight: 900,
              color: 'var(--text-primary)',
              letterSpacing: '-0.3px',
              margin: '0 0 4px',
            }}
          >
            {brandName}
          </h1>

          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
            {brandTagline}
          </p>

          {/* Clock & Shift Indicator */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--bg-tertiary)',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '0.74rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginTop: '10px',
            }}
          >
            <Clock size={12} color={brandColor} />
            <span>
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span>•</span>
            <span style={{ color: '#16a34a' }}>● Counter Terminal</span>
          </div>
        </div>

        {/* Tab Switcher: PIN vs Password vs Reset */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            background: 'var(--bg-tertiary)',
            padding: '4px',
            borderRadius: '12px',
            marginBottom: '22px',
            gap: '4px',
          }}
        >
          <button
            type="button"
            onClick={() => { setActiveTab('pin'); setPin(''); }}
            style={{
              padding: '8px 6px',
              borderRadius: '9px',
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'pin' ? '#ffffff' : 'transparent',
              color: activeTab === 'pin' ? brandColor : 'var(--text-secondary)',
              boxShadow: activeTab === 'pin' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              transition: 'all 0.2s',
            }}
          >
            <KeyRound size={14} /> Quick PIN
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('password')}
            style={{
              padding: '8px 6px',
              borderRadius: '9px',
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'password' ? '#ffffff' : 'transparent',
              color: activeTab === 'password' ? brandColor : 'var(--text-secondary)',
              boxShadow: activeTab === 'password' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              transition: 'all 0.2s',
            }}
          >
            <Lock size={14} /> Password
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reset')}
            style={{
              padding: '8px 6px',
              borderRadius: '9px',
              border: 'none',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'reset' ? '#ffffff' : 'transparent',
              color: activeTab === 'reset' ? brandColor : 'var(--text-secondary)',
              boxShadow: activeTab === 'reset' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              transition: 'all 0.2s',
            }}
          >
            <ShieldCheck size={14} /> Set / Reset
          </button>
        </div>

        {/* Tab 1: Quick 4-Digit PIN Pad */}
        {activeTab === 'pin' && (
          <div>
            {/* PIN Indicator Circles */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '14px',
                marginBottom: '20px',
              }}
            >
              {[0, 1, 2, 3].map((index) => {
                const isFilled = pin.length > index;
                return (
                  <div
                    key={index}
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      border: `2px solid ${isFilled ? brandColor : 'var(--border-primary)'}`,
                      backgroundColor: isFilled ? brandColor : '#ffffff',
                      boxShadow: isFilled ? `0 0 12px ${brandColor}60` : 'none',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      transform: isFilled ? 'scale(1.15)' : 'scale(1)',
                    }}
                  />
                );
              })}
            </div>

            {/* Touch Numpad (3x4 grid) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                marginBottom: '18px',
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handlePinNum(num.toString())}
                  disabled={loading}
                  style={{
                    height: '52px',
                    borderRadius: '12px',
                    border: '1.5px solid var(--border-primary)',
                    background: '#ffffff',
                    fontSize: '1.35rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                    transition: 'all 0.15s',
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
                  onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {num}
                </button>
              ))}

              {/* Clear button */}
              <button
                type="button"
                onClick={handlePinClear}
                style={{
                  height: '52px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--border-primary)',
                  background: 'var(--bg-tertiary)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                CLEAR
              </button>

              {/* 0 digit */}
              <button
                type="button"
                onClick={() => handlePinNum('0')}
                disabled={loading}
                style={{
                  height: '52px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--border-primary)',
                  background: '#ffffff',
                  fontSize: '1.35rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                0
              </button>

              {/* Backspace button */}
              <button
                type="button"
                onClick={handlePinBackspace}
                style={{
                  height: '52px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--border-primary)',
                  background: 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <Delete size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Standard Username & Password */}
        {activeTab === 'password' && (
          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem' }}>Username or Email</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  required
                  placeholder="e.g. admin or cashier"
                  className="form-input"
                  style={{ paddingLeft: '38px', fontSize: '0.88rem' }}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your password"
                  className="form-input"
                  style={{ paddingLeft: '38px', paddingRight: '38px', fontSize: '0.88rem' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                fontWeight: 700,
                fontSize: '0.9rem',
                backgroundColor: brandColor,
                borderColor: brandColor,
                boxShadow: `0 6px 20px ${brandColor}35`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '4px',
              }}
            >
              {loading ? 'Authenticating...' : <><span>Sign In to Terminal</span> <ArrowRight size={16} /></>}
            </button>
          </form>
        )}

        {/* Tab 3: Set / Reset Admin Credentials */}
        {activeTab === 'reset' && (
          <form onSubmit={handleResetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ background: `${brandColor}10`, border: `1px solid ${brandColor}30`, borderRadius: '10px', padding: '10px 12px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>🔐 Owner / Admin Setup:</span> Set your private login password and 4-digit POS counter PIN for this restaurant.
            </div>

            {/* Display Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Your Name / Title
              </label>
              <input
                type="text"
                value={resetName}
                onChange={(e) => setResetName(e.target.value)}
                placeholder={`${tenant?.name || 'Restaurant'} Owner`}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--border-primary)',
                  background: 'var(--bg-tertiary)',
                  fontSize: '0.85rem',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
            </div>

            {/* Admin Username */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Admin Username *
              </label>
              <input
                type="text"
                required
                value={resetUsername}
                onChange={(e) => setResetUsername(e.target.value)}
                placeholder="e.g. admin or mrshome"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--border-primary)',
                  background: 'var(--bg-tertiary)',
                  fontSize: '0.85rem',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
            </div>

            {/* New Password */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                New Password *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showResetPassword ? 'text' : 'password'}
                  required
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Set your secure password"
                  style={{
                    width: '100%',
                    padding: '10px 38px 10px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid var(--border-primary)',
                    background: 'var(--bg-tertiary)',
                    fontSize: '0.85rem',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {showResetPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* 4-Digit Quick PIN */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' }}>
                Quick 4-Digit Counter PIN *
              </label>
              <input
                type="text"
                required
                maxLength={4}
                value={resetPin}
                onChange={(e) => setResetPin(e.target.value.replace(/\D/g, ''))}
                placeholder="1234"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--border-primary)',
                  background: 'var(--bg-tertiary)',
                  fontSize: '1rem',
                  fontWeight: 700,
                  letterSpacing: '4px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>
                Used for instant 1-tap numpad unlock at the billing counter.
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                fontWeight: 700,
                fontSize: '0.9rem',
                backgroundColor: brandColor,
                borderColor: brandColor,
                boxShadow: `0 6px 20px ${brandColor}35`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '4px',
              }}
            >
              {loading ? 'Saving Credentials...' : <><span>Save Credentials & Sign In</span> <ArrowRight size={16} /></>}
            </button>
          </form>
        )}

        {/* 1-Click Quick Sign In Chips */}
        <div
          style={{
            borderTop: '1px solid var(--border-primary)',
            paddingTop: '16px',
            marginTop: '12px',
          }}
        >
          <div style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', textAlign: 'center' }}>
            ⚡ Quick 1-Tap Sign In:
          </div>
          {slug ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('1234')}
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '8px',
                  padding: '8px 4px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>👑 Default PIN: 1234</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Auto-unlock POS</div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('reset')}
                style={{
                  background: `${brandColor}12`,
                  border: `1px solid ${brandColor}40`,
                  borderRadius: '8px',
                  padding: '8px 4px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: brandColor }}>🔑 Change Password</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '2px' }}>Set private PIN</div>
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('9999')}
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '8px',
                  padding: '8px 4px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>👑 Admin</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '2px' }}>PIN: 9999</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('1234')}
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '8px',
                  padding: '8px 4px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>💼 Cashier</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '2px' }}>PIN: 1234</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('0000')}
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '8px',
                  padding: '8px 4px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>⚡ Vendor</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '2px' }}>PIN: 0000</div>
              </button>
            </div>
          )}
        </div>

        {/* Guest QR ordering notice */}
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Are you a dining guest?{' '}
            <Link
              to={slug ? `/r/${slug}/table/1` : '/table/1'}
              style={{ color: brandColor, fontWeight: 700, textDecoration: 'none' }}
            >
              Scan Table QR to Order ↗
            </Link>
          </span>
        </div>
      </div>

      {/* Footer Info */}
      <div
        style={{
          marginTop: '20px',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 500,
        }}
      >
        <ShieldCheck size={14} color="#16a34a" />
        <span>End-to-End Encrypted POS Session • Local SQLite v3</span>
      </div>
    </div>
  );
}
