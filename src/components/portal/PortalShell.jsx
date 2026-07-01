import React from 'react';
import { AlertCircle } from 'lucide-react';

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
  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      {/* Header */}
      <div className="text-white" style={{ backgroundColor: accentColor }}>
        <div className={`${maxWidth} mx-auto ${headerPadding}`}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              {logo && (
                <img src={LOGO_URL} alt="SKMS Wellness" className={logoClass} />
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
        {/* Tab Bar — inside header band */}
        {tabs && tabs.length > 0 && (
          <div className={`${maxWidth} mx-auto mt-5 flex gap-1`}>
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => onTabChange(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-semibold transition-colors ${
                  activeTab === key
                    ? 'bg-[#f4f0e9] text-[#013f7c]'
                    : 'text-blue-200 hover:text-white hover:bg-white/10'
                }`}
              >
                {Icon && <Icon className="w-4 h-4" />}
                {label}
              </button>
            ))}
          </div>
        )}
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
    <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
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
}) {
  return (
    <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <Icon className={`${iconClass} mx-auto mb-4`} />
        <h2 className="text-xl font-bold text-gray-800 mb-2">{heading}</h2>
        <p className="text-gray-500">{message}</p>
      </div>
    </div>
  );
}