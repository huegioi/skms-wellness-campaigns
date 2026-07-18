import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function MfsPromoCard({ uniquePortalId, partnerName, compact }) {
  const [copied, setCopied] = useState(false);

  if (!uniquePortalId) return null;

  const refLink = `https://app.skillfulmeans.life/MentalFitnessScore?ref=${uniquePortalId}`;

  const copyLink = () => {
    navigator.clipboard.writeText(refLink);
    setCopied(true);
    toast.success('Your MFS link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-[#e6e1d8] bg-gradient-to-br from-[#f9f8f5] to-[#f0ebe0] border-l-4 border-l-[#770142]">
      <CardHeader className={compact ? 'pb-2' : undefined}>
        <CardTitle className="flex items-center gap-2 text-base text-[#770142]">
          <Brain className="w-5 h-5" />
          Give Your Clients a Free Mental Fitness Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          The Mental Fitness Score is a free, anonymous 2-minute team assessment that measures wellbeing, stress, engagement, and connection. Share your personal link with HR contacts — when their team completes it, the results land in your referral pipeline automatically, with a warm introduction already made.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-[#e6e1d8] text-xs text-gray-600 truncate">
            <span className="font-mono truncate">{refLink}</span>
          </div>
          <Button onClick={copyLink} size="sm" className="bg-[#770142] hover:bg-[#5a0132] text-white gap-1.5 shrink-0">
            <Copy className="w-3.5 h-3.5" />
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
          <a href={refLink} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
              <ExternalLink className="w-3.5 h-3.5" />
              Preview
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}