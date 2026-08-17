import React, { useState, useRef } from 'react';
import { ChevronLeft, ShieldCheck } from 'lucide-react';
import JourneyProgressBar from '@/components/fitnessroi/JourneyProgressBar';
import JourneyProcessStrip from '@/components/fitnessroi/JourneyProcessStrip';
import QuickQuestionCard from '@/components/fitnessroi/QuickQuestionCard';
import CompanyInfoForm from '@/components/fitnessroi/CompanyInfoForm';
import EmailGate from '@/components/fitnessroi/EmailGate';
import ResultsView from '@/components/fitnessroi/ResultsView';

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
        <div className="max-w-2xl mx-auto px-5 pt-8 pb-2">
          <h1 className="text-2xl md:text-3xl font-bold text-mf-plum mb-3 leading-tight">The Mental Fitness Journey</h1>
          <p className="text-sm text-mf-ink-2 leading-relaxed mb-6">
            See your team's mental fitness the way the data sees it. Start with your own two-minute read on your team — then let their anonymous responses show you where you're right, where you're off, and what the gap is costing you.
          </p>
          <div className="text-center">
            <button
              onClick={scrollToStart}
              className="inline-flex items-center gap-2 bg-mf-plum hover:bg-[#3a1830] text-white font-semibold text-sm px-6 py-3 rounded-full shadow-sm transition-colors"
            >
              Start your Journey ↓
            </button>
          </div>
        </div>
      )}

      <div ref={startRef} className={`mx-auto px-5 py-8 ${step === 6 ? 'max-w-2xl' : 'max-w-lg'} scroll-mt-4`}>
        {step < 6 && (
          <>
            <JourneyProcessStrip activeStep={activeJourneyStep} />
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
  );
}