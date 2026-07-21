import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Users, DollarSign, TrendingUp, Package, ChevronLeft, ChevronRight, FlaskConical, BookOpen } from 'lucide-react';
import NewInquiriesCard from '@/components/dashboard/NewInquiriesCard';
import MfsQuickShareCard from '@/components/mfs/MfsQuickShareCard';
import ActionableReviewQueue from '@/components/dashboard/ActionableReviewQueue';
import FollowUpSummary from '@/components/dashboard/FollowUpSummary';
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

  const currentIndex = sections.findIndex(s => s.id === activeSection);
  const goLeft = () => { if (currentIndex > 0) setActiveSection(sections[currentIndex - 1].id); };
  const goRight = () => { if (currentIndex < sections.length - 1) setActiveSection(sections[currentIndex + 1].id); };

  return (
    <div className="min-h-screen bg-brand-cream">
      {/* Page Header with tabs */}
      <div className="bg-white border-b px-4 md:px-8 pt-6 pb-0 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-brand-navy">Dashboard</h1>
            <div className="flex items-center gap-2">
              <Link to="/MayaKnowledge" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-brand-green bg-green-50 hover:bg-green-100 transition-colors">
                <BookOpen className="w-4 h-4" />
                Maya Knowledge
              </Link>
              <Link to="/Demo" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors">
                <FlaskConical className="w-4 h-4" />
                Demo Environment
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
          {/* Mobile: arrow navigation */}
          <div className="md:hidden flex items-center gap-3 pb-3">
            <button
              onClick={goLeft}
              disabled={currentIndex === 0}
              className="p-2 rounded-full bg-blue-100 text-blue-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-200 transition-all flex-shrink-0"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex-1 text-center">
              {(() => { const Icon = sections[currentIndex].icon; return (
                <span className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-brand-green text-white">
                  <Icon className="w-3.5 h-3.5" />
                  {sections[currentIndex].label}
                </span>
              ); })()}
            </div>
            <button
              onClick={goRight}
              disabled={currentIndex === sections.length - 1}
              className="p-2 rounded-full bg-blue-100 text-blue-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-200 transition-all flex-shrink-0"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        {activeSection === 'overview' && (
          <>
            <NewInquiriesCard />
            <MfsQuickShareCard />
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