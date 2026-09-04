import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  ScanText, Gauge, Sparkles, Compass, Calculator, MonitorPlay,
  Database, Bot, FlaskConical, ExternalLink, ArrowRight,
} from 'lucide-react';

/**
 * Admin Tools — one drawer for the occasional-use tools.
 *
 * The sidebar was collecting a tool for every job: Quick Capture, Claims
 * Insight, Quick Builder. None of them are daily destinations, and each one
 * pushed the actual sections (Clients, Schedule, Financials) further down.
 * They live here instead, alongside the tools that had no menu entry at all
 * (Maya Knowledge, Demo Data) and the external ones William was keeping in
 * browser bookmarks.
 *
 * Deliberately NOT here: the Assessments section, which stays where it
 * belongs under Clients (ClientsSubNav) — those are client records, not a
 * tool. The Mental Fitness Journey card below is only a link out to the
 * public assessment page.
 */

const GROUPS = [
  {
    title: 'Prospecting tools',
    blurb: 'What you open in front of a prospect, or send them afterward.',
    tools: [
      {
        name: 'Quick Capture',
        description: 'File a lead from a card, a conversation, or a conference badge in under a minute.',
        icon: ScanText,
        tint: 'bg-[#264d44]/10 text-[#264d44]',
        page: 'AddLead',
      },
      {
        name: 'Claims Insight',
        description: 'Aggregate claims data in, mental health risk profile and hidden-cost estimate out.',
        icon: Gauge,
        tint: 'bg-[#013f7c]/10 text-[#013f7c]',
        page: 'ClaimsInsight',
      },
      {
        name: 'Quick Builder',
        description: 'The public campaign builder — price a program live on a call, or send the link.',
        icon: Sparkles,
        tint: 'bg-amber-100 text-amber-700',
        href: '/QuickBuilder',
      },
      {
        name: 'Mental Fitness Journey',
        description: 'The public team assessment. Results file back into Clients → Assessments.',
        icon: Compass,
        tint: 'bg-purple-100 text-purple-700',
        href: '/FitnessRoi',
      },
      {
        name: 'ROI Calculator',
        description: 'The standalone broker-facing calculator hosted on Railway.',
        icon: Calculator,
        tint: 'bg-emerald-100 text-emerald-700',
        href: 'https://skillfulmeans-roi-production.up.railway.app/',
      },
      {
        name: 'Client Demo',
        description: 'The walkthrough site for showing a prospect what their portal looks like.',
        icon: MonitorPlay,
        tint: 'bg-sky-100 text-sky-700',
        href: 'https://huegioi.github.io/skillfulmeans-client-demo',
      },
    ],
  },
  {
    title: 'Internal',
    blurb: 'Setup and testing. Nothing here is client-facing.',
    tools: [
      {
        name: 'Demo Data',
        description: 'Seed or clear the demo records used for walkthroughs.',
        icon: Database,
        tint: 'bg-red-100 text-red-700',
        page: 'Demo',
      },
      {
        name: 'Maya Knowledge',
        description: 'Edit what Maya knows about SkillfulMeans — the grounding behind her answers.',
        icon: Bot,
        tint: 'bg-indigo-100 text-indigo-700',
        page: 'MayaKnowledge',
      },
      {
        name: 'ROI Test Bed',
        description: 'Run the savings model against made-up inputs without touching a real client.',
        icon: FlaskConical,
        tint: 'bg-gray-100 text-gray-600',
        page: 'RoiTestBed',
      },
    ],
  },
];

function ToolCard({ tool }) {
  const Icon = tool.icon;
  const isExternal = Boolean(tool.href);

  const body = (
    <div className="flex items-start gap-3">
      <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${tool.tint}`}>
        <Icon className="w-5 h-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="font-semibold text-[#013f7c] text-sm leading-snug">{tool.name}</h3>
          {isExternal
            ? <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            : <ArrowRight className="w-3.5 h-3.5 text-gray-300 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500" />}
        </div>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{tool.description}</p>
      </div>
    </div>
  );

  const className =
    'group block bg-white rounded-xl border border-gray-200 p-4 shadow-sm transition-all ' +
    'hover:shadow-md hover:border-[#264d44]/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#264d44]';

  if (isExternal) {
    return (
      <a href={tool.href} target="_blank" rel="noopener noreferrer" className={className}>
        {body}
      </a>
    );
  }

  return (
    <Link to={createPageUrl(tool.page)} className={className}>
      {body}
    </Link>
  );
}

export default function AdminTools() {
  return (
    <div className="min-h-full bg-[#f4f0e9]">
      {/* Header — matches the other section headers */}
      <div className="bg-white border-b px-4 md:px-8 py-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: '#013f7c' }}>Admin Tools</h1>
          <p className="text-sm text-gray-500 mt-1">
            The tools that don't need a permanent spot in the menu.
          </p>
        </div>
      </div>

      <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto space-y-8">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">{group.title}</h2>
            <p className="text-sm text-gray-500 mt-0.5 mb-3">{group.blurb}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.tools.map((tool) => (
                <ToolCard key={tool.name} tool={tool} />
              ))}
            </div>
          </section>
        ))}

        {/* Where the assessments went — William asked for this to stay under Clients */}
        <p className="text-xs text-gray-400 border-t border-gray-200 pt-4">
          Looking for assessment results? They stay under{' '}
          <Link to={createPageUrl('Assessments')} className="text-[#264d44] font-semibold hover:underline">
            Clients → Assessments
          </Link>.
        </p>
      </div>
    </div>
  );
}
