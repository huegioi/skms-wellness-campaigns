import React, { useState } from 'react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronDown, ShieldCheck, ClipboardList, Eye, HelpCircle, Lock, Mail, Users, ArrowRight } from 'lucide-react';

const PROCESS_STEPS = [
  { icon: Users, title: 'Share the survey', desc: 'After you submit this form, you\'ll receive a unique survey link to forward to your team. It takes about 3 minutes per person.' },
  { icon: ClipboardList, title: 'Employees respond anonymously', desc: 'Team members answer a short set of validated questions covering wellbeing, stress, engagement, and connection. No names, no emails, no accounts.' },
  { icon: Eye, title: 'Results unlock at 5 responses', desc: 'Once five or more people have participated, your dashboard goes live with aggregated group scores and benchmark comparisons.' },
  { icon: ArrowRight, title: 'Review and plan', desc: 'You\'ll see where your team stands and which areas need attention. Optionally schedule a free strategy session to interpret the results.' },
];

const DATA_POINTS = [
  { icon: ShieldCheck, title: 'How employee responses are stored', desc: 'Survey responses are stored without names, email addresses, or any identifiers. They are retained as aggregated group scores and are not linked to any individual.' },
  { icon: Mail, title: 'Your contact information', desc: 'The name, email, and company you provide on this form are used to set up your assessment, share your results links, and follow up about findings and relevant services. You can request deletion at any time.' },
];

const VISIBILITY = [
  { role: 'You (the HR contact)', sees: 'The dashboard with team-level aggregated scores and benchmark comparisons. You do not see any individual employee\'s responses.' },
  { role: 'Your employees', sees: 'Only the survey questions they are answering. They do not see results or other employees\' responses.' },
  { role: 'SkillfulMeans', sees: 'The aggregated group scores and your contact information. We do not see individual responses linked to any person.' },
  { role: 'No one', sees: 'Can view or identify any single person\'s responses. The 5-response threshold and group-level averaging ensure this.' },
];

function InfoItem({ id, icon: Icon, title, children, open, onToggle }) {
  return (
    <Collapsible open={open} onOpenChange={onToggle}>
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <CollapsibleTrigger className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <Icon className="w-4 h-4 text-[#264d44] shrink-0" />
            <span className="font-semibold text-sm text-gray-800">{title}</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-5 pb-5 pt-3 border-t border-gray-50">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function PointRow({ icon: Icon, title, desc, accent }) {
  const bg = accent === 'navy' ? 'rgba(1,63,124,0.08)' : 'rgba(38,77,68,0.10)';
  const color = accent === 'navy' ? 'text-[#013f7c]' : 'text-[#264d44]';
  return (
    <div className="flex gap-3">
      <div className="shrink-0">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: bg }}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
      <div>
        <h3 className="font-semibold text-sm text-gray-800">{title}</h3>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

export default function MfsProcessInfo() {
  const [openItems, setOpenItems] = useState({});

  const toggle = (id) => setOpenItems(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="mt-6">
      <h2 className="text-lg font-bold text-[#264d44] mb-4 text-center">How your information is handled</h2>
      <div className="space-y-2">
        <InfoItem id="how-it-works" icon={ClipboardList} title="How the assessment works" open={!!openItems['how-it-works']} onToggle={() => toggle('how-it-works')}>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            <strong>How it works:</strong> Share a 3-minute survey with your team. You'll see aggregated
            wellbeing, stress, engagement, and connection scores — with benchmark comparisons. Results unlock
            once 5 people have responded. It's free. Responses are anonymous — see 'Who sees what' below.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PROCESS_STEPS.map((step, i) => (
              <PointRow key={i} icon={step.icon} title={step.title} desc={step.desc} accent="navy" />
            ))}
          </div>
        </InfoItem>

        <InfoItem id="what-we-do" icon={ShieldCheck} title="What we do with responses" open={!!openItems['what-we-do']} onToggle={() => toggle('what-we-do')}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {DATA_POINTS.map((point, i) => (
              <PointRow key={i} icon={point.icon} title={point.title} desc={point.desc} accent="green" />
            ))}
          </div>
          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 leading-relaxed">
              SkillfulMeans Wellness complies with applicable data protection regulations. Employee survey
              responses are stored without identifying information. The contact information you provide on this
              form is kept confidential and used only for the purposes described above. You may request access
              to or deletion of your data at any time by emailing{' '}
              <a href="mailto:admin@skillfulmeans.life" className="text-[#013f7c] font-medium underline">admin@skillfulmeans.life</a>.
            </p>
          </div>
        </InfoItem>

        <InfoItem id="who-sees-what" icon={Eye} title="Who sees what" open={!!openItems['who-sees-what']} onToggle={() => toggle('who-sees-what')}>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            Employee responses are anonymous — no names, emails, or accounts are collected. A 5-response
            privacy threshold prevents any individual's answers from being inferred, and the dashboard shows
            group-level averages only.
          </p>
          <div className="space-y-3">
            {VISIBILITY.map((row, i) => (
              <div key={i} className="flex gap-3">
                <div className="shrink-0 w-28">
                  <span className="text-xs font-semibold text-[#264d44]">{row.role}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed flex-1">{row.sees}</p>
              </div>
            ))}
          </div>
        </InfoItem>

        <InfoItem id="need-help" icon={HelpCircle} title="Need help?" open={!!openItems['need-help']} onToggle={() => toggle('need-help')}>
          <p className="text-xs text-gray-500 leading-relaxed">
            If you encounter any difficulty with the assessment — whether setting it up, sharing the survey
            link, or viewing your results — we're here to help. Email us at{' '}
            <a href="mailto:admin@skillfulmeans.life" className="text-[#013f7c] font-medium underline">
              admin@skillfulmeans.life
            </a>{' '}
            and we'll respond within one business day. Employees who have trouble accessing the survey should
            contact their HR representative first, or reach out to us directly.
          </p>
        </InfoItem>
      </div>
    </div>
  );
}