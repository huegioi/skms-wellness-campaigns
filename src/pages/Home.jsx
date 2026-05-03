import React, { useState } from 'react';
import { Users, DollarSign, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import ClientInformationSection from '@/components/dashboard/ClientInformationSection';
import FinancialSummary from '@/components/dashboard/FinancialSummary';
import MarketingDashboard from '@/components/dashboard/MarketingDashboard';
import ServicesAnalytics from '@/components/dashboard/ServicesAnalytics';

export default function Home() {
  const [activeSection, setActiveSection] = useState('clients');

  const sections = [
    { id: 'clients', label: 'Client Information', icon: Users },
    { id: 'financial', label: 'Financial Information', icon: DollarSign },
    { id: 'marketing', label: 'Marketing', icon: TrendingUp },
    { id: 'services', label: 'Services', icon: TrendingUp }
  ];

  const currentIndex = sections.findIndex(s => s.id === activeSection);
  const goLeft = () => { if (currentIndex > 0) setActiveSection(sections[currentIndex - 1].id); };
  const goRight = () => { if (currentIndex < sections.length - 1) setActiveSection(sections[currentIndex + 1].id); };

  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      {/* Page Header with tabs (same style as Financials) */}
      <div className="bg-white border-b px-4 md:px-8 pt-6 pb-0 sticky top-16 z-10">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold mb-4" style={{ color: '#013f7c' }}>Dashboard</h1>
          {/* Desktop tabs */}
          <div className="hidden md:flex gap-1">
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
          {/* Mobile: arrow navigation */}
          <div className="md:hidden flex items-center gap-3 pb-3">
            <button
              onClick={goLeft}
              disabled={currentIndex === 0}
              className="p-1.5 rounded-full border border-gray-200 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 transition-all flex-shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 text-center">
              {(() => { const Icon = sections[currentIndex].icon; return (
                <span className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-[#264d44] text-white">
                  <Icon className="w-3.5 h-3.5" />
                  {sections[currentIndex].label}
                </span>
              ); })()}
            </div>
            <button
              onClick={goRight}
              disabled={currentIndex === sections.length - 1}
              className="p-1.5 rounded-full border border-gray-200 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 transition-all flex-shrink-0"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
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