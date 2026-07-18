import React from 'react';
import { ShieldCheck, ClipboardList, Lock, Mail, Eye, Users, ArrowRight, HelpCircle } from 'lucide-react';

const PROCESS_STEPS = [
  {
    icon: Users,
    title: 'Share the survey',
    desc: 'After you submit this form, you\'ll receive a unique survey link to forward to your team. It takes about 3 minutes per person.',
  },
  {
    icon: ClipboardList,
    title: 'Employees respond anonymously',
    desc: 'Team members answer a short set of validated questions covering wellbeing, stress, engagement, and connection. No names, no emails, no accounts.',
  },
  {
    icon: Eye,
    title: 'Results unlock at 5 responses',
    desc: 'Once five or more people have participated, your dashboard goes live with aggregated group scores and benchmark comparisons.',
  },
  {
    icon: ArrowRight,
    title: 'Review and plan',
    desc: 'You\'ll see where your team stands and which areas need attention. Optionally schedule a free strategy session to interpret the results.',
  },
];

const DATA_POINTS = [
  {
    icon: Lock,
    title: 'Employee responses are anonymous',
    desc: 'We never collect names, email addresses, or any identifiers from employees taking the survey. Responses are grouped and shown only as team averages.',
  },
  {
    icon: ShieldCheck,
    title: 'A 5-response privacy threshold',
    desc: 'Scores remain locked until at least five people have responded. This prevents any individual\'s answers from being inferred from small numbers.',
  },
  {
    icon: Eye,
    title: 'No individual scores are ever shown',
    desc: 'The dashboard displays group-level averages only. There is no way to view or identify any single person\'s responses.',
  },
  {
    icon: Mail,
    title: 'Your contact information',
    desc: 'The name, email, and company you provide on this form are used to set up your assessment, share your results links, and follow up about findings and relevant services. You can request deletion at any time.',
  },
];

export default function MfsProcessInfo() {
  return (
    <div className="space-y-6 mt-6">
      {/* How It Works */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
        <h2 className="text-lg font-bold text-[#013f7c] mb-1">How It Works</h2>
        <p className="text-sm text-gray-500 mb-6">A simple, four-step process from setup to insights.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {PROCESS_STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} className="flex gap-4">
                <div className="shrink-0">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(1,63,124,0.08)' }}>
                    <Icon className="w-5 h-5 text-[#013f7c]" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold text-gray-400">STEP {i + 1}</span>
                  </div>
                  <h3 className="font-semibold text-sm text-gray-800">{step.title}</h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* How Your Information Is Handled */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-5 h-5 text-[#264d44]" />
          <h2 className="text-lg font-bold text-[#264d44]">How Your Information Is Handled</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">Privacy is built into every step of this assessment.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {DATA_POINTS.map((point, i) => {
            const Icon = point.icon;
            return (
              <div key={i} className="flex gap-4">
                <div className="shrink-0">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(38,77,68,0.10)' }}>
                    <Icon className="w-5 h-5 text-[#264d44]" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-gray-800">{point.title}</h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{point.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-5 pt-5 border-t border-gray-100">
          <p className="text-xs text-gray-400 leading-relaxed">
            SkillfulMeans Wellness complies with applicable data protection regulations. Employee survey
            responses are stored without identifying information. The contact information you provide on this
            form is kept confidential and used only for the purposes described above. You may request access
            to or deletion of your data at any time by emailing{' '}
            <a href="mailto:admin@skillfulmeans.life" className="text-[#013f7c] font-medium underline">admin@skillfulmeans.life</a>.
          </p>
        </div>
      </div>

      {/* Need Help */}
      <div className="bg-[#f9f8f5] rounded-2xl border border-[#e6e1d8] p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#013f7c]">
              <HelpCircle className="w-5 h-5 text-white" />
            </div>
          </div>
          <div>
            <h2 className="font-bold text-sm text-gray-800 mb-1">Need Help?</h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              If you encounter any difficulty with the assessment — whether setting it up, sharing the survey
              link, or viewing your results — we're here to help. Email us at{' '}
              <a href="mailto:admin@skillfulmeans.life" className="text-[#013f7c] font-medium underline">
                admin@skillfulmeans.life
              </a>{' '}
              and we'll respond within one business day. Employees who have trouble accessing the survey should
              contact their HR representative first, or reach out to us directly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}