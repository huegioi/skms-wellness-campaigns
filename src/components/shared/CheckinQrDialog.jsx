import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Printer, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const LOGO_URL = 'https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/bb0a43468_SKMSLogoShieldBrown.png';

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export default function CheckinQrDialog({ open, onOpenChange, checkinUrl, eventTitle, eventDate }) {
  const [downloading, setDownloading] = useState(false);

  const dateLabel = eventDate
    ? format(typeof eventDate === 'string' ? parseISO(eventDate) : eventDate, "EEEE, MMMM d, yyyy 'at' h:mm a")
    : '';

  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=2&data=${encodeURIComponent(checkinUrl)}`;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = qrImgUrl;
      });

      const canvas = document.createElement('canvas');
      const W = 600;
      const padding = 40;
      const qrSize = 400;
      const ctx = canvas.getContext('2d');

      ctx.font = 'bold 24px sans-serif';
      const titleLines = wrapText(ctx, eventTitle || 'Session Check-in', W - padding * 2);
      const headerH = 30 + titleLines.length * 30 + (dateLabel ? 26 : 0) + 20;
      const qrY = headerH;
      const H = qrY + qrSize + padding + 20;

      canvas.width = W;
      canvas.height = H;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#013f7c';
      ctx.font = 'bold 24px sans-serif';
      titleLines.forEach((line, i) => {
        ctx.fillText(line, W / 2, 30 + i * 30);
      });

      if (dateLabel) {
        ctx.fillStyle = '#666666';
        ctx.font = '16px sans-serif';
        ctx.fillText(dateLabel, W / 2, 30 + titleLines.length * 30 + 20);
      }

      ctx.drawImage(img, (W - qrSize) / 2, qrY, qrSize, qrSize);

      ctx.fillStyle = '#999999';
      ctx.font = '14px sans-serif';
      ctx.fillText('SkillfulMeans Wellness', W / 2, qrY + qrSize + 25);

      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `checkin-qr-${(eventTitle || 'event').replace(/\s+/g, '-')}.png`;
        a.click();
        URL.revokeObjectURL(url);
      });
    } catch {
      window.open(`${qrImgUrl}&download=1`, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    const printWin = window.open('', '_blank', 'width=600,height=800');
    printWin.document.write(`
      <html><head><title>Check-in QR — ${eventTitle || 'Event'}</title>
      <style>
        body { font-family: sans-serif; text-align: center; padding: 40px; margin: 0; }
        .logo { height: 40px; margin-bottom: 12px; }
        .title { color: #013f7c; font-size: 24px; font-weight: bold; margin-bottom: 4px; }
        .date { color: #666; font-size: 16px; margin-bottom: 24px; }
        .qr { width: 400px; height: 400px; }
        .footer { color: #999; font-size: 14px; margin-top: 20px; }
        @media print { body { padding: 20px; } }
      </style></head><body>
        <img class="logo" src="${LOGO_URL}" alt="SkillfulMeans" />
        <div class="title">${eventTitle || 'Session Check-in'}</div>
        ${dateLabel ? `<div class="date">${dateLabel}</div>` : ''}
        <img class="qr" src="${qrImgUrl}" alt="QR code" />
        <div class="footer">SkillfulMeans Wellness</div>
      </body></html>
    `);
    printWin.document.close();
    printWin.onload = () => { printWin.focus(); printWin.print(); };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Check-in QR Code</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          <img src={LOGO_URL} alt="SkillfulMeans" className="h-8" />
          <div className="text-center">
            <p className="font-bold text-[#013f7c] text-base">{eventTitle || 'Session Check-in'}</p>
            {dateLabel && <p className="text-sm text-gray-500 mt-0.5">{dateLabel}</p>}
          </div>
          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
            <img src={qrImgUrl} alt="Check-in QR code" className="w-56 h-56 rounded-lg" />
          </div>
          <p className="text-xs text-gray-400 text-center">Scan to check in to this session</p>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handlePrint} className="flex-1">
            <Printer className="w-4 h-4 mr-1.5" />
            Print
          </Button>
          <Button onClick={handleDownload} disabled={downloading} className="flex-1 bg-[#264d44] hover:bg-[#1a3830]">
            {downloading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
            Download PNG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}