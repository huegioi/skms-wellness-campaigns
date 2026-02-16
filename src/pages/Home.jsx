import React, { useState } from 'react';
import { Menu, Users, DollarSign, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ClientInformationSection from '@/components/dashboard/ClientInformationSection';
import FinancialInformationSection from '@/components/dashboard/FinancialInformationSection';
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
      {/* Desktop Tabs */}
      <div className="hidden lg:block bg-white border-b sticky top-16 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 py-3">
            {sections.map(section => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeSection === section.id
                      ? 'bg-[#264d44] text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1">
          {/* Mobile Header */}
          <div className="lg:hidden bg-white border-b p-4 sticky top-16 z-10">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold" style={{ color: '#013f7c' }}>Dashboard</h1>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <Menu className="w-5 h-5" />
              </Button>
            </div>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
              <div className="mt-4 space-y-2">
                {sections.map(section => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => {
                        setActiveSection(section.id);
                        setMobileMenuOpen(false);
                      }}
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

        {/* Content Area */}
        <div className="p-4 md:p-8">
          {activeSection === 'clients' && <ClientInformationSection />}
          {activeSection === 'financial' && <FinancialInformationSection />}
          {activeSection === 'marketing' && <MarketingDashboard />}
          {activeSection === 'services' && <ServicesAnalytics />}
        </div>
      </main>
    </div>
  );
}