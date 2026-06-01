import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, Calendar, Clock, Video, Building, User, FileText, Copy, Check, ExternalLink, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SpeakerSessionDetail({ event, onBack, user }) {
  const [copied, setCopied] = useState(false);

  const start = parseISO(event.start_date);
  const end = event.end_date ? parseISO(event.end_date) : null;

  // Build the feedback link
  const feedbackLink = event.service_id && event.client_id
    ? `${window.location.origin}/AttendeeForm?service_id=${event.service_id}&client_id=${event.client_id}`
    : event.service_id
    ? `${window.location.origin}/AttendeeForm?service_id=${event.service_id}`
    : null;

  // Load client details for context/notes
  const { data: client } = useQuery({
    queryKey: ['speaker-client', event.client_id],
    queryFn: () => base44.entities.Client.filter({ id: event.client_id }).then(r => r[0] || null),
    enabled: !!event.client_id,
  });

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

        {/* Logistics Card */}
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
                <Video className="w-5 h-5 text-[#013f7c] flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Video Call Link</p>
                  <a
                    href={event.location}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-semibold text-sm break-all"
                  >
                    <ExternalLink className="w-4 h-4 flex-shrink-0" />
                    Join Meeting
                  </a>
                  <p className="text-xs text-gray-400 mt-1 break-all">{event.location}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Client Context Card */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide flex items-center gap-2">
              <Building className="w-4 h-4" /> Client Context
            </h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Building className="w-5 h-5 text-[#264d44] flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Company</p>
                <p className="font-semibold text-gray-800">{event.client_name || '—'}</p>
              </div>
            </div>
            {client?.name && (
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-[#264d44] flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Main Contact</p>
                  <p className="font-semibold text-gray-800">{client.name}</p>
                  {client.title && <p className="text-sm text-gray-500">{client.title}</p>}
                </div>
              </div>
            )}
            {client?.industry && (
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-[#264d44] flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Industry</p>
                  <p className="font-semibold text-gray-800">{client.industry}</p>
                </div>
              </div>
            )}
            {client?.company_size && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Company Size</p>
                <p className="font-semibold text-gray-800">{client.company_size} employees</p>
              </div>
            )}
            {client?.notes && (
              <div className="border-t pt-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Audience Notes / Context</p>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {client.notes}
                </div>
              </div>
            )}
            {!client?.notes && (
              <div className="border-t pt-4">
                <p className="text-xs text-gray-400 italic">No audience notes on file for this client.</p>
              </div>
            )}
          </div>
        </div>

        {/* Feedback Link Card */}
        {feedbackLink && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100" style={{ background: 'linear-gradient(135deg, #264d44, #1a3830)' }}>
              <h2 className="font-bold text-white text-sm uppercase tracking-wide flex items-center gap-2">
                <QrCode className="w-4 h-4" /> Attendee Feedback Link
              </h2>
              <p className="text-emerald-200 text-xs mt-0.5">Share this at the end of your session</p>
            </div>
            <div className="p-5 space-y-4">
              {/* QR Code */}
              <div className="flex justify-center">
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(feedbackLink)}`}
                    alt="Feedback QR Code"
                    className="w-48 h-48 rounded-lg"
                  />
                  <p className="text-center text-xs text-gray-400 mt-2">Scan to submit feedback</p>
                </div>
              </div>

              {/* Copy Link */}
              <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3 border border-gray-200">
                <p className="flex-1 text-xs text-gray-600 break-all font-mono">{feedbackLink}</p>
                <button
                  onClick={() => handleCopy(feedbackLink)}
                  className="flex-shrink-0 flex items-center gap-1.5 bg-[#013f7c] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#012a54] transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <p className="text-xs text-gray-400 text-center">
                Drop this link in the Zoom chat or display the QR code during the final minutes of your session.
              </p>
            </div>
          </div>
        )}

        {/* Session description */}
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