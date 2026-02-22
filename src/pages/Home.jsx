import React, { useState } from 'react';
import { Menu, Users, DollarSign, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ClientInformationSection from '@/components/dashboard/ClientInformationSection';
import FinancialSummary from '@/components/dashboard/FinancialSummary';
import MarketingDashboard from '@/components/dashboard/MarketingDashboard';
import ServicesAnalytics from '@/components/dashboard/ServicesAnalytics';

export default function Home() {
  const [activeSection, setActiveSection] = useState('clients');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const sections = [
    { id: 'clients', label: 'Client Information', icon: Users },
    { id: 'financial', label: 'Financial Information', icon: DollarSign },
    { id: 'marketing', label: 'Marketing', icon: TrendingUp },
    { id: 'services', label: 'Services', icon: TrendingUp }
  ];

  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      {/* Page Header with tabs (same style as Financials) */}
      <div className="bg-white border-b px-4 md:px-8 pt-6 pb-0 sticky top-16 z-10">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold mb-4" style={{ color: '#013f7c' }}>Dashboard</h1>
          {/* Desktop tabs */}
          <div className="hidden sm:flex gap-1">
            {sections.map(section => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-t-xl border-b-2 transition-all ${
                    isActive
                      ? 'border-[#264d44] text-[#264d44] bg-[#f4f0e9]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 bg-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {section.label}
                </button>
              );
            })}
          </div>
          {/* Mobile: dropdown toggle */}
          <div className="sm:hidden flex items-center justify-between pb-2">
            <span className="text-sm font-semibold text-[#264d44]">
              {sections.find(s => s.id === activeSection)?.label}
            </span>
            <Button variant="outline" size="sm" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <Menu className="w-5 h-5" />
            </Button>
          </div>
          {mobileMenuOpen && (
            <div className="sm:hidden pb-2 space-y-1">
              {sections.map(section => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => { setActiveSection(section.id); setMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                      activeSection === section.id
                        ? 'bg-[#264d44] text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{section.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        {activeSection === 'clients' && <ClientInformationSection />}
        {activeSection === 'financial' && <FinancialSummary />}
        {activeSection === 'marketing' && <MarketingDashboard />}
        {activeSection === 'services' && <ServicesAnalytics />}
      </div>
    </div>
  );
}