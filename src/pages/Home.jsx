import React, { useState, useRef, useEffect } from 'react';
import { Users, DollarSign, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import ClientInformationSection from '@/components/dashboard/ClientInformationSection';
import FinancialSummary from '@/components/dashboard/FinancialSummary';
import MarketingDashboard from '@/components/dashboard/MarketingDashboard';
import ServicesAnalytics from '@/components/dashboard/ServicesAnalytics';

export default function Home() {
  const [activeSection, setActiveSection] = useState('clients');
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);
  const scrollRef = useRef(null);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 4);
    setShowRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    handleScroll();
  }, []);

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
          {/* Mobile: scrollable pill tabs with arrow indicators */}
          <div className="md:hidden relative">
            {showLeft && (
              <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center pointer-events-none">
                <div className="bg-gradient-to-r from-white via-white to-transparent pr-4 pl-1 h-full flex items-center">
                  <ChevronLeft className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            )}
            {showRight && (
              <div className="absolute right-0 top-0 bottom-0 z-10 flex items-center pointer-events-none">
                <div className="bg-gradient-to-l from-white via-white to-transparent pl-4 pr-1 h-full flex items-center">
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            )}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1"
            >
              {sections.map(section => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all ${
                      isActive
                        ? 'bg-[#264d44] text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {section.label}
                  </button>
                );
              })}
            </div>
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