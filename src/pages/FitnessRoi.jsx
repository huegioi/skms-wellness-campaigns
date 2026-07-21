import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import JourneyProgressBar from '@/components/fitnessroi/JourneyProgressBar';
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
const PART_HEADERS = ['Your read on your team', 'Your read on your team', 'Your read on your team', 'Your read on your team', 'About your company', 'See your results'];

export default function FitnessRoi() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ wellbeing: null, stress: null, engagement: null, connection: null });
  const [company, setCompany] = useState({ headcount: '', avgSalary: 65000, turnoverRate: 0.18, industry: '' });
  const [ref] = useState(() => new URLSearchParams(window.location.search).get('ref') || '');
  const [resultsData, setResultsData] = useState(null);

  const handleQuickAnswer = (key, index) => {
    setAnswers(prev => ({ ...prev, [key]: index }));
    setTimeout(() => setStep(s => s + 1), 300);
  };

  return (
    <div className="min-h-screen bg-[#fdfbf7]" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
      <div className={`mx-auto px-5 py-8 ${step === 6 ? 'max-w-2xl' : 'max-w-lg'}`}>
        {step < 6 && (
          <>
            <JourneyProgressBar step={step} total={5} />
            <p className="text-xs uppercase tracking-widest text-stone-400 mt-2 mb-6">about 3 minutes</p>
            <h1 className="text-2xl font-bold text-[#4a2040] mb-4">{PART_HEADERS[step]}</h1>
          </>
        )}
        {step < 4 ? (
          <QuickQuestionCard label={QUESTIONS[step].label} question={QUESTIONS[step].text} options={OPTIONS}
            selectedValue={answers[QUESTIONS[step].key]} onSelect={(i) => handleQuickAnswer(QUESTIONS[step].key, i)} />
        ) : step === 4 ? (
          <CompanyInfoForm values={company} onChange={setCompany} onSubmit={() => setStep(5)} />
        ) : step === 5 ? (
          <EmailGate formData={{ industry: company.industry, headcount: company.headcount, avg_salary: company.avgSalary, turnover_rate: company.turnoverRate, quick_answers: answers, ref }}
            onSubmit={(data) => { setResultsData(data); setStep(6); }} />
        ) : resultsData ? (
          <>
            <div className="bg-[#fce7f3] rounded-xl p-3 mb-4 text-center">
              <p className="text-xs text-[#4a2040] font-medium">We've emailed you a private link so you can return any time.</p>
            </div>
            <ResultsView data={resultsData} />
          </>
        ) : null}
        {step > 0 && step < 6 && (
          <button onClick={() => setStep(s => s - 1)} className="mt-4 flex items-center gap-1 text-sm text-stone-400 hover:text-stone-600 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        )}
      </div>
    </div>
  );
}