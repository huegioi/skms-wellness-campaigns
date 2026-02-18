import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, Loader2, Star } from 'lucide-react';
import { toast } from 'sonner';

export default function FeedbackForm() {
  const urlParams = new URLSearchParams(window.location.search);
  const preselectedSurveyId = urlParams.get('survey_id');
  const prefilledCompany = urlParams.get('company') || '';
  const prefilledClientId = urlParams.get('clientId') || '';

  const [selectedSurveyId, setSelectedSurveyId] = useState(preselectedSurveyId || '');
  const [formData, setFormData] = useState({ full_name: '', company_name: prefilledCompany, email_address: '' });
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ['feedback-surveys'],
    queryFn: () => base44.entities.FeedbackSurvey.filter({ is_active: true })
  });

  const selectedSurvey = surveys.find(s => s.id === selectedSurveyId);

  const submitMutation = useMutation({
    mutationFn: async (data) => {
      // Calculate overall rating from rating questions
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
        full_name: formData.full_name,
        company_name: formData.company_name,
        email_address: formData.email_address,
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedSurveyId) return toast.error('Please select a workshop');
    if (!formData.email_address) return toast.error('Email is required');
    submitMutation.mutate();
  };

  const setAnswer = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4" style={{ color: '#264d44' }} />
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#013f7c' }}>Thank You!</h2>
          <p className="text-gray-600">Your feedback has been submitted successfully. We appreciate your time!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f0e9] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/abfb649ad_SkillfulMeansWebsiteHero.png"
            alt="SKMS Wellness"
            className="mx-auto mb-4"
            style={{ maxWidth: '280px', width: '100%' }}
          />
          <h1 className="text-3xl font-bold" style={{ color: '#013f7c' }}>Workshop Feedback</h1>
          <p className="text-gray-600 mt-2">We'd love to hear about your experience</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          {/* Select Workshop */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Which workshop did you attend? *</label>
            {isLoading ? (
              <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
            ) : (
              <Select value={selectedSurveyId} onValueChange={setSelectedSurveyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a workshop..." />
                </SelectTrigger>
                <SelectContent>
                  {surveys.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.service_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
              <Input value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} placeholder="Your name" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Company Name</label>
              <Input value={formData.company_name} onChange={e => setFormData({ ...formData, company_name: e.target.value })} placeholder="Your company" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email Address *</label>
            <Input type="email" value={formData.email_address} onChange={e => setFormData({ ...formData, email_address: e.target.value })} placeholder="your@email.com" required />
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
              type="submit"
              disabled={submitMutation.isPending}
              className="w-full text-white font-semibold py-3"
              style={{ backgroundColor: '#013f7c' }}
            >
              {submitMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : 'Submit Feedback'}
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}

function QuestionField({ question, value, onChange }) {
  if (question.type === 'rating_5') {
    return (
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">{question.text}</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(String(n))}
              className={`w-10 h-10 rounded-full font-bold text-sm transition-all border-2 ${
                value === String(n)
                  ? 'bg-[#264d44] text-white border-[#264d44]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#264d44]'
              }`}
            >
              {n}
            </button>
          ))}
          <span className="ml-2 self-center text-xs text-gray-400">1 = Low, 5 = High</span>
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
            <button
              key={n}
              type="button"
              onClick={() => onChange(String(n))}
              className={`w-9 h-9 rounded-lg font-bold text-sm transition-all border-2 ${
                value === String(n)
                  ? 'bg-[#013f7c] text-white border-[#013f7c]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#013f7c]'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>Not likely</span><span>Very likely</span>
        </div>
      </div>
    );
  }

  if (question.type === 'boolean') {
    return (
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">{question.text}</label>
        <div className="flex gap-3">
          {['Yes', 'No'].map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`px-6 py-2 rounded-lg font-semibold text-sm border-2 transition-all ${
                value === opt
                  ? 'bg-[#264d44] text-white border-[#264d44]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#264d44]'
              }`}
            >
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
      <Input value={value} onChange={e => onChange(e.target.value)} placeholder="Your response..." />
    </div>
  );
}