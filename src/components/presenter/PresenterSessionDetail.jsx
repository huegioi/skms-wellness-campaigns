import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  ArrowLeft, Calendar, Clock, MapPin, Building, FileText, Copy, Check,
  QrCode, ExternalLink, CheckCircle2, Download, Loader2, Video, ClipboardList, Users, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useQuery } from '@tanstack/react-query';
import PresenterAcceptBar from '@/components/presenter/PresenterAcceptBar';
import AssessmentBadges from '@/components/assessments/AssessmentBadges';
import FacilitationChecklist from '@/components/shared/FacilitationChecklist';
import CheckinQrDialog from '@/components/shared/CheckinQrDialog';
import { isChallengeEvent, getChallengeDayProgress } from '@/lib/challengeUtils';
import { downloadICS } from '@/lib/ics';

export default function PresenterSessionDetail({ event, portalId, onBack, onUpdated }) {
  const [completing, setCompleting] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [recordingLink, setRecordingLink] = useState(event.recording_link || '');
  const [savingRecording, setSavingRecording] = useState(false);
  const [showDay14Reminder, setShowDay14Reminder] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const { toast } = useToast();

  const { data: checkinCount = 0 } = useQuery({
    queryKey: ['event-checkins', event.id],
    queryFn: async () => {
      const checkins = await base44.entities.EventCheckin.filter({ event_id: event.id });
      return checkins.length;
    },
  });

  const start = parseISO(event.start_date);
  const end = event.end_date ? parseISO(event.end_date) : null;
  const origin = window.location.origin;

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveRecording = async () => {
    setSavingRecording(true);
    const res = await base44.functions.invoke('savePresenterRecording', {
      portal_id: portalId,
      event_id: event.id,
      recording_link: recordingLink,
    });
    setSavingRecording(false);
    if (res.data?.success) {
      toast({ title: 'Recording link saved!', description: res.data.sheet?.warning || `Written to sheet (${res.data.sheet?.cell})` });
      onUpdated();
    } else {
      toast({ title: 'Error saving recording', description: res.data?.error || 'Unknown error', variant: 'destructive' });
    }
  };

  const handleComplete = async () => {
    if (isChallenge && event.assessment_counts?.day14 === 0 && !showDay14Reminder) {
      setShowDay14Reminder(true);
      return;
    }
    setCompleting(true);
    setShowDay14Reminder(false);
    await base44.functions.invoke('updatePresenterSession', {
      portal_id: portalId, event_id: event.id, completed: true
    });
    try {
      const res = await base44.functions.invoke('autoAdvanceClientStage', { trigger: 'event_completed', event_id: event.id });
      if (res.data?.transitioned) {
        toast({ title: 'Client moved to Program Delivery', description: `${res.data.client_name} advanced from New Client Setup.` });
      }
    } catch { /* non-fatal */ }
    setCompleting(false);
    onUpdated();
  };

  const handleAddToCalendar = () => downloadICS({
    id: event.id,
    title: event.title,
    start: event.start_date,
    end: event.end_date,
    location: event.location,
    description: event.description,
  });

  const isUpcoming = new Date(event.start_date) >= new Date();
  const isChallenge = isChallengeEvent(event);
  const challengeProgress = isChallenge ? getChallengeDayProgress(event) : null;
  const canComplete = isChallenge ? (challengeProgress?.isPastEnd ?? false) : !isUpcoming;

  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      {/* Header */}
      <div className="bg-[#013f7c] text-white px-6 py-5">
        <div className="max-w-2xl mx-auto">
          <button onClick={onBack} className="flex items-center gap-2 text-blue-200 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to My Sessions
          </button>
          <h1 className="text-2xl font-bold">{event.title}</h1>
          {event.client_name && <p className="text-blue-200 mt-1">{event.client_name}</p>}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Accept / Decline Actions */}
        {isUpcoming && !event.presenter_accepted && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
            <div className="flex-1">
              <p className="font-semibold text-amber-800 text-sm">Please confirm your availability for this session.</p>
            </div>
            <PresenterAcceptBar event={event} portalId={portalId} onUpdated={onUpdated} />
          </div>
        )}
        {event.presenter_accepted && isUpcoming && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <p className="text-sm text-emerald-700 font-medium">You've confirmed your availability for this session.</p>
          </div>
        )}
        {/* Day-14 reminder banner (challenges with no day-14 responses) */}
        {showDay14Reminder && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800 text-sm">Day-14 assessment has no responses yet</p>
                <p className="text-sm text-amber-700 mt-0.5">Please share the Day-14 survey link with participants before completing facilitation.</p>
              </div>
            </div>
            {event.survey_links?.challenge_day14 && (
              <div className="flex items-center gap-2 bg-white rounded-lg p-2 border border-amber-200">
                <p className="flex-1 text-xs text-gray-600 break-all font-mono">{origin}{event.survey_links.challenge_day14}</p>
                <button
                  onClick={() => handleCopy(`${origin}${event.survey_links.challenge_day14}`, 'day14reminder')}
                  className="flex-shrink-0 flex items-center gap-1.5 bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-amber-700 transition-colors"
                >
                  {copiedKey === 'day14reminder' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'day14reminder' ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleComplete}
                disabled={completing}
                className="bg-[#264d44] hover:bg-[#1a3830] text-white text-sm"
              >
                {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                Complete facilitation anyway
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowDay14Reminder(false)} className="text-sm">
                Not yet
              </Button>
            </div>
          </div>
        )}
        {!event.completed && !showDay14Reminder && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4">
            {isChallenge ? (
              <>
                <p className="flex-1 text-sm text-gray-600">
                  {canComplete
                    ? 'All sessions complete — ready to mark facilitation as done.'
                    : challengeProgress?.isFacilitating
                      ? `Facilitating — day ${challengeProgress.currentDay} of ${challengeProgress.totalDays}`
                      : 'Challenge has not started yet.'}
                </p>
                <div title={!canComplete ? 'Available after the challenge ends' : undefined}>
                  <Button
                    onClick={handleComplete}
                    disabled={completing || !canComplete}
                    variant="outline"
                    className={`text-sm ${!canComplete ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                    Mark facilitation complete
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="flex-1 text-sm text-gray-600">Did you deliver this session?</p>
                <div title={isUpcoming ? 'Available after the session' : undefined}>
                  <Button
                    onClick={handleComplete}
                    disabled={completing || isUpcoming}
                    variant="outline"
                    className={`text-sm ${isUpcoming ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Mark Complete
                  </Button>
                </div>
                {isUpcoming && <p className="text-xs text-gray-400 hidden sm:block">Available after the session</p>}
              </>
            )}
          </div>
        )}
        {event.completed && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-gray-400" />
            <p className="text-sm text-gray-500 font-medium">
              {isChallenge ? 'Facilitation marked as complete.' : 'Session marked as complete.'}
            </p>
          </div>
        )}
        {/* Facilitation checklist (challenge events only) */}
        {isChallenge && event.assessment_counts && (
          <FacilitationChecklist
            day0Count={event.assessment_counts.day0}
            day14Count={event.assessment_counts.day14}
            hasRecording={!!event.recording_link}
          />
        )}

        {/* Logistics */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Session Logistics
            </h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-[#013f7c] flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Date</p>
                <p className="font-semibold text-gray-800">{format(start, 'EEEE, MMMM d, yyyy')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-[#013f7c] flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Time</p>
                <p className="font-semibold text-gray-800">
                  {format(start, 'h:mm a')}{end ? ` – ${format(end, 'h:mm a')}` : ''}
                </p>
              </div>
            </div>
            {event.service_name && (
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-[#013f7c] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Service / Program</p>
                  <p className="font-semibold text-gray-800">{event.service_name}</p>
                  {event.service_included_assessments?.length > 0 && (
                    <div className="mt-1.5">
                      <p className="text-xs text-gray-400 mb-1">Includes assessments:</p>
                      <AssessmentBadges assessments={event.service_included_assessments} size="xs" />
                    </div>
                  )}
                </div>
              </div>
            )}
            {event.location && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[#013f7c] flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Location / Join Link</p>
                  {event.location.startsWith('http') ? (
                    <a href={event.location} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold text-sm break-all">
                      <ExternalLink className="w-4 h-4 flex-shrink-0" />
                      Join Meeting
                    </a>
                  ) : (
                    <p className="font-semibold text-gray-800 text-sm">{event.location}</p>
                  )}
                </div>
              </div>
            )}
            {checkinCount > 0 && (
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-[#013f7c] flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Checked In</p>
                  <p className="font-semibold text-gray-800">{checkinCount} attendee{checkinCount !== 1 ? 's' : ''}</p>
                </div>
              </div>
            )}
            {event.checkin_token && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Attendee Check-in</p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(`${origin}/Checkin?t=${event.checkin_token}`, 'checkin')}
                    className="gap-1.5 text-sm"
                  >
                    {copiedKey === 'checkin' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedKey === 'checkin' ? 'Copied!' : 'Copy link'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowQr(true)}
                    className="gap-1.5 text-sm bg-[#264d44] hover:bg-[#1a3830]"
                  >
                    <QrCode className="w-4 h-4" />
                    Show QR code
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(`${origin}/Checkin?t=${event.checkin_token}&kiosk=1`, 'kiosk')}
                    className="gap-1.5 text-sm"
                  >
                    {copiedKey === 'kiosk' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedKey === 'kiosk' ? 'Copied!' : 'Copy kiosk link'}
                  </Button>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">Throw the QR on the room screen so attendees can check in. Kiosk link is for a tablet at the door.</p>
              </div>
            )}
            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={handleAddToCalendar} className="gap-2 text-sm">
                <Download className="w-4 h-4" />
                Add to Calendar (.ics)
              </Button>
            </div>
          </div>
        </div>

        {/* Session Prep */}
        {((event.presenter_notes && event.presenter_notes.trim()) || (event.presenter_materials && event.presenter_materials.some(m => m.url)) || event.attendee_count) && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide flex items-center gap-2">
                <ClipboardList className="w-4 h-4" /> Session Prep
              </h2>
            </div>
            <div className="p-5 space-y-4">
              {event.attendee_count && (
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-[#013f7c] flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Expected Attendees</p>
                    <p className="font-semibold text-gray-800">{event.attendee_count.toLocaleString()} people</p>
                  </div>
                </div>
              )}
              {event.presenter_notes && event.presenter_notes.trim() && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Run-of-Show Notes</p>
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {event.presenter_notes}
                  </div>
                </div>
              )}
              {event.presenter_materials && event.presenter_materials.some(m => m.url) && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Materials & Guides</p>
                  <div className="flex flex-wrap gap-2">
                    {event.presenter_materials.filter(m => m.url).map((m, i) => (
                      <a
                        key={i}
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#013f7c] text-white text-sm font-medium hover:bg-[#012a54] transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        {m.label || m.url}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Client Context */}
        {event.client_context && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide flex items-center gap-2">
                <Building className="w-4 h-4" /> Client Context
              </h2>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Building className="w-5 h-5 text-[#264d44] flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Company</p>
                  <p className="font-semibold text-gray-800">{event.client_context.company || event.client_name || '—'}</p>
                </div>
              </div>
              {event.client_context.industry && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Industry</p>
                  <p className="font-semibold text-gray-800">{event.client_context.industry}</p>
                </div>
              )}
              {event.client_context.company_size && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Company Size</p>
                  <p className="font-semibold text-gray-800">{event.client_context.company_size} employees</p>
                </div>
              )}
              {event.client_context.notes && (
                <div className="border-t pt-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Audience Notes</p>
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {event.client_context.notes}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Materials */}
        {event.materials && event.materials.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide flex items-center gap-2">
                <FileText className="w-4 h-4" /> Session Materials
              </h2>
            </div>
            <div className="p-5 space-y-2">
              {event.materials.map((m, i) => (
                <a
                  key={i}
                  href={m.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-100 transition-colors"
                >
                  <FileText className="w-5 h-5 text-[#013f7c] flex-shrink-0" />
                  <span className="flex-1 text-sm font-medium text-gray-800 truncate">{m.title}</span>
                  <Download className="w-4 h-4 text-gray-400" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Survey / Feedback Links */}
        {event.survey_links && Object.keys(event.survey_links).length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100" style={{ background: 'linear-gradient(135deg, #264d44, #1a3830)' }}>
              <h2 className="font-bold text-white text-sm uppercase tracking-wide flex items-center gap-2">
                <QrCode className="w-4 h-4" /> Attendee Survey Links
              </h2>
              <p className="text-emerald-200 text-xs mt-0.5">Share these at the session — no scores shown here</p>
            </div>
            <div className="p-5 space-y-5">
              {Object.entries(event.survey_links).map(([key, path]) => {
                const fullUrl = `${origin}${path}`;
                const labels = {
                  pulse: 'Session Feedback',
                  challenge_day0: 'Challenge — Day 0 Assessment',
                  challenge_day14: 'Challenge — Day 14 Assessment',
                };
                return (
                  <div key={key} className="space-y-3">
                    <p className="text-sm font-semibold text-gray-700">{labels[key] || key}</p>
                    {/* QR Code */}
                    <div className="flex justify-center">
                      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(fullUrl)}`}
                          alt={`QR code for ${labels[key] || key}`}
                          className="w-44 h-44 rounded-lg"
                        />
                        <p className="text-center text-xs text-gray-400 mt-2">Scan to submit</p>
                        <div className="flex justify-center mt-2">
                          <a
                            href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(fullUrl)}&download=1`}
                            download={`qr-${key}.png`}
                            className="flex items-center gap-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download QR
                          </a>
                        </div>
                      </div>
                    </div>
                    {/* Copy link */}
                    <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3 border border-gray-200">
                      <p className="flex-1 text-xs text-gray-600 break-all font-mono">{fullUrl}</p>
                      <button
                        onClick={() => handleCopy(fullUrl, key)}
                        className="flex-shrink-0 flex items-center gap-1.5 bg-[#013f7c] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#012a54] transition-colors"
                      >
                        {copiedKey === key ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedKey === key ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recording Link */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide flex items-center gap-2">
              <Video className="w-4 h-4" /> Recording Link
            </h2>
            <p className="text-gray-400 text-xs mt-0.5">Paste your Loom or Zoom recording URL here</p>
          </div>
          <div className="p-5">
            <div className="flex gap-2">
              <input
                type="url"
                value={recordingLink}
                onChange={e => setRecordingLink(e.target.value)}
                placeholder="https://loom.com/share/..."
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#013f7c] placeholder-gray-400"
              />
              <Button
                onClick={handleSaveRecording}
                disabled={savingRecording}
                className="bg-[#013f7c] hover:bg-[#012a54] text-white text-sm flex-shrink-0"
              >
                {savingRecording ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
              </Button>
            </div>
            {recordingLink && (
              <a
                href={recordingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-xs text-blue-600 hover:text-blue-800"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open recording
              </a>
            )}
          </div>
        </div>

        {/* Session notes */}
        {event.description && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Session Notes</p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{event.description}</p>
          </div>
        )}

      </div>
      {event.checkin_token && (
        <CheckinQrDialog
          open={showQr}
          onOpenChange={setShowQr}
          checkinUrl={`${origin}/Checkin?t=${event.checkin_token}`}
          eventTitle={event.title}
          eventDate={event.start_date}
        />
      )}
    </div>
  );
}