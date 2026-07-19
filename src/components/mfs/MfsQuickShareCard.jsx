import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Brain, Copy, QrCode, Share2, X, Search, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import MfsQrOverlay from './MfsQrOverlay';

const MFS_URL = 'https://app.skillfulmeans.life/MentalFitnessScore';
const SHARE_TEXT = "Get your team's free Mental Fitness Score — 3 minutes per employee, fully anonymous";

export default function MfsQuickShareCard() {
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [partnerSearch, setPartnerSearch] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);

  const { data: partners = [] } = useQuery({
    queryKey: ['referral-partners', 'mfs-share'],
    queryFn: () => base44.entities.ReferralPartner.filter({ is_active: true }, 'name', 200),
    staleTime: 120_000,
  });

  const activePartners = partners.filter(p => !p.is_demo);
  const shareUrl = selectedPartner
    ? `${MFS_URL}?ref=${selectedPartner.unique_portal_id}`
    : MFS_URL;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link copied!');
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'The Mental Fitness Score', text: SHARE_TEXT, url: shareUrl });
      } catch { /* user cancelled */ }
    } else {
      handleCopy();
    }
  };

  const filtered = activePartners.filter(p =>
    !partnerSearch ||
    p.name?.toLowerCase().includes(partnerSearch.toLowerCase()) ||
    p.company?.toLowerCase().includes(partnerSearch.toLowerCase())
  );

  const pickPartner = (p) => {
    setSelectedPartner(p);
    setPartnerSearch('');
    setPopoverOpen(false);
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-purple-200 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-100">
            <Brain className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800 text-base leading-tight">The Mental Fitness Score</h2>
            <p className="text-xs text-gray-400">Free assessment — share it anywhere</p>
          </div>
        </div>

        {selectedPartner && (
          <div className="flex items-center gap-2 mb-3 bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5">
            <UserCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span className="text-xs font-medium text-purple-700 truncate">crediting: {selectedPartner.name}</span>
            <button onClick={() => setSelectedPartner(null)} className="ml-auto shrink-0">
              <X className="w-3.5 h-3.5 text-purple-400 hover:text-purple-600" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <button onClick={handleCopy} className="flex flex-col items-center gap-1.5 py-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
            <Copy className="w-6 h-6 text-gray-600" />
            <span className="text-xs font-medium text-gray-600">Copy link</span>
          </button>
          <button onClick={() => setQrOpen(true)} className="flex flex-col items-center gap-1.5 py-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
            <QrCode className="w-6 h-6 text-gray-600" />
            <span className="text-xs font-medium text-gray-600">Show QR</span>
          </button>
          <button onClick={handleShare} className="flex flex-col items-center gap-1.5 py-4 rounded-xl bg-[#013f7c] hover:bg-[#012d5a] transition-colors">
            <Share2 className="w-6 h-6 text-white" />
            <span className="text-xs font-medium text-white">Share…</span>
          </button>
        </div>

        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <button className="mt-3 text-xs text-purple-600 hover:text-purple-700 font-medium">
              {selectedPartner ? 'Change partner' : 'Share as partner'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <div className="p-2 border-b border-gray-100">
              <div className="flex items-center gap-2 px-2">
                <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <input
                  value={partnerSearch}
                  onChange={e => setPartnerSearch(e.target.value)}
                  placeholder="Search partners..."
                  className="flex-1 bg-transparent text-sm py-1.5 outline-none"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-xs text-gray-400 p-4 text-center">No partners found</p>
              ) : filtered.map(p => (
                <button
                  key={p.id}
                  onClick={() => pickPartner(p)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="text-sm font-medium text-gray-700 truncate">{p.name}</span>
                  {p.company && <span className="text-xs text-gray-400 truncate">{p.company}</span>}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <MfsQrOverlay open={qrOpen} onClose={() => setQrOpen(false)} url={shareUrl} />
    </>
  );
}