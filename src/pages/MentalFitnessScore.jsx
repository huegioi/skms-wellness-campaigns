import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { PortalShell } from '@/components/portal/PortalShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CheckCircle, Copy, Users, ArrowRight, Brain, AlertTriangle } from 'lucide-react';

const TEAM_SIZES = [
  { value: '1-50', label: '1–50' },
  { value: '51-200', label: '51–200' },
  { value: '201-500', label: '201–500' },
  { value: '501-1000', label: '501–1,000' },
  { value: '1001-5000', label: '1,001–5,000' },
  { value: '5000+', label: '5,000+' },
];

const GOALS = [
  'Burnout & stress',
  'Team connection',
  'Engagement',
  'Retention',
  'Leadership',
];

export default function MentalFitnessScore() {
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref');
  const [form, setForm] = useState({ company_name: '', contact_name: '', email: '', employee_count: '', industry: '' });
  const [goals, setGoals] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [emailError, setEmailError] = useState('');

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

  const formValid =
    form.company_name.trim() &&
    form.contact_name.trim() &&
    form.email.trim() &&
    !emailError &&
    form.employee_count;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('createMfsAssessment', {
        company_name: form.company_name.trim(),
        contact_name: form.contact_name.trim(),
        email: form.email.trim(),
        employee_count: form.employee_count,
        industry: form.industry.trim(),
        goals,
        ref,
      });
      setResult(res.data);
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

  const copyLink = (link) => {
    navigator.clipboard.writeText(link);
    toast.success('Link copied!');
  };

  // ── Confirmation screen ──
  if (result) {
    return (
      <PortalShell
        accentColor="#013f7c"
        title="The Mental Fitness Score"
        subtitle="Your assessment is ready to share"
        maxWidth="max-w-2xl"
      >
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-10">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5 bg-green-50">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 text-center mb-2">
            You're all set, {form.contact_name.split(' ')[0]}!
          </h2>
          <p className="text-gray-500 text-center text-sm mb-6">
            We've created your team's Mental Fitness Score assessment. Save these two links — we haven't emailed anything.
          </p>

          {/* Employee link card */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-sm text-gray-800">Send this to your employees</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">Each employee takes a 3-minute survey. Anonymous — no accounts needed.</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={result.employee_link}
                className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 font-mono truncate"
              />
              <Button size="sm" onClick={() => copyLink(result.employee_link)} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
                <Copy className="w-3.5 h-3.5" /> Copy
              </Button>
            </div>
          </div>

          {/* Dashboard link card */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-green-600" />
              <span className="font-semibold text-sm text-gray-800">Your live results dashboard</span>
              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Bookmark it</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">Results update in real-time as employees complete the survey.</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={result.dashboard_link}
                className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 font-mono truncate"
              />
              <Button size="sm" onClick={() => copyLink(result.dashboard_link)} className="bg-green-600 hover:bg-green-700 gap-1.5">
                <Copy className="w-3.5 h-3.5" /> Copy
              </Button>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
            <p className="text-xs text-amber-700 font-medium flex items-center justify-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              We've emailed nothing — save these links now. You won't be able to recover them if you lose this page.
            </p>
          </div>

          <div className="mt-6 text-center">
            <a href={result.dashboard_link} target="_blank" rel="noopener noreferrer" className="inline-block">
              <Button className="bg-[#013f7c] hover:bg-[#012d5a] gap-2">
                Open Results Dashboard <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
          </div>
        </div>
      </PortalShell>
    );
  }

  // ── Intake form ──
  return (
    <PortalShell
      accentColor="#013f7c"
      title="The Mental Fitness Score"
      subtitle="A free read on your team's mental fitness, in 3 minutes per employee."
      maxWidth="max-w-2xl"
    >
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-5">
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-sm text-blue-700">
            <strong>How it works:</strong> Share a 3-minute survey with your team. You'll see aggregated
            wellbeing scores, stress levels, and benchmark comparisons — all anonymous, all free.
          </p>
        </div>

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
            <label className="block text-sm font-medium text-gray-600 mb-1">Employee count *</label>
            <Select value={form.employee_count} onValueChange={v => setForm({ ...form, employee_count: v })}>
              <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
              <SelectContent>
                {TEAM_SIZES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Industry (optional)</label>
          <Input
            value={form.industry}
            onChange={e => setForm({ ...form, industry: e.target.value })}
            placeholder="Technology, Healthcare, Finance..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">
            What are you hoping to improve? <span className="text-gray-400 font-normal">(up to 3)</span>
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
                      ? 'bg-[#013f7c] text-white border-[#013f7c]'
                      : disabled
                        ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-[#013f7c] hover:text-[#013f7c]'
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
            disabled={!formValid || submitting}
            onClick={handleSubmit}
            className="bg-[#013f7c] hover:bg-[#012d5a] gap-2"
          >
            {submitting ? 'Creating...' : 'Get My Mental Fitness Score'}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </PortalShell>
  );
}