import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Send, Search, Loader2, ExternalLink } from 'lucide-react';

export default function GmailPickerDialog({ open, onClose, onSelect }) {
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['gmailFollowUpList'],
    queryFn: async () => {
      const res = await base44.functions.invoke('fetchGmailForFollowUp', {});
      return res.data;
    },
    enabled: open,
    staleTime: 2 * 60 * 1000
  });

  const messages = (data?.messages || []).filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return m.subject?.toLowerCase().includes(q) || m.from?.toLowerCase().includes(q) || m.to?.toLowerCase().includes(q) || m.snippet?.toLowerCase().includes(q);
  });

  const handleSelect = (msg) => {
    const from = msg.from?.match(/^(.*?)\s*<(.+?)>$/);
    const name = from ? from[1].trim() : msg.from?.split('@')[0] || '';
    const email = from ? from[2] : msg.from || '';

    onSelect({
      title: msg.subject,
      contact_name: msg.direction === 'received' ? name : '',
      contact_email: msg.direction === 'received' ? email : '',
      source: 'gmail',
      source_link: msg.link,
      source_snippet: msg.snippet,
      gmail_message_id: msg.id,
      gmail_thread_id: msg.threadId
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#264d44]" />
            Pick an Email to Follow Up
          </DialogTitle>
        </DialogHeader>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search emails..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {isLoading && (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading emails...
            </div>
          )}
          {error && <p className="text-red-500 text-sm text-center py-8">Failed to load emails.</p>}
          {!isLoading && messages.map(msg => (
            <div
              key={msg.id}
              onClick={() => handleSelect(msg)}
              className="border rounded-lg p-3 cursor-pointer hover:bg-[#f0f7f5] hover:border-[#264d44] transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${msg.direction === 'sent' ? 'bg-blue-50' : 'bg-green-50'}`}>
                    {msg.direction === 'sent'
                      ? <Send className="w-3.5 h-3.5 text-blue-500" />
                      : <Mail className="w-3.5 h-3.5 text-green-600" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-gray-800 truncate">{msg.subject}</p>
                    <p className="text-xs text-gray-500 truncate">{msg.direction === 'received' ? `From: ${msg.from}` : `To: ${msg.to}`}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{msg.snippet}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <Badge variant="outline" className={`text-xs ${msg.direction === 'sent' ? 'text-blue-600 border-blue-200' : 'text-green-600 border-green-200'}`}>
                    {msg.direction === 'sent' ? 'Sent' : 'Received'}
                  </Badge>
                  {msg.date && (
                    <span className="text-xs text-gray-400">
                      {new Date(msg.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {!isLoading && messages.length === 0 && !error && (
            <p className="text-center text-gray-400 py-8">No emails found.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}