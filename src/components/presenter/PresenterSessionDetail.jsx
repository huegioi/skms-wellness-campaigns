import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  ArrowLeft, Calendar, Clock, MapPin, Building, FileText, Copy, Check,
  QrCode, ExternalLink, CheckCircle2, Download, Loader2, Video
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

export default function PresenterSessionDetail({ event, portalId, onBack, onUpdated }) {
  const [accepting, setAccepting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [recordingLink, setRecordingLink] = useState(event.recording_link || '');
  const [savingRecording, setSavingRecording] = useState(false);
  const { toast } = useToast();

  const start = parseISO(event.start_date);
  const end = event.end_date ? parseISO(event.end_date) : null;
  const origin = window.location.origin;

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAccept = async () => {
    setAccepting(true);
    await base44.functions.invoke('updatePresenterSession', {
      portal_id: portalId, event_id: event.id, accepted: true
    });
    setAccepting(false);
    onUpdated();
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
    setCompleting(true);
    await base44.functions.invoke('updatePresenterSession', {
      portal_id: portalId, event_id: event.id, completed: true
    });
    setCompleting(false);
    onUpdated();
  };

  const generateICS = () => {
    const fmt = (d) => format(d, "yyyyMMdd'T'HHmmss");
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SKMS Wellness//Presenter Portal//EN',
      'BEGIN:VEVENT',
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end || new Date(start.getTime() + 60 * 60 * 1000))}`,
      `SUMMARY:${event.title}`,
      event.location ? `LOCATION:${event.location}` : '',
      event.description ? `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}` : '',
      `UID:${event.id}@skms-wellness`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.title.replace(/\s+/g, '_')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isUpcoming = new Date(event.start_date) >= new Date();

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

        {/* Accept / Complete Actions */}
        {isUpcoming && !event.presenter_accepted && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
            <div className="flex-1">
              <p className="font-semibold text-amber-800 text-sm">Please confirm your availability for this session.</p>
            </div>
            <Button
              onClick={handleAccept}
              disabled={accepting}
              className="bg-[#264d44] hover:bg-[#1a3830] text-white text-sm"
            >
              {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
              Accept
            </Button>
          </div>
        )}
        {event.presenter_accepted && isUpcoming && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <p className="text-sm text-emerald-700 font-medium">You've confirmed your availability for this session.</p>
          </div>
        )}
        {!event.completed && !isUpcoming && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4">
            <p className="flex-1 text-sm text-gray-600">Did you deliver this session?</p>
            <Button onClick={handleComplete} disabled={completing} variant="outline" className="text-sm">
              {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Mark Complete
            </Button>
          </div>
        )}
        {event.completed && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-gray-400" />
            <p className="text-sm text-gray-500 font-medium">Session marked as complete.</p>
          </div>
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
            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={generateICS} className="gap-2 text-sm">
                <Download className="w-4 h-4" />
                Add to Calendar (.ics)
              </Button>
            </div>
          </div>
        </div>

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
    </div>
  );
}