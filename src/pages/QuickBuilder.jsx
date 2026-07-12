import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PortalShell } from '@/components/portal/PortalShell';
import { toast } from 'sonner';
import { Award, Dumbbell, Activity, Crown, Package, Check, ArrowRight, ArrowLeft, CheckCircle, CalendarPlus, ExternalLink } from 'lucide-react';
import { PreventativeBand, QuickBuilderEducation } from '@/components/quickbuilder/QuickBuilderIntro';
import ReviewEstimateCard from '@/components/quickbuilder/ReviewEstimateCard';
import { computeEstimate, teamSizeToHeadcount } from '@/components/quickbuilder/stagePricing';
import QuickBuilderCategoryStep from '@/components/quickbuilder/QuickBuilderCategoryStep';
import QuickBuilderWellnessBoxStep from '@/components/quickbuilder/QuickBuilderWellnessBoxStep';
import ServiceImage from '@/components/quickbuilder/ServiceImage';

const CALENDLY_LINK = 'https://calendly.com/skillfulmeans/skms-corporate-wellness-offerings-2';

const TEAM_SIZES = [
  { value: '1-50', label: '1–50' },
  { value: '51-200', label: '51–200' },
  { value: '201-500', label: '201–500' },
  { value: '501-1000', label: '501–1,000' },
  { value: '1001-5000', label: '1,001–5,000' },
  { value: '5000+', label: '5,000+' },
];

const GOALS = [
  'Reduce burnout & stress',
  'Team connection',
  'Leadership EQ',
  'Healthy habits',
  'Retention & culture',
];

const CATEGORY_CONFIG = {
  workshop: { label: 'Workshops', icon: Award },
  challenge: { label: '14-Day Challenges', icon: Dumbbell },
  class: { label: 'Classes', icon: Activity },
  leadership: { label: 'Leadership', icon: Crown },
  wellness_box: { label: 'Wellness Boxes', icon: Package },
};

