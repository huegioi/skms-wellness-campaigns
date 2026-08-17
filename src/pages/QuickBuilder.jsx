import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PortalShell } from '@/components/portal/PortalShell';
import { toast } from 'sonner';
import { Check, ArrowRight, ArrowLeft, CheckCircle, CalendarPlus, ExternalLink, Users, TrendingUp } from 'lucide-react';
import { PreventativeBand, EveryCampaignIncludes } from '@/components/quickbuilder/QuickBuilderIntro';
import TierCard from '@/components/quickbuilder/TierCard';
import QuoteBreakdown from '@/components/quickbuilder/QuoteBreakdown';
import ProgramGallery from '@/components/quickbuilder/ProgramGallery';
import {
  PUBLIC_STAGES,
  computeQuote,
  formatStageLabel,
  headcountToBand,
  sessionsPerWorkshop,
  ROI_CALCULATOR_URL,
  RATE_CARD,
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

  // Pre-fill support — the Claims Insight profile links here with
  // ?headcount=&stage=&company= so the recommended campaign is one click
  // from a quote. Only public tiers can be pre-selected.
  const prefillStage = parseInt(searchParams.get('stage') || '', 10);
  const prefillStageValid = PUBLIC_STAGES().some(s => s.stage === prefillStage);

  const [step, setStep] = useState(1);
  const topRef = useRef(null);
  const [form, setForm] = useState({
    company_name: searchParams.get('company') || '',
    contact_name: '',
    email: '',
    headcount: searchParams.get('headcount') || '',
  });
  const [goals, setGoals] = useState([]);
  const [selectedStage, setSelectedStage] = useState(prefillStageValid ? prefillStage : null);
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
  const sectionsPerWorkshop = headcount ? sessionsPerWorkshop(headcount) : 1;

  const currentIndex = STEPS.findIndex(s => s.num === step);
  const goNext = () => setStep(s => Math.min(4, s + 1));
  const goPrev = () => setStep(s => Math.max(1, s - 1));

  // Each step is a different page as far as the reader is concerned, but the
  // browser keeps the old scroll offset — so clicking Next at the bottom of a
  // long step dropped you into the middle of the next one (typically landing
  // on "Why campaigns work"). scrollIntoView rather than window.scrollTo
  // because PortalShell's tabbed layout scrolls an inner div, not the window.
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step]);

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

  /**
   * Sends the inquiry and moves on to the quote.
   *
   * The submit used to sit on the quote page, which meant the quote was only
   * ever seen by people who had already committed. It now fires from the
   * gallery step: they send their details, and the quote is what they get
   * back. Re-entering step 3 with the Back button won't send twice.
   */
  const handleSubmitAndContinue = async () => {
    if (submitted) { goNext(); return; }
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
      goNext();
    } catch (err) {
      // A 429 means this inquiry is already with us — no reason to make them
      // wait for a quote they've earned. Anything else, keep them here so the
      // details aren't lost and they can try again.
      if (err?.response?.status === 429) {
        setSubmitted(true);
        goNext();
      } else {
        toast.error("Something went wrong sending that. Please try again.");
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
      {/* Scroll anchor — see the step effect above */}
      <div ref={topRef} className="scroll-mt-4" />

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
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-7 space-y-4">
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

          {/* Deciding between tiers is exactly where the return matters, so
              offer the ROI calculator here as well as on the final quote. */}
          <a
            href={ROI_CALCULATOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-xl border border-brand-plum/25 bg-brand-plum/[0.04] hover:bg-brand-plum/[0.08] transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-brand-plum/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-brand-plum" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-800">Not sure which tier is worth it?</p>
              <p className="text-xs text-gray-500">
                Our ROI calculator projects the 3-year return for a company your size
              </p>
            </div>
            <ExternalLink className="w-4 h-4 text-brand-plum flex-shrink-0" />
          </a>

          {/* A company needing more than one section is buying more delivery,
              not paying a size surcharge. Say so before they see the price. */}
          {sectionsPerWorkshop > 1 && (
            <div className="rounded-xl border border-brand-navy/20 bg-brand-navy/[0.04] p-4">
              <p className="text-sm font-semibold text-brand-navy">
                At {headcount.toLocaleString()} employees, every workshop runs {sectionsPerWorkshop} times
              </p>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                We cap sessions so they stay interactive, and we schedule each topic {sectionsPerWorkshop} times
                across different days and hours so shift workers and busy teams can all attend. The prices below
                cover all {sectionsPerWorkshop} sittings of each workshop, plus wellness boxes for every one of
                them. Repeat sittings cost less — the recording and printed materials are produced once.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PUBLIC_STAGES().map(stage => (
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

          <p className="text-xs text-gray-500 leading-relaxed px-1">
            Running something larger — a multi-year programme, coaching cascaded through every
            layer, or a dedicated consultant? We build those too. Mention it when you get in touch
            and we'll shape one around you.
          </p>

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

      {/* "Why campaigns work" is gone from the builder entirely — by the time
          someone is filling this in they have already decided to look, and the
          case for campaigns is made on the pages that bring them here.

          The includes strip earns its place while they are choosing (steps 2
          and 3) but not on the quote, where the breakdown already itemises
          exactly what they are getting. */}
      {step > 1 && step < 4 && <EveryCampaignIncludes />}
    </PortalShell>
  );
}