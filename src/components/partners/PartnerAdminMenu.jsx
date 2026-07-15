import React from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Copy, RefreshCw, Mail, MoreVertical, Check } from 'lucide-react';

export default function PartnerAdminMenu({ partner, copiedId, onCopyLink, onRegenerate, onSendEmail, regenerating, sendingEmail }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <MoreVertical className="w-4 h-4" /> Admin
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onCopyLink(partner)}>
          {copiedId === partner.id ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          {copiedId === partner.id ? 'Copied!' : 'Copy Portal Link'}
        </DropdownMenuItem>
        {partner.unique_portal_id && (
          <>
            <DropdownMenuItem onClick={() => onRegenerate(partner)} disabled={regenerating === partner.id}>
              <RefreshCw className={`w-4 h-4 ${regenerating === partner.id ? 'animate-spin' : ''}`} />
              {regenerating === partner.id ? 'Regenerating...' : 'Regenerate Link'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSendEmail(partner)} disabled={sendingEmail === partner.id}>
              <Mail className="w-4 h-4" />
              {sendingEmail === partner.id ? 'Sending...' : 'Send Portal Email'}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}