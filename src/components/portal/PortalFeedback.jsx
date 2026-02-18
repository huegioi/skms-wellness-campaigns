import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Loader2, ClipboardList, Link, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { productCatalog } from '@/components/curriculum/catalogData';

export default function PortalFeedback({ client, proposals = [] }) {
  const [selectedSurveyId, setSelectedSurveyId] = useState('');
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Extract purchased service names from ALL proposals (workshops + challenges)
  const purchasedServiceNames = getPurchasedServiceNames(proposals);

  // Build shareable feedback URL for this client
  const feedbackUrl = `${window.location.origin}/FeedbackForm?clientId=${client?.id || ''}&company=${encodeURIComponent(client?.company || '')}`;

  const copyFeedbackLink = () => {
    navigator.clipboard.writeText(feedbackUrl);
    setLinkCopied(true);
    toast.success('Feedback link copied! Share with your team members.');
    setTimeout(() => setLinkCopied(false), 2500);
  };

  // Load active surveys
  const { data: allSurveys = [], isLoading: surveysLoading } = useQuery({
    queryKey: ['feedback-surveys-portal'],
    queryFn: () => base44.entities.FeedbackSurvey.filter({ is_active: true })
  });

  // Filter surveys: show only those matching purchased workshops/challenges
  // If no purchased services found, show all surveys
  const availableSurveys = purchasedServiceNames.length === 0
    ? allSurveys
    : allSurveys.filter(s =>
        purchasedServiceNames.some(name =>
          s.service_name.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(s.service_name.toLowerCase())
        )
      );

  const selectedSurvey = availableSurveys.find(s => s.id === selectedSurveyId);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const ratingAnswers = (selectedSurvey?.questions || [])
        .filter(q => q.type === 'rating_5' || q.type === 'rating_10')
        .map(q => parseFloat(answers[q.id] || 0))
        .filter(v => v > 0);

      const overallRating = ratingAnswers.length > 0
        ? ratingAnswers.reduce((a, b) => a + b, 0) / ratingAnswers.length
        : null;

      const npsQ = (selectedSurvey?.questions || []).find(q => q.type === 'rating_10');
      const npsScore = npsQ ? parseFloat(answers[npsQ.id] || 0) : null;

      const raffleQ = (selectedSurvey?.questions || []).find(q => q.type === 'raffle_address');
      const raffleAddress = raffleQ ? answers[raffleQ.id] || '' : '';

      const answersArray = (selectedSurvey?.questions || []).map(q => ({
        question_id: q.id,
        question_text: q.text,
        value: answers[q.id] || ''
      }));

      return base44.entities.FeedbackResponse.create({
        survey_id: selectedSurveyId,
        service_name: selectedSurvey?.service_name,
        full_name: client?.name || '',
        company_name: client?.company || '',
        email_address: client?.email || '',
        client_id: client?.id || '',
        submitted_at: new Date().toISOString(),
        answers: answersArray,
        raffle_address: raffleAddress,
        nps_score: npsScore,
        overall_rating: overallRating
      });
    },
    onSuccess: () => setSubmitted(true),
    onError: (err) => toast.error('Submission failed: ' + err.message)
  });

  const setAnswer = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  if (submitted) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-10 text-center">
        <CheckCircle2 className="w-16 h-16 mx-auto mb-4" style={{ color: '#264d44' }} />
        <h2 className="text-2xl font-bold mb-2" style={{ color: '#013f7c' }}>Thank You!</h2>
        <p className="text-gray-600">Your feedback has been submitted. We truly appreciate your time!</p>
        <Button className="mt-6" variant="outline" onClick={() => { setSubmitted(false); setSelectedSurveyId(''); setAnswers({}); }}>
          Submit Another Response
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-2">
          <ClipboardList className="w-6 h-6" style={{ color: '#013f7c' }} />
          <h2 className="text-xl font-bold" style={{ color: '#013f7c' }}>Workshop Feedback</h2>
        </div>
        <p className="text-gray-500 text-sm">Share your experience to help us improve our programs.</p>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
        {/* Pre-filled company info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Name</p>
            <p className="text-gray-800 font-semibold">{client?.name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Company</p>
            <p className="text-gray-800 font-semibold">{client?.company || '—'}</p>
          </div>
        </div>

        {/* Workshop selector */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Which workshop are you providing feedback for? *</label>
          {surveysLoading ? (
            <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
          ) : availableSurveys.length === 0 ? (
            <p className="text-gray-500 text-sm italic">No feedback surveys are currently available for your purchased services.</p>
          ) : (
            <Select value={selectedSurveyId} onValueChange={setSelectedSurveyId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a workshop..." />
              </SelectTrigger>
              <SelectContent>
                {availableSurveys.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.service_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Dynamic Questions */}
        {selectedSurvey && (selectedSurvey.questions || []).map(question => (
          <QuestionField
            key={question.id}
            question={question}
            value={answers[question.id] || ''}
            onChange={(val) => setAnswer(question.id, val)}
          />
        ))}

        {selectedSurvey && (
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            className="w-full text-white font-semibold py-3"
            style={{ backgroundColor: '#013f7c' }}
          >
            {submitMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : 'Submit Feedback'}
          </Button>
        )}
      </div>
    </div>
  );
}

function getPurchasedServiceNames(proposal) {
  if (!proposal?.selections) return [];
  const names = [];
  const sel = proposal.selections;

  // Extract names from various selection structures
  const extractFromArray = (arr) => {
    if (!Array.isArray(arr)) return;
    arr.forEach(item => {
      if (typeof item === 'string') names.push(item);
      else if (item?.name) names.push(item.name);
      else if (item?.service_name) names.push(item.service_name);
    });
  };

  extractFromArray(sel.workshops);
  extractFromArray(sel.challengePrograms);
  extractFromArray(sel.leadership);
  extractFromArray(sel.movementClasses);

  // Also check for objects with service names as keys
  Object.values(sel).forEach(val => {
    if (Array.isArray(val)) extractFromArray(val);
  });

  return [...new Set(names)];
}

function QuestionField({ question, value, onChange }) {
  if (question.type === 'rating_5') {
    return (
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">{question.text}</label>
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} type="button" onClick={() => onChange(String(n))}
              className={`w-10 h-10 rounded-full font-bold text-sm transition-all border-2 ${value === String(n) ? 'bg-[#264d44] text-white border-[#264d44]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#264d44]'}`}>
              {n}
            </button>
          ))}
          <span className="self-center text-xs text-gray-400 ml-2">1 = Low, 5 = High</span>
        </div>
      </div>
    );
  }

  if (question.type === 'rating_10') {
    return (
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">{question.text}</label>
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
            <button key={n} type="button" onClick={() => onChange(String(n))}
              className={`w-9 h-9 rounded-lg font-bold text-sm transition-all border-2 ${value === String(n) ? 'bg-[#013f7c] text-white border-[#013f7c]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#013f7c]'}`}>
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1"><span>Not likely</span><span>Very likely</span></div>
      </div>
    );
  }

  if (question.type === 'boolean') {
    return (
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">{question.text}</label>
        <div className="flex gap-3">
          {['Yes', 'No'].map(opt => (
            <button key={opt} type="button" onClick={() => onChange(opt)}
              className={`px-6 py-2 rounded-lg font-semibold text-sm border-2 transition-all ${value === opt ? 'bg-[#264d44] text-white border-[#264d44]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#264d44]'}`}>
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (question.type === 'long_text') {
    return (
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">{question.text}</label>
        <Textarea value={value} onChange={e => onChange(e.target.value)} placeholder="Your response..." rows={3} />
      </div>
    );
  }

  if (question.type === 'raffle_address') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <label className="block text-sm font-semibold text-amber-800 mb-2">🎉 {question.text}</label>
        <Textarea value={value} onChange={e => onChange(e.target.value)} placeholder="Enter your full mailing address..." rows={2} />
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{question.text}</label>
      <Textarea value={value} onChange={e => onChange(e.target.value)} placeholder="Your response..." rows={2} />
    </div>
  );
}