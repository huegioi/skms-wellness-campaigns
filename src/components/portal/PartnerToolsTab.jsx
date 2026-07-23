import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, TrendingUp, Calculator, Copy, Share2, ExternalLink, CheckCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/copyToClipboard';

const TOOLS = [
  {
    key: 'mfs',
    icon: Brain,
    color: '#770142',
    bg: 'rgba(119,1,66,0.06)',
    title: 'The Mental Fitness Score',
    url: (ref) => `https://app.skillfulmeans.life/MentalFitnessScore?ref=${ref}`,
    credited: true,
    description: 'A free, anonymous team assessment — one link, three minutes per employee, and your client gets a live dashboard scoring their team\u2019s wellbeing, stress, engagement, and connection against research norms.',
    howToUse: 'The door-opener. Send it to a client who\u2019s lukewarm on wellness spend \u2014 \u201Crun this free with your team, then let\u2019s look at the results together.\u201D The Score gives you a concrete number to build the renewal or benefits conversation around, and you\u2019ll see their results in your book of business here.',
  },
  {
    key: 'journey',
    icon: TrendingUp,
    color: '#0f766e',
    bg: 'rgba(15,118,110,0.06)',
    title: 'The Mental Fitness Journey',
    url: (ref) => `https://app.skillfulmeans.life/FitnessRoi?ref=${ref}`,
    credited: true,
    description: 'The deeper experience: your client\u2019s leader predicts their team\u2019s mental fitness, the team answers anonymously, and the dashboard reveals the gap \u2014 then turns their real scores into a projected financial impact.',
    howToUse: 'The closer. Best for a decision-maker who thinks they already know their team \u2014 the estimate-vs-reality reveal does the persuading for you. Walk through the results with them and the ROI math is already done for the CFO conversation.',
  },
  {
    key: 'quickbuilder',
    icon: Sparkles,
    color: '#264d44',
    bg: 'rgba(38,77,68,0.06)',
    title: 'Quick Builder',
    url: (ref) => `https://app.skillfulmeans.life/QuickBuilder?ref=${ref}`,
    credited: true,
    description: 'Let a client sketch their own wellness campaign — pick services, see stage-based pricing, and send you the result. A fast, no-pressure way to start a program conversation.',
    howToUse: 'The self-serve starter. Send this to a client who wants to explore options on their own time — they pick what fits their team and budget, and you get the results to follow up with a tailored proposal.',
  },
  {
    key: 'roi_calc',
    icon: Calculator,
    color: '#013f7c',
    bg: 'rgba(1,63,124,0.06)',
    title: 'The ROI Calculator',
    url: () => 'https://skillfulmeans-roi-production.up.railway.app/',
    credited: false,
    description: 'Model the 3-year financial impact of a mental fitness program for any client \u2014 medical claims, absenteeism, presenteeism, turnover \u2014 grounded in published clinical research, with a PDF report built for client meetings.',
    howToUse: 'The CFO tool. When the blocker is budget, run their numbers live in the meeting \u2014 most carrier wellness dollars go unspent, and the calculator shows programs often fund at zero net cost. Note: this tool doesn\u2019t track attribution, so tell us when a client came from it.',
  },
];

function ToolCard({ tool, refCode }) {
  const [copied, setCopied] = useState(false);
  const link = tool.url(refCode);
  const Icon = tool.icon;
  const isExternal = link.startsWith('http') && !link.includes('app.skillfulmeans.life');

  const handleCopy = async () => {
    const ok = await copyToClipboard(link);
    if (ok) {
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Could not copy — long-press the link to copy manually.');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: tool.title,
          text: tool.description,
          url: link,
        });
      } catch (e) {
        // user cancelled — no action needed
      }
    } else {
      handleCopy();
    }
  };

  return (
    <Card className="border-[#e6e1d8] bg-[#f9f8f5] border-l-4 overflow-hidden" style={{ borderLeftColor: tool.color }}>
      <CardContent className="pt-5 pb-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2.5 rounded-xl shrink-0" style={{ backgroundColor: tool.bg }}>
            <Icon className="w-6 h-6" style={{ color: tool.color }} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-stone-800 text-base leading-tight">{tool.title}</h3>
            {tool.credited && (
              <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: tool.bg, color: tool.color }}>
                <Sparkles className="w-3 h-3" />
                Your link credits you
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-stone-600 leading-relaxed mb-3">{tool.description}</p>

        {/* How to use it */}
        <div className="bg-white/70 rounded-lg p-3 mb-4 border border-[#e6e1d8]">
          <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400 mb-1">How to use it</p>
          <p className="text-sm text-stone-600 leading-relaxed">{tool.howToUse}</p>
        </div>

        {/* Link display */}
        <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-[#e6e1d8] mb-3">
          <span className="font-mono text-xs text-stone-500 truncate flex-1">{link}</span>
          {isExternal && <ExternalLink className="w-3.5 h-3.5 text-stone-400 shrink-0" />}
        </div>

        {/* Share actions */}
        <div className="flex gap-2">
          <Button onClick={handleCopy} size="sm" className="gap-1.5 shrink-0" style={{ backgroundColor: tool.color }}>
            {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy Link'}
          </Button>
          <Button onClick={handleShare} variant="outline" size="sm" className="gap-1.5 shrink-0">
            <Share2 className="w-3.5 h-3.5" />
            Share
          </Button>
          <a href={link} target="_blank" rel="noopener noreferrer" className="ml-auto">
            <Button variant="ghost" size="sm" className="gap-1.5 text-stone-500">
              <ExternalLink className="w-3.5 h-3.5" />
              Open
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PartnerToolsTab({ refCode }) {
  if (!refCode) return null;
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="text-xl font-bold text-brand-navy">Partner Tools</h2>
        <p className="text-sm text-stone-500 mt-1">Four tools to open doors, close deals, and make the CFO math easy. Share them with your clients — the first three credit you automatically.</p>
      </div>

      {TOOLS.map(tool => (
        <ToolCard key={tool.key} tool={tool} refCode={refCode} />
      ))}

      <p className="text-center text-sm text-stone-500 pt-2">
        Questions, co-selling help, or want us on a client call?{' '}
        <a href="mailto:admin@skillfulmeans.life" className="font-semibold text-brand-navy hover:underline">admin@skillfulmeans.life</a>
        — that's what we're here for.
      </p>
    </div>
  );
}