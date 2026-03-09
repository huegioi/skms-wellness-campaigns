import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Mail, Send, Inbox, RefreshCw, ChevronDown, ChevronUp, ExternalLink, Maximize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function FullEmailModal({ email, onClose }) {
  const [body, setBody] = useState(null);
  const [isHtml, setIsHtml] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  React.useEffect(() => {
    base44.functions.invoke('getGmailMessage', { messageId: email.id })
      .then(res => {
        setBody(res.data.body);
        setIsHtml(res.data.isHtml);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [email.id]);

  const dateStr = email.date
    ? new Date(email.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  const timeStr = email.date
    ? new Date(email.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold pr-6">{email.subject}</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-gray-500 space-y-0.5 border-b pb-3">
          <p><span className="font-medium text-gray-700">From:</span> {email.from}</p>
          <p><span className="font-medium text-gray-700">To:</span> {email.to}</p>
          {dateStr && <p><span className="font-medium text-gray-700">Date:</span> {dateStr} at {timeStr}</p>}
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 mt-2">
          {loading && <p className="text-gray-400 text-sm text-center py-8">Loading email...</p>}
          {error && <p className="text-red-500 text-sm text-center py-8">{error}</p>}
          {!loading && !error && body && (
            isHtml
              ? <iframe
                  srcDoc={body}
                  className="w-full border-0"
                  style={{ height: '500px' }}
                  sandbox="allow-same-origin"
                  title="Email content"
                />
              : <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{body}</pre>
          )}
          {!loading && !error && !body && (
            <p className="text-gray-400 text-sm text-center py-8">No content available.</p>
          )}
        </div>
        <div className="border-t pt-3 flex justify-end">
          <a
            href={`https://mail.google.com/mail/u/0/#inbox/${email.threadId || email.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium"
          >
            <ExternalLink className="w-3 h-3" /> Open in Gmail
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmailRow({ email }) {
  const [expanded, setExpanded] = useState(false);
  const [showFullEmail, setShowFullEmail] = useState(false);

  const dateStr = email.date
    ? new Date(email.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  const timeStr = email.date
    ? new Date(email.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : null;

  const gmailLink = `https://mail.google.com/mail/u/0/#inbox/${email.threadId || email.id}`;

  return (
    <div className="bg-white border rounded-lg overflow-hidden hover:shadow-sm transition-shadow">
      {/* Header row - always visible, clickable to expand */}
      <button
        className="w-full text-left p-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex justify-between items-start gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
              email.direction === 'sent' ? 'bg-blue-50' : 'bg-green-50'
            }`}>
              {email.direction === 'sent'
                ? <Send className="w-4 h-4 text-blue-500" />
                : <Inbox className="w-4 h-4 text-green-600" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <p className="font-medium text-gray-800 text-sm">{email.subject}</p>
                <Badge variant="outline" className={`text-xs flex-shrink-0 ${
                  email.direction === 'sent'
                    ? 'text-blue-600 border-blue-200'
                    : 'text-green-600 border-green-200'
                }`}>
                  {email.direction === 'sent' ? 'Sent' : 'Received'}
                </Badge>
                {email.account && (
                  <Badge variant="outline" className="text-xs flex-shrink-0 text-gray-500 border-gray-200">
                    {email.account === 'admin@skillfulmeans.life' ? 'Admin' : email.account.split('@')[0].charAt(0).toUpperCase() + email.account.split('@')[0].slice(1)}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-400 truncate">From: {email.from}</p>
              <p className="text-xs text-gray-400 truncate">To: {email.to}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {dateStr && (
              <div className="text-right">
                <p className="text-xs text-gray-500 font-medium">{dateStr}</p>
                {timeStr && <p className="text-xs text-gray-400">{timeStr}</p>}
              </div>
            )}
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 bg-gray-50 space-y-3">
          {email.snippet && (
            <p className="text-sm text-gray-600 leading-relaxed">{email.snippet}</p>
          )}
          <div className="flex items-center justify-between text-xs text-gray-400">
            <div className="space-y-0.5">
              <p>From: {email.from}</p>
              <p>To: {email.to}</p>
              {dateStr && timeStr && <p>{dateStr} at {timeStr}</p>}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); setShowFullEmail(true); }}
                className="flex items-center gap-1 text-[#264d44] hover:text-[#1a3830] font-medium text-xs"
              >
                <Maximize2 className="w-3 h-3" />
                View Full Email
              </button>
              <a
                href={gmailLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium text-xs"
              >
                <ExternalLink className="w-3 h-3" />
                Open in Gmail
              </a>
            </div>
          </div>
        </div>
      )}

      {showFullEmail && <FullEmailModal email={email} onClose={() => setShowFullEmail(false)} />}
    </div>
  );
}

export default function GmailHistory({ clientEmail }) {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['gmailHistory', clientEmail],
    queryFn: async () => {
      const res = await base44.functions.invoke('syncGmailEmails', { clientEmail });
      return res.data;
    },
    staleTime: 5 * 60 * 1000
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-5 h-5 animate-spin text-gray-400 mr-2" />
        <p className="text-gray-500">Loading email history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        <p className="mb-2">Failed to load emails: {error.message}</p>
        <Button size="sm" variant="outline" onClick={refetch}>Retry</Button>
      </div>
    );
  }

  const emails = data?.emails || [];
  const lastContactDate = data?.lastContactDate;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="font-semibold text-gray-700">Gmail History</h4>
          {lastContactDate ? (
            <p className="text-sm text-gray-500 mt-0.5">
              Last email: <span className="font-medium text-gray-700">
                {new Date(lastContactDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {' at '}
                {new Date(lastContactDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </span>
            </p>
          ) : (
            <p className="text-sm text-gray-400 mt-0.5">No emails found</p>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={refetch} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {emails.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Mail className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p>No emails found with {clientEmail}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {emails.map(email => (
            <EmailRow key={email.id} email={email} />
          ))}
        </div>
      )}
    </div>
  );
}