import React, { useState } from 'react';
import { AlertCircle, Menu, X } from 'lucide-react';

const LOGO_URL = 'https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/1272f92b7_SKMSLogoShieldWhite.png';

/**
 * Shared portal layout: cream page, colored header band with SKMS shield logo,
 * optional in-header tab bar, and a max-width content column.
 */
export function PortalShell({
  title,
  subtitle,
  accentColor = '#013f7c',
  headerRight,
  tabs,
  activeTab,
  onTabChange,
  children,
  eyebrow,
  maxWidth = 'max-w-4xl',
  logo = true,
  logoClass = 'h-9',
  headerExtra,
  footer,
  headerPadding = 'py-6 px-4',
  subtitleClass = 'text-blue-200',
  eyebrowClass = 'text-blue-200 text-sm font-medium mb-1',
  titleClass = 'text-2xl font-bold',
  contentClass = 'px-4 py-8',
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hasTabs = tabs && tabs.length > 0;

  // ── Sidebar layout (tabs present) ──
  if (hasTabs) {
    const renderNav = (onNavigate) => (
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => {
              onTabChange(key);
              if (onNavigate) onNavigate();
            }}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full text-left ${
              activeTab === key
                ? 'bg-white/15 text-white'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            }`}
          >
            {Icon && <Icon className="w-4 h-4 shrink-0" />}
            {label}
          </button>
        ))}
      </nav>
    );

    return (
      <div className="h-screen bg-brand-cream flex overflow-hidden">
        {/* Desktop sidebar */}
        <aside
          className="hidden lg:flex flex-col w-56 shrink-0 fixed inset-y-0 left-0 z-40 shadow-md"
          style={{ backgroundColor: accentColor }}
        >
          <div className="px-4 py-4 border-b border-white/10">
            {logo && <img src={LOGO_URL} alt="SkillfulMeans" className="h-8 w-auto mb-3" />}
            {eyebrow && <p className="text-white/70 text-xs font-medium mb-0.5">{eyebrow}</p>}
            <h1 className="text-white font-bold text-sm leading-tight">{title}</h1>
            {subtitle && <p className={`${subtitleClass} mt-0.5`}>{subtitle}</p>}
            {headerExtra && <div className="mt-1">{headerExtra}</div>}
          </div>
          {renderNav()}
        </aside>

        {/* Mobile overlay */}
        {drawerOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setDrawerOpen(false)}
          />
        )}

        {/* Mobile drawer */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col transition-transform duration-200 lg:hidden ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{ backgroundColor: accentColor }}
        >
          <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              {logo && <img src={LOGO_URL} alt="SKMS" className="h-7 w-auto" />}
              <span className="text-white font-bold text-sm">{title}</span>
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/10"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          {renderNav(() => setDrawerOpen(false))}
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 lg:ml-56 overflow-y-auto">
          {/* Mobile top bar */}
          <div
            className="lg:hidden flex items-center justify-between px-4 py-3 shadow-sm"
            style={{ backgroundColor: accentColor }}
          >
            <div className="flex items-center gap-2">
              {logo && <img src={LOGO_URL} alt="SKMS" className="h-7 w-auto" />}
              <span className="text-white font-bold text-sm">{title}</span>
            </div>
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center justify-center rounded-full bg-white/20 text-white touch-manipulation"
              style={{ width: 44, height: 44, WebkitTapHighlightColor: 'transparent' }}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {/* Slim header row (headerRight actions only) */}
          {headerRight && (
            <div className={`${maxWidth} mx-auto w-full px-4 pt-6 flex items-center justify-end gap-4`}>
              {headerRight}
            </div>
          )}

          {/* Content */}
          <div className={`${maxWidth} mx-auto ${contentClass} flex-1`}>
            {children}
          </div>

          {footer}
        </div>
      </div>
    );
  }

  // ── Original layout (no tabs) ──
  return (
    <div className="min-h-screen bg-brand-cream">
      {/* Header */}
      <div className="text-white" style={{ backgroundColor: accentColor }}>
        <div className={`${maxWidth} mx-auto ${headerPadding}`}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              {logo && (
                <img src={LOGO_URL} alt="SkillfulMeans" className={logoClass} />
              )}
              <div>
                {eyebrow && <p className={eyebrowClass}>{eyebrow}</p>}
                <h1 className={titleClass}>{title}</h1>
                {subtitle && <p className={`${subtitleClass} mt-1`}>{subtitle}</p>}
                {headerExtra}
              </div>
            </div>
            {headerRight && <div className="flex items-center gap-4">{headerRight}</div>}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={`${maxWidth} mx-auto ${contentClass}`}>
        {children}
      </div>

      {footer}
    </div>
  );
}

/**
 * Centered spinner on the cream page background, tinted with the portal's accent color.
 */
export function PortalLoading({ accentColor = '#013f7c', label }) {
  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center">
      <div className="text-center">
        <div
          className="w-8 h-8 border-4 rounded-full animate-spin mx-auto"
          style={{ borderColor: accentColor, borderTopColor: 'transparent' }}
        />
        {label && <p className="text-gray-600 mt-4">{label}</p>}
      </div>
    </div>
  );
}

/**
 * White card with icon, heading, and message — for portal not-found / error states.
 */
export function PortalError({
  icon: Icon = AlertCircle,
  iconClass = 'w-12 h-12 text-red-400',
  heading,
  message,
  action,
}) {
  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <Icon className={`${iconClass} mx-auto mb-4`} />
        <h2 className="text-xl font-bold text-gray-800 mb-2">{heading}</h2>
        <p className="text-gray-500">{message}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}