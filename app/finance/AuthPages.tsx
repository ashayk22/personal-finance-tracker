'use client';

import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Check,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Laptop,
  LoaderCircle,
  Lock,
  Menu,
  Moon,
  Plus,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabaseClient';
import { ThemeToggle } from './theme';
import './auth.css';
import './wizz-home.css';

export function ProtectedFinance({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="ft-center"><LoaderCircle className="ft-spin"/><span>Checking your Moneta session…</span></div>;
  if (!user) return <Navigate to="/login" replace/>;
  return <>{children}</>;
}

export function LandingPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeMockTab, setActiveMockTab] = useState<'spending' | 'budgets'>('spending');
  const [scrollY, setScrollY] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showCookieBanner, setShowCookieBanner] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem('moneta_cookie_consent') === null;
    } catch {
      return true;
    }
  });
  const [emailInput, setEmailInput] = useState('');

  // Dynamic Scroll Progress and Active Scroll Animation Observer
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleScroll = () => {
      const currentY = window.scrollY || window.pageYOffset || 0;
      setScrollY(currentY);
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const progress = total > 0 ? (currentY / total) * 100 : 0;
      setScrollProgress(Math.min(100, Math.max(0, progress)));

      // Active scroll reveal trigger
      const revealEls = document.querySelectorAll<HTMLElement>('.scroll-reveal');
      const vh = window.innerHeight;
      revealEls.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top <= vh * 0.90) {
          el.classList.add('is-revealed');
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const callbackQuery = new URLSearchParams(location.search);
  if (callbackQuery.has('code') || callbackQuery.has('error')) {
    return <Navigate to={{ pathname: '/auth/callback', search: location.search }} replace/>;
  }
  if (user) return <Navigate to="/app/finance" replace/>;

  const handleCookieChoice = (accepted: boolean) => {
    try {
      localStorage.setItem('moneta_cookie_consent', accepted ? 'accepted' : 'rejected');
    } catch {}
    setShowCookieBanner(false);
  };

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/login');
  };

  return (
    <div className="wizz-home-root">
      {/* Top Scroll Progress Indicator */}
      <div className="wizz-scroll-progress" style={{ width: `${scrollProgress}%` }} aria-hidden="true" />

      {/* Floating Bauhaus Navigation Bar */}
      <header className={`wizz-nav-wrapper ${scrollProgress > 5 ? 'scrolled' : ''}`}>
        <nav className="wizz-nav-pill">
          <a className="wizz-nav-brand" href="/">
            <span className="wizz-brand-mark"><Wallet size={16}/></span>
            <span>MONETA</span>
          </a>
          <div className="wizz-nav-links">
            <a href="#overview" className="wizz-nav-link">Overview</a>
            <a href="#preview" className="wizz-nav-link">Live Preview</a>
            <a href="#features" className="wizz-nav-link">Features</a>
            <a href="#security" className="wizz-nav-link">Security</a>
          </div>
          <div className="wizz-nav-actions">
            <ThemeToggle />
            <a href="/login" className="wizz-nav-cta">
              <Plus size={14} /> Open Moneta
            </a>
            <button
              type="button"
              className="wizz-mobile-toggle"
              aria-label="Open navigation menu"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu size={18} />
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile Slide-In Navigation Drawer */}
      {mobileNavOpen && (
        <div className="wizz-mobile-drawer-scrim" onClick={() => setMobileNavOpen(false)}>
          <aside className="wizz-mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="wizz-drawer-top">
              <a className="wizz-nav-brand" href="/" onClick={() => setMobileNavOpen(false)}>
                <span className="wizz-brand-mark"><Wallet size={16}/></span>
                <span>MONETA</span>
              </a>
              <button
                type="button"
                className="wizz-drawer-close"
                aria-label="Close navigation"
                onClick={() => setMobileNavOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="wizz-drawer-links">
              <a href="#overview" className="wizz-drawer-link" onClick={() => setMobileNavOpen(false)}>
                <span>Overview</span>
                <ChevronRight size={16} />
              </a>
              <a href="#preview" className="wizz-drawer-link" onClick={() => setMobileNavOpen(false)}>
                <span>Live Preview</span>
                <ChevronRight size={16} />
              </a>
              <a href="#features" className="wizz-drawer-link" onClick={() => setMobileNavOpen(false)}>
                <span>Features</span>
                <ChevronRight size={16} />
              </a>
              <a href="#security" className="wizz-drawer-link" onClick={() => setMobileNavOpen(false)}>
                <span>Security</span>
                <ChevronRight size={16} />
              </a>
            </div>

            <div className="wizz-drawer-footer">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--moneta-yellow)' }}>APPEARANCE</span>
                <ThemeToggle withLabel />
              </div>
              <a href="/login" className="wizz-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Open Moneta Workspace <ArrowRight size={15} />
              </a>
              <span style={{ fontSize: '11px', color: '#888', textAlign: 'center' }}>
                Private Workspace · Row Level Security
              </span>
            </div>
          </aside>
        </div>
      )}

      {/* Hero Section — Matching Exact Reference Image */}
      <section className="wizz-hero" id="overview">
        {/* Parallax Floating Metric Badges */}
        <div
          className="wizz-floating-chip chip-left"
          style={{ transform: `translate3d(0, ${Math.min(50, scrollY * 0.14)}px, 0) rotate(-4deg)` }}
          aria-hidden="true"
        >
          <span className="wizz-chip-dot green" />
          <span>+₹1,000 Income Synced</span>
        </div>

        <div
          className="wizz-floating-chip chip-right"
          style={{ transform: `translate3d(0, ${Math.min(65, scrollY * 0.18)}px, 0) rotate(3deg)` }}
          aria-hidden="true"
        >
          <span className="wizz-chip-dot red" />
          <span>₹61 Left · 95% Used</span>
        </div>

        <div className="wizz-hero-inner">
          <h1 className="wizz-display-headline">
            <span className="wizz-headline-top">A CALMER WAY TO</span>
            <span
              className="wizz-headline-sticker"
              style={{
                transform: `rotate(${-2.2 + Math.min(2.5, scrollY * 0.008)}deg) translateY(${Math.min(18, scrollY * 0.04)}px)`,
              }}
            >
              MANAGE MONEY.
            </span>
          </h1>

          <p className="wizz-hero-subhead">
            The private, high-contrast ledger for daily cashflow, category budgets, and recurring commitments. No third-party tracking.
          </p>

          <div className="wizz-hero-cta-group">
            <a href="/login" className="wizz-btn-primary">
              Launch Moneta workspace →
            </a>

            <div className="wizz-badge-pair">
              <div className="wizz-badge-pill">
                Web app, instant launch
              </div>
              <div className="wizz-badge-pill">
                Installable as a PWA
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Continuous Scrolling Bauhaus Marquee Ticker */}
      <div className="wizz-marquee-band" aria-hidden="true">
        <div
          className="wizz-marquee-track"
          style={{ transform: `translateX(-${(scrollY * 0.45) % 800}px)` }}
        >
          <div className="wizz-marquee-inner">
            <span>✦ REAL-TIME CASHFLOW</span>
            <span>✦ ROW LEVEL SECURITY</span>
            <span>✦ AUTO INCOME-TO-BUDGET SYNC</span>
            <span>✦ 1-CLICK EXPORTS</span>
            <span>✦ INSTANT TOP-UPS</span>
            <span>✦ ZERO AD TRACKING</span>
            <span>✦ PRIVATE WORKSPACE</span>
            <span>✦ BUILT FOR REAL LIFE</span>
          </div>
          <div className="wizz-marquee-inner">
            <span>✦ REAL-TIME CASHFLOW</span>
            <span>✦ ROW LEVEL SECURITY</span>
            <span>✦ AUTO INCOME-TO-BUDGET SYNC</span>
            <span>✦ 1-CLICK EXPORTS</span>
            <span>✦ INSTANT TOP-UPS</span>
            <span>✦ ZERO AD TRACKING</span>
            <span>✦ PRIVATE WORKSPACE</span>
            <span>✦ BUILT FOR REAL LIFE</span>
          </div>
        </div>
      </div>

      {/* Trust Indicator Strip */}
      <section className="wizz-trust-strip" id="security">
        <div className="wizz-trust-grid">
          <div className="wizz-trust-item scroll-reveal scroll-delay-1">
            <div className="wizz-trust-icon">
              <ShieldCheck size={16} />
            </div>
            <div className="wizz-trust-content">
              <h3>Row Level Security</h3>
              <p>PostgreSQL RLS guarantees your transactions and budgets are mathematically isolated to your authenticated account.</p>
            </div>
          </div>

          <div className="wizz-trust-item scroll-reveal scroll-delay-2">
            <div className="wizz-trust-icon">
              <Zap size={16} />
            </div>
            <div className="wizz-trust-content">
              <h3>Auto-Synced Budgets</h3>
              <p>Adding income automatically tops up your monthly spending limit, keeping your remaining allowance honest without manual math.</p>
            </div>
          </div>

          <div className="wizz-trust-item scroll-reveal scroll-delay-3">
            <div className="wizz-trust-icon">
              <FileSpreadsheet size={16} />
            </div>
            <div className="wizz-trust-content">
              <h3>Sovereign Exports</h3>
              <p>Your data belongs to you. Export cleanly formatted Excel workbooks, tax-ready CSVs, and printable PDF statements in one click.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Live App Showcase Window */}
      <section className="wizz-showcase-band" id="preview">
        <div className="wizz-showcase-header scroll-reveal">
          <span className="wizz-eyebrow">AUTHENTIC MONETA INTERFACE</span>
          <h2 className="wizz-display-headline" style={{ fontSize: 'clamp(26px, 4.2vw, 50px)', marginBottom: '10px' }}>
            EVERY RUPEE IN FOCUS
          </h2>
          <p className="wizz-hero-subhead" style={{ maxWidth: '600px', margin: '0 auto 24px' }}>
            Bauhaus neo-brutalism engineered for high legibility: clean black borders, warm paper background,
            and instant clarity across desktop and mobile.
          </p>
        </div>

        {/* Live Mockup Window */}
        <div className="wizz-app-window scroll-reveal scroll-delay-1">
          <div className="wizz-app-chrome">
            <div className="wizz-app-dots">
              <span /><span /><span />
            </div>
            <div className="wizz-app-url">
              monetracker.vercel.app/app/finance
            </div>
            <div style={{ width: '42px' }} />
          </div>

          <div className="wizz-app-canvas">
            {/* Mockup Header */}
            <div className="wizz-mockup-top">
              <div>
                <span className="wizz-eyebrow" style={{ color: '#b38600', marginBottom: 2 }}>PERSONAL FINANCE</span>
                <h2>Good day</h2>
              </div>
              <div className="wizz-mockup-top-actions">
                <span className="wizz-mockup-status-badge">
                  ● PRIVATE WORKSPACE
                </span>
                <span className="wizz-mockup-btn">
                  <Plus size={13} /> ADD TRANSACTION
                </span>
              </div>
            </div>

            {/* Mobile Tab Control for Mockup View (Eliminates Mobile Clutter) */}
            <div className="wizz-mockup-tabs">
              <button
                type="button"
                className={`wizz-mockup-tab ${activeMockTab === 'spending' ? 'active' : ''}`}
                onClick={() => setActiveMockTab('spending')}
              >
                📊 Spending Insights
              </button>
              <button
                type="button"
                className={`wizz-mockup-tab ${activeMockTab === 'budgets' ? 'active' : ''}`}
                onClick={() => setActiveMockTab('budgets')}
              >
                🎯 Monthly Budgets
              </button>
            </div>

            {/* 4 KPI Cards from Screenshot */}
            <div className={`wizz-mockup-kpis ${activeMockTab === 'budgets' ? 'show-budget-kpis' : ''}`}>
              <div className="wizz-mockup-kpi">
                <div className="wizz-mockup-kpi-icon yellow">
                  <ArrowUpRight size={18} />
                </div>
                <div>
                  <span>Spent this month</span>
                  <strong>₹1,291</strong>
                  <small>10 expenses</small>
                </div>
              </div>

              <div className="wizz-mockup-kpi">
                <div className="wizz-mockup-kpi-icon green">
                  <ArrowDownLeft size={18} />
                </div>
                <div>
                  <span>Income this month</span>
                  <strong>₹1,000</strong>
                  <small>Recorded income</small>
                </div>
              </div>

              <div className="wizz-mockup-kpi">
                <div className="wizz-mockup-kpi-icon red">
                  <Wallet size={18} />
                </div>
                <div>
                  <span>Remaining budget</span>
                  <strong style={{ color: '#c73327' }}>₹61</strong>
                  <small>95% used</small>
                </div>
              </div>

              <div className="wizz-mockup-kpi wizz-kpi-secondary">
                <div className="wizz-mockup-kpi-icon blue">
                  <Calendar size={18} />
                </div>
                <div>
                  <span>Spent today</span>
                  <strong>₹745</strong>
                  <small>3 transactions</small>
                </div>
              </div>
            </div>

            {/* Spending View Tab Content */}
            <div className={`wizz-mockup-grid ${activeMockTab === 'spending' ? 'tab-active' : 'tab-hidden-mobile'}`}>
              {/* Spending Trend Area Chart */}
              <div className="wizz-mockup-card">
                <div className="wizz-mockup-card-head">
                  <div>
                    <h4>Spending overview</h4>
                    <small>Daily expenses · last 14 days</small>
                  </div>
                  <span className="wizz-mockup-link">FULL INSIGHTS ↗</span>
                </div>

                <div className="wizz-mockup-chart">
                  <svg viewBox="0 0 500 160" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="yellowArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ffcc00" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#ffcc00" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 0,150 L 50,150 L 100,150 L 150,150 L 200,150 L 250,150 L 300,150 L 350,148 L 400,120 L 450,60 L 500,20 L 500,155 L 0,155 Z"
                      fill="url(#yellowArea)"
                    />
                    <path
                      d="M 0,150 L 50,150 L 100,150 L 150,150 L 200,150 L 250,150 L 300,150 L 350,148 L 400,120 L 450,60 L 500,20"
                      fill="none"
                      stroke="#ffcc00"
                      strokeWidth="3.5"
                    />
                  </svg>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#625e55', marginTop: '6px' }}>
                  <span>7 Nov</span>
                  <span>10 Nov</span>
                  <span>14 Nov</span>
                  <span>17 Nov</span>
                  <span>20 Nov</span>
                </div>
              </div>

              {/* Category Breakdown Donut */}
              <div className="wizz-mockup-card">
                <div className="wizz-mockup-card-head">
                  <div>
                    <h4>Where it goes</h4>
                    <small>Category breakdown</small>
                  </div>
                </div>

                <div className="wizz-mockup-donut-wrap">
                  <div className="wizz-mockup-donut-center">
                    <svg width="110" height="110" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="38" stroke="#eeeeee" strokeWidth="14" fill="none" />
                      <circle
                        cx="50" cy="50" r="38"
                        stroke="#ffcc00" strokeWidth="14" fill="none"
                        strokeDasharray="205 238" strokeDashoffset="0"
                      />
                      <circle
                        cx="50" cy="50" r="38"
                        stroke="#004fc4" strokeWidth="14" fill="none"
                        strokeDasharray="14 238" strokeDashoffset="-205"
                      />
                      <circle
                        cx="50" cy="50" r="38"
                        stroke="#c73327" strokeWidth="14" fill="none"
                        strokeDasharray="12 238" strokeDashoffset="-219"
                      />
                    </svg>
                    <div className="wizz-mockup-donut-text">
                      <b>₹1,291</b>
                      <span>spent</span>
                    </div>
                  </div>

                  <div className="wizz-mockup-legend">
                    <div className="wizz-mockup-legend-row">
                      <span><span style={{ color: '#ffcc00' }}>●</span> Bills</span>
                      <b>₹1,119</b>
                    </div>
                    <div className="wizz-mockup-legend-row">
                      <span><span style={{ color: '#004fc4' }}>●</span> Food</span>
                      <b>₹80</b>
                    </div>
                    <div className="wizz-mockup-legend-row">
                      <span><span style={{ color: '#c73327' }}>●</span> Education</span>
                      <b>₹55</b>
                    </div>
                    <div className="wizz-mockup-legend-row">
                      <span><span style={{ color: '#999' }}>●</span> Groceries</span>
                      <b>₹37</b>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Budget View Tab Content */}
            <div className={`wizz-mockup-grid ${activeMockTab === 'budgets' ? 'tab-active' : 'tab-hidden-mobile'}`}>
              {/* Monthly Budget with + Add to budget preview */}
              <div className="wizz-mockup-card">
                <div className="wizz-mockup-card-head">
                  <div>
                    <h4>Monthly budget</h4>
                    <small>November 2026</small>
                  </div>
                  <span style={{ fontSize: '10px', background: '#fff0ed', color: '#c73327', fontWeight: 700, padding: '2px 6px', border: '1px solid #171510' }}>
                    95% USED
                  </span>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                    <span>₹1,291 spent</span>
                    <span style={{ color: '#625e55' }}>of ₹1,352 limit</span>
                  </div>
                  <div style={{ height: '10px', background: '#e9e3d7', border: '1px solid #171510', position: 'relative' }}>
                    <div style={{ height: '100%', width: '95%', background: '#c73327' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px dashed #ded7c9' }}>
                  <span style={{ fontSize: '11px', color: '#625e55' }}>Top-up balance anytime</span>
                  <span className="wizz-mockup-btn" style={{ fontSize: '11px', padding: '4px 10px' }}>
                    <Plus size={12} /> Add to budget
                  </span>
                </div>
              </div>

              {/* Recent Activity Card (Desktop only on small screens to eliminate mobile clutter) */}
              <div className="wizz-mockup-card wizz-mockup-recent">
                <div className="wizz-mockup-card-head">
                  <div>
                    <h4>Recent transactions</h4>
                    <small>Your latest activity</small>
                  </div>
                  <span className="wizz-mockup-link">VIEW ALL →</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#fff', border: '1px solid #171510' }}>
                    <div>
                      <strong>Utility Provider</strong>
                      <div style={{ fontSize: '11px', color: '#625e55' }}>Bills · Today</div>
                    </div>
                    <span style={{ fontWeight: 700, color: '#c73327' }}>-₹1,119</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#fff', border: '1px solid #171510' }}>
                    <div>
                      <strong>Campus Bookstore</strong>
                      <div style={{ fontSize: '11px', color: '#625e55' }}>Education · Yesterday</div>
                    </div>
                    <span style={{ fontWeight: 700, color: '#c73327' }}>-₹55</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Rows */}
      <section className="wizz-content-section" id="features">
        <div className="wizz-feature-row scroll-reveal">
          <div className="wizz-feature-left">
            <h2>AUTOMATIC INCOME-TO-BUDGET SYNC</h2>
          </div>
          <div className="wizz-feature-right">
            <span className="wizz-eyebrow">EFFORTLESS PLANNING</span>
            <p className="wizz-statement">Your budget dynamically expands whenever you earn.</p>
            <p className="wizz-body">
              Whenever you record fresh income, Moneta automatically recalculates and adds that amount
              directly to your monthly budget envelope. No manual spreadsheets, no forgotten adjustments.
            </p>
          </div>
        </div>

        <div className="wizz-feature-row scroll-reveal">
          <div className="wizz-feature-left">
            <h2>ONE-CLICK "ADD TO BUDGET" INCREMENTS</h2>
          </div>
          <div className="wizz-feature-right">
            <span className="wizz-eyebrow">FLEXIBLE ENVELOPES</span>
            <p className="wizz-statement">Top up any spending category on the fly.</p>
            <p className="wizz-body">
              Unexpected expenses happen. Instead of overwriting your historical limits, the new "Add to budget"
              option allows you to increment your existing budget limit seamlessly right from the budget form
              or your active category cards.
            </p>
          </div>
        </div>

        <div className="wizz-feature-row scroll-reveal">
          <div className="wizz-feature-left">
            <h2>SEPARATE SURVIVAL FROM LIFESTYLE</h2>
          </div>
          <div className="wizz-feature-right">
            <span className="wizz-eyebrow">RECURRING COMMITMENTS</span>
            <p className="wizz-statement">Rent, utilities, and subscriptions in one dedicated view.</p>
            <p className="wizz-body">
              Never wonder if you have enough money left for rent after a weekend dinner. Moneta tracks your fixed
              obligations separately so you always know your exact safe-to-spend margin before the next paycheck.
            </p>
          </div>
        </div>

        <div className="wizz-feature-row scroll-reveal">
          <div className="wizz-feature-left">
            <h2>ZERO TRACKING. ZERO AD TARGETING.</h2>
          </div>
          <div className="wizz-feature-right">
            <span className="wizz-eyebrow">TOTAL SOVEREIGNTY</span>
            <p className="wizz-statement">Your personal finances belong to you alone.</p>
            <p className="wizz-body">
              Moneta does not sell your transactions to credit brokers or advertisers. All data is guarded by
              PostgreSQL Row Level Security and can be exported to Excel, CSV, or PDF whenever you choose.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Action Band */}
      <section className="wizz-interactive-band scroll-reveal">
        <div className="wizz-interactive-card">
          <span className="wizz-eyebrow">INSTANT WORKSPACE ACCESS</span>
          <h3>READY TO TAKE CONTROL OF YOUR MONEY?</h3>
          <p>
            Launch your private Moneta workspace now. Connect with Google OAuth in seconds.
            No subscriptions, no spam, no credit card required.
          </p>
          <form className="wizz-input-group" onSubmit={handleInputSubmit}>
            <input
              type="email"
              className="wizz-input-field"
              placeholder="Enter your email address"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
            />
            <button type="submit" className="wizz-btn-secondary">
              Open Moneta <ArrowRight size={15} style={{ marginLeft: '6px' }} />
            </button>
          </form>
        </div>
      </section>

      {/* Cookie Consent Card (Fixed Bottom-Right) */}
      {showCookieBanner && (
        <aside className="wizz-cookie-card" role="dialog" aria-label="Cookie Settings">
          <h4>Cookie Settings</h4>
          <p>
            We only store necessary session cookies to authenticate your private finance workspace.
            Zero third-party tracking or advertising scripts.
          </p>
          <div className="wizz-cookie-actions">
            <button
              type="button"
              className="wizz-cookie-reject"
              onClick={() => handleCookieChoice(false)}
            >
              Reject
            </button>
            <button
              type="button"
              className="wizz-cookie-accept"
              onClick={() => handleCookieChoice(true)}
            >
              Accept
            </button>
          </div>
        </aside>
      )}

      {/* Bauhaus Footer */}
      <footer className="wizz-footer">
        <div className="wizz-footer-inner">
          <a className="wizz-footer-brand" href="/">
            <span className="wizz-footer-dot" />
            <span>MONETA</span>
          </a>
          <span className="wizz-footer-copy">
            Private Financial Workspace · Row Level Security · Built for Real Life
          </span>
          <div className="wizz-footer-links">
            <a href="/login" className="wizz-footer-link">Sign In</a>
            <a href="#overview" className="wizz-footer-link">Top ↑</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function LoginPage() {
  const { user, signInWithGoogle, error: configError } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const location = useLocation();
  if (user) return <Navigate to="/app/finance" replace/>;
  const stateError = (location.state as { message?: string } | null)?.message;
  const signIn = async () => {
    setBusy(true); setError('');
    try { await signInWithGoogle(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Google sign-in could not be started.'); setBusy(false); }
  };
  return <main className="ft-auth-page ft-auth-page-login"><a className="ft-auth-brand ft-auth-login-brand" href="/"><span><Wallet size={20}/></span>Moneta</a><section className="ft-auth-card"><div className="ft-auth-card-mark"><Wallet size={21}/></div><span className="ft-auth-kicker">YOUR FINANCES, IN FOCUS</span><h1>Welcome to Moneta</h1><p>Sign in or create your private finance workspace.</p><button type="button" className="ft-auth-google" onClick={()=>void signIn()} disabled={busy||Boolean(configError)}><GoogleMark/>{busy?<><LoaderCircle className="ft-spin" size={17}/>Connecting…</>:'Continue with Google'}</button>{(error||configError||stateError)&&<div className="ft-auth-error" role="alert">{error||configError||stateError}</div>}<div className="ft-auth-privacy"><ShieldCheck size={15}/> Your financial data is private to your account.</div></section><p className="ft-auth-back"><a href="/">Back to Moneta</a></p></main>;
}

type CallbackResult = { ok: true } | { ok: false; message: string };

const exchangeAttempts = new Map<string, Promise<CallbackResult>>();

function callbackFailure(message: string): string {
  if (/flow state|pkce|code verifier|verifier/i.test(message)) {
    return 'This sign-in link has expired or its browser verification state is unavailable. Return to sign in and start again in the same browser and site address.';
  }
  return message || 'Google sign-in could not be completed. Return to sign in and try again.';
}

function exchangeAuthorizationCodeOnce(code: string): Promise<CallbackResult> {
  const existing = exchangeAttempts.get(code);
  if (existing) return existing;

  const attempt = (async (): Promise<CallbackResult> => {
    if (!supabase) return { ok: false, message: 'Supabase is not configured.' };
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { ok: false, message: callbackFailure(error.message) };

    // Confirm Supabase persisted the session before allowing the protected route.
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) return { ok: false, message: callbackFailure(sessionError.message) };
    if (!data.session || !sessionData.session) {
      return { ok: false, message: 'Google sign-in did not establish a session. Return to sign in and try again.' };
    }
    return { ok: true };
  })().catch((cause: unknown) => ({
    ok: false as const,
    message: callbackFailure(cause instanceof Error ? cause.message : ''),
  }));

  // Keep only the outcome promise in memory. This prevents Strict Mode/remounts
  // from exchanging the same one-time PKCE code twice; no tokens are retained here.
  exchangeAttempts.set(code, attempt);
  return attempt;
}

export function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('Securing your Moneta session...');
  useEffect(() => {
    let active = true;
    const finish = async () => {
      if (!supabase) {
        if (active) setMessage('Supabase is not configured.');
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const authError = params.get('error_description') || params.get('error');
      if (authError) {
        if (active) setMessage(callbackFailure(authError));
        return;
      }

      const code = params.get('code');
      if (code) {
        const result = await exchangeAuthorizationCodeOnce(code);
        if (!active) return;
        if (!result.ok) {
          setMessage(result.message);
          return;
        }
      } else {
        // A callback without a code is accepted only when a session already exists.
        const { data, error } = await supabase.auth.getSession();
        if (!active) return;
        if (error || !data.session) {
          setMessage(callbackFailure(error?.message || 'No authorization code or active session was found.'));
          return;
        }
      }

      if (active) navigate('/app/finance', { replace: true });
    };

    void finish().catch((cause: unknown) => {
      if (active) setMessage(callbackFailure(cause instanceof Error ? cause.message : ''));
    });
    return () => { active = false; };
  }, [navigate]);

  return <main className="ft-auth-page ft-auth-callback"><div className="ft-auth-card-mark"><Wallet size={21}/></div><LoaderCircle className="ft-spin" size={22}/><p>{message}</p>{message !== 'Securing your Moneta session...'&&<a className="ft-auth-cta" href="/login">Return to sign in <ArrowRight size={16}/></a>}</main>;
}
function GoogleMark() { return <svg aria-hidden="true" viewBox="0 0 48 48" width="18" height="18"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.74 7.18l7.64 5.94c4.46-4.11 7.14-10.16 7.14-17.59z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.2A23.9 23.9 0 0 0 0 24c0 3.87.93 7.55 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.81l-7.64-5.94c-2.13 1.43-4.85 2.27-8.27 2.27-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>; }