export default function QuickBuilder() {
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref');
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ company_name: '', contact_name: '', email: '', team_size: '' });
  const [goals, setGoals] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [wantsWellnessBoxes, setWantsWellnessBoxes] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['quickBuilderServices'],
    queryFn: () => base44.entities.Service.list('sort_order'),
  });

  const publicServices = services.filter(s => s.is_active !== false && s.public_visible !== false);

  const visibleSteps = useMemo(() => {
    const allSteps = [
      { num: 1, label: 'About your team' },
      { num: 2, label: 'Workshops', cat: 'workshop' },
      { num: 3, label: '14-Day Challenges', cat: 'challenge' },
      { num: 4, label: 'Leadership', cat: 'leadership' },
      { num: 5, label: 'Wellness Boxes' },
      { num: 6, label: 'Review & submit' },
    ];
    if (isLoading) return allSteps;
    return allSteps.filter(s => !s.cat || publicServices.some(svc => svc.category === s.cat));
  }, [publicServices, isLoading]);

  const currentVisibleIndex = visibleSteps.findIndex(s => s.num === step);
  const totalVisibleSteps = visibleSteps.length;

  const goNextStep = () => {
    const next = visibleSteps[currentVisibleIndex + 1];
    if (next) setStep(next.num);
  };
  const goPrevStep = () => {
    const prev = visibleSteps[currentVisibleIndex - 1];
    if (prev) setStep(prev.num);
  };

  const toggleGoal = (goal) => {
    setGoals(prev =>
      prev.includes(goal)
        ? prev.filter(g => g !== goal)
        : prev.length < 3 ? [...prev, goal] : prev
    );
  };

  const toggleService = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const validateEmail = (val) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (val && !regex.test(val)) {
      setEmailError('Please enter a valid work email address.');
    } else {
      setEmailError('');
    }
  };

  const step1Valid =
    form.company_name.trim() &&
    form.contact_name.trim() &&
    form.email.trim() &&
    !emailError &&
    form.team_size;

  const selectedServices = publicServices.filter(s => selectedIds.has(s.id));
  const hasWorkshop = selectedServices.some(s => s.category === 'workshop');
  const hasChallenge = selectedServices.some(s => s.category === 'challenge');
  const hasBox = wantsWellnessBoxes === true;
  const isFullCampaign = hasWorkshop && hasChallenge && hasBox;

  const estimate = useMemo(() => {
    if (!form.team_size) return null;
    return computeEstimate({
      headcount: teamSizeToHeadcount(form.team_size),
      workshopCount: selectedServices.filter(s => s.category === 'workshop').length,
      challengeCount: selectedServices.filter(s => s.category === 'challenge').length,
      hasLeadership: selectedServices.some(s => s.category === 'leadership'),
      wantsBoxes: wantsWellnessBoxes === true,
    });
  }, [form.team_size, selectedServices, wantsWellnessBoxes]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await base44.functions.invoke('submitQuickBuilderInquiry', {
        company_name: form.company_name.trim(),
        contact_name: form.contact_name.trim(),
        email: form.email.trim(),
        team_size: form.team_size,
        goals,
        selected_service_ids: Array.from(selectedIds),
        wants_wellness_boxes: wantsWellnessBoxes === true,
        ref,
        estimated_investment: estimate?.estimatedInvestment,
        matched_stage: estimate?.stageLabel,
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
        subtitle="Design your wellness campaign in minutes"
        maxWidth="max-w-2xl"
      >
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 bg-brand-green/10">
            <CheckCircle className="w-9 h-9 text-brand-green" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Thank you!</h2>
          <p className="text-gray-500 leading-relaxed max-w-md mx-auto">
            Your campaign selections have been received. Our team will review and send a tailored proposal
            with pricing within 2 business days.
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
      subtitle="Design your wellness campaign in minutes"
      maxWidth="max-w-4xl"
    >
      {/* Step indicator — mobile */}
      <div className="sm:hidden mb-6 flex items-center justify-between">
        <span className="text-sm font-bold text-brand-navy">Step {currentVisibleIndex + 1} of {totalVisibleSteps}</span>
        <span className="text-sm text-gray-500">{visibleSteps[currentVisibleIndex]?.label}</span>
      </div>

      {/* Step indicator — desktop */}
      <div className="hidden sm:flex items-center gap-2 mb-6">
        {visibleSteps.map((s, idx) => {
          const isActive = step === s.num;
          const isComplete = currentVisibleIndex > idx;
          return (
            <React.Fragment key={s.num}>
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    isActive || isComplete
                      ? 'bg-brand-navy text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isComplete ? <Check className="w-4 h-4" /> : idx + 1}
                </div>
                <span className={`text-sm font-medium ${isActive ? 'text-brand-navy' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
              {idx < visibleSteps.length - 1 && (
                <div className={`flex-1 h-px mx-2 ${currentVisibleIndex > idx ? 'bg-brand-navy' : 'bg-gray-200'}`} />
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
              <label className="block text-sm font-medium text-gray-600 mb-1">Team size *</label>
              <Select value={form.team_size} onValueChange={v => setForm({ ...form, team_size: v })}>
                <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                <SelectContent>
                  {TEAM_SIZES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Goals <span className="text-gray-400 font-normal">(up to 3)</span>
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
            <Button
              disabled={!step1Valid}
              onClick={goNextStep}
              className="bg-brand-navy hover:bg-brand-navy-dark gap-2"
            >
              Next <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Workshops ── */}
      {step === 2 && (
        <QuickBuilderCategoryStep
          title="Workshops"
          subtitle="Tap to select. Optional — pick what interests you."
          services={publicServices.filter(s => s.category === 'workshop')}
          selectedIds={selectedIds}
          onToggle={toggleService}
          onBack={goPrevStep}
          onNext={goNextStep}
          isLoading={isLoading}
        />
      )}

      {/* ── Step 3: 14-Day Challenges ── */}
      {step === 3 && (
        <QuickBuilderCategoryStep
          title="14-Day Challenges"
          subtitle="Tap to select. Optional — pick what interests you."
          services={publicServices.filter(s => s.category === 'challenge')}
          selectedIds={selectedIds}
          onToggle={toggleService}
          onBack={goPrevStep}
          onNext={goNextStep}
          isLoading={isLoading}
        />
      )}

      {/* ── Step 4: Leadership ── */}
      {step === 4 && (
        <QuickBuilderCategoryStep
          title="Leadership"
          subtitle="Tap to select. Optional — pick what interests you."
          services={publicServices.filter(s => s.category === 'leadership')}
          selectedIds={selectedIds}
          onToggle={toggleService}
          onBack={goPrevStep}
          onNext={goNextStep}
          isLoading={isLoading}
        />
      )}

      {/* ── Step 5: Wellness Boxes ── */}
      {step === 5 && (
        <QuickBuilderWellnessBoxStep
          value={wantsWellnessBoxes}
          onChange={setWantsWellnessBoxes}
          onBack={goPrevStep}
          onNext={goNextStep}
        />
      )}

      {/* ── Step 6: Review & submit ── */}
      {step === 6 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-5">
          <h2 className="text-lg font-bold text-gray-800">Review your selections</h2>
          <div className="space-y-2">
            {selectedServices.map(svc => (
              <div key={svc.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                {svc.images?.[0]?.url ? (
                  <ServiceImage src={svc.images[0].url} alt="" className="w-12 h-12 rounded-lg flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-brand-navy/10 flex items-center justify-center flex-shrink-0">
                    {(() => {
                      const Icon = CATEGORY_CONFIG[svc.category]?.icon || Package;
                      return <Icon className="w-5 h-5 text-brand-navy" />;
                    })()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-800">{svc.name}</p>
                  <p className="text-xs text-gray-400">{CATEGORY_CONFIG[svc.category]?.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Wellness box incentives row */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">Wellness box incentives</span>
            <span className={`text-sm font-semibold ${hasBox ? 'text-green-600' : 'text-gray-400'}`}>
              {hasBox ? 'Yes' : 'No'}
            </span>
          </div>

          {/* Campaign pillars nudge */}
          <div className="bg-brand-cream rounded-xl p-4">
            <div className="flex items-center gap-4 justify-center flex-wrap">
              {[
                { label: 'Workshop', covered: hasWorkshop },
                { label: 'Challenge', covered: hasChallenge },
                { label: 'Wellness boxes', covered: hasBox },
              ].map(p => (
                <div key={p.label} className="flex items-center gap-1.5">
                  {p.covered ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                  )}
                  <span className={`text-sm font-medium ${p.covered ? 'text-gray-800' : 'text-gray-400'}`}>{p.label}</span>
                </div>
              ))}
            </div>
            {!isFullCampaign && (
              <p className="text-xs text-gray-500 text-center mt-3">
                A full campaign (workshop + challenge + wellness boxes) reinforces learning and builds lasting habits.
              </p>
            )}
          </div>

          {estimate && <ReviewEstimateCard estimate={estimate} />}

          <p className="text-sm text-gray-500 text-center">
            We'll send a tailored proposal with pricing within 2 business days.
          </p>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={goPrevStep} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <Button
              disabled={submitting}
              onClick={handleSubmit}
              className="bg-brand-plum hover:bg-brand-plum-dark gap-2"
            >
              {submitting ? 'Submitting...' : 'Submit Inquiry'}
            </Button>
          </div>
        </div>
      )}

      <QuickBuilderEducation />
    </PortalShell>
  );
}