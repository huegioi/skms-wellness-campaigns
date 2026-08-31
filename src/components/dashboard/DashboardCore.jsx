import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Users, DollarSign, TrendingUp, Package, FlaskConical, BookOpen } from 'lucide-react';
import NewInquiriesCard from '@/components/dashboard/NewInquiriesCard';
import ActionableReviewQueue from '@/components/dashboard/ActionableReviewQueue';
import MayaBriefingCard from '@/components/dashboard/MayaBriefingCard';
import FinancialSummary from '@/components/dashboard/FinancialSummary';
import ClientInformationSection from '@/components/dashboard/ClientInformationSection';
import FinancialInformationSection from '@/components/dashboard/FinancialInformationSection';
import MarketingDashboard from '@/components/dashboard/MarketingDashboard';
import ServicesAnalytics from '@/components/dashboard/ServicesAnalytics';

export default function DashboardCore() {
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'financial', label: 'Financial', icon: DollarSign },
    { id: 'marketing', label: 'Marketing', icon: TrendingUp },
    { id: 'services', label: 'Services', icon: Package },
  ];


  return (
    <div className="min-h-screen bg-brand-cream">
      {/* Page Header with tabs */}
      <div className="bg-white border-b px-4 md:px-8 pt-6 pb-0 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-brand-navy">Dashboard</h1>
            <div className="flex items-center gap-2">
              {/* Labels drop away on phones so they stop crowding the page title */}
              <Link to="/MayaKnowledge" aria-label="Maya Knowledge" className="flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 px-3 sm:py-1.5 rounded-lg text-sm font-medium text-brand-green bg-green-50 hover:bg-green-100 transition-colors">
                <BookOpen className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Maya Knowledge</span>
              </Link>
              <Link to="/Demo" aria-label="Demo Environment" className="flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 px-3 sm:py-1.5 rounded-lg text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors">
                <FlaskConical className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Demo Environment</span>
              </Link>
            </div>
          </div>
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
                      ? 'border-brand-green text-brand-green bg-brand-cream'
                      : 'border-transparent text-gray-500 hover:text-gray-700 bg-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {section.label}
                </button>
              );
            })}
          </div>
          {/* Mobile: scrolling chip row — all five sections visible, one tap each */}
          <div className="md:hidden -mx-4 px-4 pb-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-2 w-max">
              {sections.map(section => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`flex items-center gap-1.5 px-3.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                      isActive ? 'bg-brand-green text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    style={{ minHeight: 44 }}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
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
        {activeSection === 'overview' && (
          <>
            <NewInquiriesCard />
            <ActionableReviewQueue />
            <MayaBriefingCard />
            <FinancialSummary />
          </>
        )}
        {activeSection === 'clients' && <ClientInformationSection />}
        {activeSection === 'financial' && <FinancialInformationSection />}
        {activeSection === 'marketing' && <MarketingDashboard />}
        {activeSection === 'services' && <ServicesAnalytics />}
      </div>
    </div>
  );
}