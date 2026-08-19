import React, { useState, useRef } from 'react';
import { ChevronLeft, ShieldCheck } from 'lucide-react';
import JourneyProgressBar from '@/components/fitnessroi/JourneyProgressBar';
import JourneyProcessStrip from '@/components/fitnessroi/JourneyProcessStrip';
import QuickQuestionCard from '@/components/fitnessroi/QuickQuestionCard';
import CompanyInfoForm from '@/components/fitnessroi/CompanyInfoForm';
import EmailGate from '@/components/fitnessroi/EmailGate';
import ResultsView from '@/components/fitnessroi/ResultsView';
import JourneyDashboardTeaser from '@/components/fitnessroi/JourneyDashboardTeaser';

const QUESTIONS = [
  { label: 'Wellbeing',  key: 'wellbeing',  text: 'How many of your people would say they usually feel energized and well at work?' },
  { label: 'Stress',     key: 'stress',     text: 'How many of your people are running at unsustainably high stress right now?' },
  { label: 'Engagement', key: 'engagement', text: 'How many of your people are visibly enthusiastic and absorbed in their work?' },
  { label: 'Connection', key: 'connection', text: "How many of your people have real relationships at work — people they'd call friends?" },
];
const OPTIONS = ['Almost none', 'About a quarter', 'About half', 'Most', 'Nearly all'];
const LOGO_URL = 'https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/bb0a43468_SKMSLogoShieldBrown.png';
const PART_HEADERS = ['Your read on your team', 'Your read on your team', 'Your read on your team', 'Your read on your team', 'About your company', 'See your results'];

