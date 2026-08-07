import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PortalShell } from '@/components/portal/PortalShell';
import { toast } from 'sonner';
import { Check, ArrowRight, ArrowLeft, CheckCircle, CalendarPlus, ExternalLink, Users } from 'lucide-react';
import { PreventativeBand, QuickBuilderEducation } from '@/components/quickbuilder/QuickBuilderIntro';
import TierCard from '@/components/quickbuilder/TierCard';
import QuoteBreakdown from '@/components/quickbuilder/QuoteBreakdown';
import ProgramGallery from '@/components/quickbuilder/ProgramGallery';
import {
  CAMPAIGN_STAGES,
  computeQuote,
  formatStageLabel,
  headcountToBand,
} from '@/lib/rateCard';

const CALENDLY_LINK = 'https://calendly.com/d/cksd-9yr-nfc/skillfulmeans-strategy-session';

const GOALS = [
  'Reduce burnout & stress',
  'Team connection',
  'Leadership EQ',
  'Healthy habits',
  'Retention & culture',
];

const STEPS = [
  { num: 1, label: 'About your team' },
  { num: 2, label: 'Pick your tier' },
  { num: 3, label: "What's included" },
  { num: 4, label: 'Your quote' },
];

const RECOMMENDED_STAGE = 2;

export default function QuickBuilder() {
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref');

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ company_name: '', contact_name: '', email: '', headcount: '' });
  const [goals, setGoals] = useState([]);
  const [selectedStage, setSelectedStage] = useState(null);
  const [isNewClient, setIsNewClient] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['quickBuilderServices'],
    queryFn: () => base44.entities.Service.list('sort_order'),
  });

  const publicServices = useMemo(
    () => services.filter(s => s.is_active !== false && s.public_visible !== false),
    [services]
  );

  const headcount = parseInt(String(form.headcount).replace(/[^\d]/g, ''), 10) || 0;

  const currentIndex = STEPS.findIndex(s => s.num === step);
  const goNext = () => setStep(s => Math.min(4, s + 1));
  const goPrev = () => setStep(s => Math.max(1, s - 1));

  const toggleGoal = (goal) => {
    setGoals(prev =>
      prev.includes(goal)
        ? prev.filter(g => g !== goal)
        : prev.length < 3 ? [...prev, goal] : prev
    );
  };

  const validateEmail = (val) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setEmailError(val && !regex.test(val) ? 'Please enter a valid work email address.' : '');
  };

  const toggleNewClient = () => setIsNewClient(v => !v);

  const step1Valid =
    form.company_name.trim() &&
    form.contact_name.trim() &&
    form.email.trim() &&
    !emailError &&
    headcount > 0;

  const quote = useMemo(() => {
    if (!headcount || !selectedStage) return null;
    return computeQuote({ headcount, stage: selectedStage, isNewClient });
  }, [headcount, selectedStage, isNewClient]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await base44.functions.invoke('submitQuickBuilderInquiry', {
        company_name: form.company_name.trim(),
        contact_name: form.contact_name.trim(),
        email: form.email.trim(),
        team_size: String(headcount),
        headcount,
        company_size_band: headcountToBand(headcount),
        goals,
        selected_service_ids: [],
        wants_wellness_boxes: true,
        selected_tier: quote ? formatStageLabel(quote.tier) : undefined,
        is_new_client: isNewClient,
        discount_applied: quote?.discountTotal || 0,
        ref,
        estimated_investment: quote?.total,
        matched_stage: quote ? formatStageLabel(quote.tier) : undefined,
      });
      setSubmitted(true);
    } catch (err) {
      if (err?.response?.status === 429) {
        toast.error("You've already submitted recently. Please try again later.");
      } else {
        toast.error('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ──
  if (submitted) {
    return (
      <PortalShell
        accentColor="#013f7c"
        title="Quick Builder"
        subtitle="Build your wellness campaign in minutes"
        maxWidth="max-w-2xl"
      >
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 bg-brand-green/10">
            <CheckCircle className="w-9 h-9 text-brand-green" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Thank you!</h2>
          <p className="text-gray-500 leading-relaxed max-w-md mx-auto">
            We've got your {quote?.tier?.name} estimate of ${quote?.total?.toLocaleString()}. Our team will review and
            send a tailored proposal within 2 business days.
          </p>
          <div className="mt-8">
            <p className="text-sm font-semibold text-gray-700 mb-3">Want to talk sooner?</p>
            <a href={CALENDLY_LINK} target="_blank" rel="noopener noreferrer" className="inline-block">
              <Button size="lg" className="bg-brand-plum gap-2">
                <CalendarPlus className="w-5 h-5" />
                Book a Discovery Call
                <ExternalLink className="w-4 h-4 ml-1" />
              </Button>
            </a>
          </div>
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell
      accentColor="#013f7c"
      title="Quick Builder"
      subtitle="Build your wellness campaign in minutes"
      maxWidth="max-w-4xl"
    >
      {/* Step indicator — mobile */}
      <div className="sm:hidden mb-6 flex items-center justify-between">
        <span className="text-sm font-bold text-brand-navy">Step {currentIndex + 1} of {STEPS.length}</span>
        <span className="text-sm text-gray-500">{STEPS[currentIndex]?.label}</span>
      </div>

      {/* Step indicator — desktop */}
      <div className="hidden sm:flex items-center gap-2 mb-6">
        {STEPS.map((s, idx) => {
          const isActive = step === s.num;
          const isComplete = currentIndex > idx;
          return (
            <React.Fragment key={s.num}>
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    isActive || isComplete ? 'bg-brand-navy text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isComplete ? <Check className="w-4 h-4" /> : idx + 1}
                </div>
                <span className={`text-sm font-medium ${isActive ? 'text-brand-navy' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-2 ${currentIndex > idx ? 'bg-brand-navy' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {step === 1 && <PreventativeBand />}

      {/* ── Step 1: About your team ── */}
      {step === 1 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-5">
          <h2 className="text-lg font-bold text-gray-800">About your team</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Company name *</label>
              <Input
                value={form.company_name}
                onChange={e => setForm({ ...form, company_name: e.target.value })}
                placeholder="Acme Corp"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Your name *</label>
              <Input
                value={form.contact_name}
                onChange={e => setForm({ ...form, contact_name: e.target.value })}
                placeholder="Jane Smith"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Work email *</label>
              <Input
                type="email"
                value={form.email}
                onChange={e => {
                  setForm({ ...form, email: e.target.value });
                  validateEmail(e.target.value);
                }}
                placeholder="jane@acme.com"
              />
              {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Exactly how many employees? *
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <Input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  className="pl-9"
                  value={form.headcount}
                  onChange={e => setForm({ ...form, headcount: e.target.value })}
                  placeholder="e.g. 250"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Your exact number — every price on the next step is calculated from it.
              </p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Goals <span className="text-gray-400 font-normal">(up to 3, optional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {GOALS.map(goal => {
                const selected = goals.includes(goal);
                const disabled = !selected && goals.length >= 3;
                return (
                  <button
                    key={goal}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleGoal(goal)}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                      selected
                        ? 'bg-brand-navy text-white border-brand-navy'
                        : disabled
                          ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-brand-navy hover:text-brand-navy'
                    }`}
                  >
                    {goal}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button disabled={!step1Valid} onClick={goNext} className="bg-brand-navy hover:bg-brand-navy-dark gap-2">
              Next <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Pick your tier ── */}
      {step === 2 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Pick your tier</h2>
            <p className="text-sm text-gray-500 mt-1">
              Priced for your {headcount.toLocaleString()} employees. Each tier builds on the one before it.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CAMPAIGN_STAGES.map(stage => (
              <TierCard
                key={stage.stage}
                stage={stage}
                headcount={headcount}
                selected={selectedStage === stage.stage}
                onSelect={setSelectedStage}
                recommended={stage.stage === RECOMMENDED_STAGE}
              />
            ))}
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={goPrev} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <Button
              disabled={!selectedStage}
              onClick={goNext}
              className="bg-brand-navy hover:bg-brand-navy-dark gap-2"
            >
              Next <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: What's included (browse only) ── */}
      {step === 3 && (
        <ProgramGallery
          services={publicServices}
          isLoading={isLoading}
          onBack={goPrev}
          onNext={goNext}
        />
      )}

      {/* ── Step 4: Your quote ── */}
      {step === 4 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Your quote</h2>
            <p className="text-sm text-gray-500 mt-1">
              {form.company_name} · {headcount.toLocaleString()} employees
            </p>
          </div>

          <QuoteBreakdown
            quote={quote}
            isNewClient={isNewClient}
            onToggleNew={toggleNewClient}
          />

          <p className="text-sm text-gray-500 text-center">
            Send this over and we'll come back with a tailored proposal within 2 business days.
          </p>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={goPrev} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <Button
              disabled={submitting || !quote}
              onClick={handleSubmit}
              className="bg-brand-plum hover:bg-brand-plum-dark gap-2"
            >
              {submitting ? 'Submitting...' : 'Send my quote'}
            </Button>
          </div>
        </div>
      )}

      <QuickBuilderEducation />
    </PortalShell>
  );
}
