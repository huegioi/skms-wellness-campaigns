import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Copy, QrCode, Share2, X, Search, UserCheck, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import MfsQrOverlay from '@/components/mfs/MfsQrOverlay';

const COLOR_CONFIGS = {
  purple: {
    border: 'border-purple-200',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    chipBg: 'bg-purple-50',
    chipBorder: 'border-purple-200',
    chipText: 'text-purple-700',
    chipIcon: 'text-purple-600',
    chipClose: 'text-purple-400 hover:text-purple-600',
    linkText: 'text-purple-600',
    linkBg: 'hover:bg-purple-50',
  },
  teal: {
    border: 'border-teal-200',
    iconBg: 'bg-teal-100',
    iconColor: 'text-teal-600',
    chipBg: 'bg-teal-50',
    chipBorder: 'border-teal-200',
    chipText: 'text-teal-700',
    chipIcon: 'text-teal-600',
    chipClose: 'text-teal-400 hover:text-teal-600',
    linkText: 'text-teal-600',
    linkBg: 'hover:bg-teal-50',
  },
};

export default function AssessmentShareCard({
  title,
  subtitle,
  url,
  shareTitle,
  shareText,
  accentColor = 'purple',
  icon: Icon = Share2,
  qrTitle,
  qrSubtitle,
}) {
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [partnerSearch, setPartnerSearch] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);

  const { data: partners = [] } = useQuery({
    queryKey: ['referral-partners', 'assessment-share', accentColor],
    queryFn: () => base44.entities.ReferralPartner.filter({ is_active: true }, 'name', 200),
    staleTime: 120_000,
  });

  const activePartners = partners.filter(p => !p.is_demo);
  const shareUrl = selectedPartner
    ? `${url}?ref=${selectedPartner.unique_portal_id}`
    : url;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success('Link copied!');
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
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

  const c = COLOR_CONFIGS[accentColor] || COLOR_CONFIGS.purple;

  return (
    <>
      <div className={`bg-white rounded-2xl border ${c.border} shadow-sm p-3 sm:p-4 mb-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Left: icon + title + subtitle */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.iconBg} shrink-0`}>
              <Icon className={`w-4 h-4 ${c.iconColor}`} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-gray-800 text-sm leading-tight">{title}</h3>
              <p className="text-xs text-gray-400 truncate">{subtitle}</p>
            </div>
          </div>

          {/* Right: crediting chip + action buttons + partner picker */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {selectedPartner && (
              <div className={`flex items-center gap-1.5 ${c.chipBg} border ${c.chipBorder} rounded-lg px-2.5 py-1.5`}>
                <UserCheck className={`w-3.5 h-3.5 ${c.chipIcon} shrink-0`} />
                <span className={`text-xs font-medium ${c.chipText} truncate max-w-[100px]`}>{selectedPartner.name}</span>
                <button onClick={() => setSelectedPartner(null)} className="shrink-0">
                  <X className={`w-3.5 h-3.5 ${c.chipClose}`} />
                </button>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <button onClick={handleCopy} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors" title="Copy link">
                <Copy className="w-4 h-4 text-gray-600" />
                <span className="text-xs font-medium text-gray-600 hidden sm:inline">Copy</span>
              </button>
              <button onClick={() => setQrOpen(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors" title="Show QR">
                <QrCode className="w-4 h-4 text-gray-600" />
                <span className="text-xs font-medium text-gray-600 hidden sm:inline">QR</span>
              </button>
              <button onClick={handleShare} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#013f7c] hover:bg-[#012d5a] transition-colors" title="Share">
                <Share2 className="w-4 h-4 text-white" />
                <span className="text-xs font-medium text-white hidden sm:inline">Share</span>
              </button>
            </div>

            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <button className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium ${c.linkText} ${c.linkBg} transition-colors`}>
                  {selectedPartner ? 'Change' : 'Partner'}
                  <ChevronDown className="w-3 h-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="end">
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
        </div>
      </div>

      <MfsQrOverlay
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        url={shareUrl}
        title={qrTitle}
        subtitle={qrSubtitle}
      />
    </>
  );
}