export default function FitnessRoi() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ wellbeing: null, stress: null, engagement: null, connection: null });
  const [company, setCompany] = useState({ headcount: '', avgSalary: 65000, turnoverRate: 0.18, industry: '' });
  const [ref] = useState(() => new URLSearchParams(window.location.search).get('ref') || '');
  const [resultsData, setResultsData] = useState(null);
  const startRef = useRef(null);

  // Maps internal step (0–6) to the 4-step journey phase shown in the strip
  const activeJourneyStep = step <= 4 ? 1 : step === 5 ? 2 : 4;

  const handleQuickAnswer = (key, index) => {
    setAnswers(prev => ({ ...prev, [key]: index }));
    setTimeout(() => setStep(s => s + 1), 300);
  };

  const scrollToStart = () => {
    startRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="mf mf-screen min-h-screen">
      {/* Branded header — every step */}
      <header className="border-b border-black/5 bg-white/60 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center gap-2.5">
          <img src={LOGO_URL} alt="SkillfulMeans" className="h-7 w-auto" />
          <span className="text-[15px] font-semibold tracking-tight text-mf-plum">skillfulmeans</span>
        </div>
      </header>

      {step === 0 && (
        <div className="max-w-5xl mx-auto px-5 pt-8 pb-2">
          {/* Copy left, dashboard teaser right on desktop. Explicit placement so
              a phone stacks it copy → teaser → button: see what you get, then
              start. The teaser is markup, not a screenshot — see the component. */}
          {/* rows [auto 1fr]: without it the row-spanning teaser hands half its
              height to row 1 and the button drifts far below the copy. */}
          <div className="grid gap-x-10 gap-y-6 lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:items-start">
            <div className="lg:col-start-1 lg:row-start-1">
              <h1 className="text-2xl md:text-3xl font-bold text-mf-plum mb-2 leading-tight">Team Mental Fitness Assessment</h1>
              <p className="mf-serif text-[19px] md:text-[21px] leading-snug text-mf-plum/70 mb-4">
                It&rsquo;s like getting a physical for your team&rsquo;s mental fitness.
              </p>
              <p className="text-sm text-mf-ink-2 leading-relaxed">
                Start with your own two-minute read on your team — then let their anonymous responses show you where you&rsquo;re right, where you&rsquo;re off, and what the gap is costing you.
              </p>
            </div>

            <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 w-full max-w-sm mx-auto">
              <JourneyDashboardTeaser />
            </div>

            <div className="lg:col-start-1 lg:row-start-2 text-center lg:text-left">
              <button
                onClick={scrollToStart}
                className="inline-flex items-center gap-2 bg-mf-plum hover:bg-[#3a1830] text-white font-semibold text-sm px-6 py-3 rounded-full shadow-sm transition-colors"
              >
                Start your Journey ↓
              </button>
            </div>
          </div>
        </div>
      )}

      <div ref={startRef} className="scroll-mt-4 pt-8 pb-8">
        {/* The stage diagram sits in its own wider column so the four steps
            never crowd; the questions stay in the narrow reading column. */}
        {step < 6 && (
          <div className="max-w-2xl mx-auto px-5">
            <JourneyProcessStrip activeStep={activeJourneyStep} />
          </div>
        )}
        {/* The results screen runs two columns on desktop — scores and numbers in
            the main column, the team-survey CTA in a sidebar — so it needs more
            room than the question column. */}
        <div className={`mx-auto px-5 ${step === 6 ? 'max-w-5xl' : 'max-w-lg'}`}>
        {step < 6 && (
          <>
            <JourneyProgressBar step={step} total={5} />
            <p className="text-xs uppercase tracking-widest text-mf-ink-3 mt-2 mb-6">about 3 minutes</p>
            <h1 className="text-2xl font-bold text-mf-plum mb-4">{PART_HEADERS[step]}</h1>
          </>
        )}
        {step < 4 ? (
          <>
            <QuickQuestionCard label={QUESTIONS[step].label} question={QUESTIONS[step].text} options={OPTIONS}
              selectedValue={answers[QUESTIONS[step].key]} onSelect={(i) => handleQuickAnswer(QUESTIONS[step].key, i)} />
            {step === 0 && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 mt-4 text-center flex-wrap">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Anonymous team responses · you see team-level results only · questions? <a href="mailto:admin@skillfulmeans.life" className="text-mf-plum font-medium underline">admin@skillfulmeans.life</a></span>
              </div>
            )}
          </>
        ) : step === 4 ? (
          <CompanyInfoForm values={company} onChange={setCompany} onSubmit={() => setStep(5)} />
        ) : step === 5 ? (
          <EmailGate formData={{ industry: company.industry, headcount: company.headcount, avg_salary: company.avgSalary, turnover_rate: company.turnoverRate, quick_answers: answers, ref }}
            onSubmit={(data) => { setResultsData(data); setStep(6); }} />
        ) : resultsData ? (
          <>
            {/* The results screen is a destination in its own right — it has its
                own private link and people come back to it — so it opens with a
                title and a line about what it is, not cold on a score card. */}
            <div className="mb-6">
              <p className="mf-eyebrow mb-2">Your results</p>
              <h1 className="text-2xl md:text-3xl font-bold text-mf-plum mb-2 leading-tight">
                Your Team&rsquo;s Mental Fitness Dashboard
              </h1>
              <p className="text-sm text-mf-ink-2 leading-relaxed max-w-2xl">
                Your team&rsquo;s mental fitness in one place — how each domain scores against published
                research norms, what the gap is likely costing you, and what a program would return.
                Every number here is built from your own read on your team; invite them to the free
                anonymous survey and it all re-runs on their answers.
              </p>
            </div>
            {resultsData.email_sent ? (
              <div className="bg-[#fce7f3] rounded-xl p-3 mb-4 text-center">
                <p className="text-xs text-mf-plum font-medium">We've emailed you a private link so you can return any time.</p>
              </div>
            ) : (
              <div className="bg-amber-50 rounded-xl p-3 mb-4 text-center">
                <p className="text-xs text-mf-ink-2 font-medium">Save this page's link to return any time:</p>
                <p className="text-xs text-mf-plum font-mono mt-1 break-all">{window.location.origin}/FitnessRoi/dashboard?k={resultsData.magic_key}</p>
              </div>
            )}
            <ResultsView data={resultsData} />
          </>
        ) : null}
        {step > 0 && step < 6 && (
          <button onClick={() => setStep(s => s - 1)} className="mt-4 flex items-center gap-1 text-sm text-mf-ink-3 hover:text-mf-ink-2 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        )}
        </div>
      </div>
    </div>
  );
}