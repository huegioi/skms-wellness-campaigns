import React, { useRef, useState } from 'react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Check, Download, Maximize2, X } from 'lucide-react';
import { qrScanUrl, QR_DESTINATIONS } from '@/lib/qrLinks';

const LOGO_URL = 'https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/bb0a43468_SKMSLogoShieldBrown.png';
const NAVY = '#013f7c';

/**
 * QR code for one prospecting tool, for sharing at a conference.
 *
 * The code encodes /Scan?to=<key> (see src/lib/qrLinks.js), so whoever scans
 * it sees the SkillfulMeans welcome screen before the tool opens.
 *
 * Drawn locally with qrcode.react rather than an image from a QR web service,
 * so it still renders on patchy conference Wi-Fi once the page is open.
 *
 * "Full screen" is the hold-up-your-phone mode: a white screen with just the
 * code, as large as the screen allows. "Download PNG" is for printing.
 */
export default function ConferenceQrDialog({ open, onOpenChange, qrKey }) {
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const canvasWrap = useRef(null);

  if (!qrKey) return null;
  const dest = QR_DESTINATIONS[qrKey];
  const url = qrScanUrl(qrKey);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — the link is visible to copy by hand */ }
  };

  // Compose a print-ready PNG: title, big code, tagline. Text only (no remote
  // logo) so the canvas is never cross-origin-tainted and always exports.
  const download = () => {
    const qr = canvasWrap.current?.querySelector('canvas');
    if (!qr) return;
    const W = 900, pad = 60, qrSize = 700;
    const c = document.createElement('canvas');
    c.width = W; c.height = pad + 60 + 20 + qrSize + 110;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = NAVY;
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText(dest.label, W / 2, pad + 40);
    ctx.drawImage(qr, (W - qrSize) / 2, pad + 80, qrSize, qrSize);
    ctx.fillStyle = '#374151';
    ctx.font = 'italic 30px sans-serif';
    ctx.fillText('“Catch stress before it costs you”', W / 2, pad + 80 + qrSize + 50);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '22px sans-serif';
    ctx.fillText('SkillfulMeans · Mental Fitness Campaigns', W / 2, pad + 80 + qrSize + 88);
    c.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `SkillfulMeans-QR-${dest.label.replace(/\s+/g, '-')}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  };

  return (
    <>
      <Dialog open={open && !fullscreen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{dest.label} QR code</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3 py-1">
            <img src={LOGO_URL} alt="SkillfulMeans" className="h-8" />
            <div className="bg-white rounded-2xl p-4 border border-gray-200">
              <QRCodeSVG value={url} size={224} level="M" marginSize={1} fgColor={NAVY} />
            </div>
            <p className="text-xs text-gray-500 text-center">
              Opens the SkillfulMeans welcome screen, then {dest.label}.
            </p>
            <button
              type="button"
              onClick={copy}
              className="w-full flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left hover:bg-gray-100"
            >
              <span className="flex-1 min-w-0 truncate text-xs text-gray-600">{url}</span>
              {copied
                ? <Check className="w-4 h-4 text-green-600 shrink-0" />
                : <Copy className="w-4 h-4 text-gray-400 shrink-0" />}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button variant="outline" onClick={download} className="gap-1.5">
              <Download className="w-4 h-4" /> Download PNG
            </Button>
            <Button onClick={() => setFullscreen(true)} className="gap-1.5 bg-[#264d44] hover:bg-[#1a3830]">
              <Maximize2 className="w-4 h-4" /> Full screen
            </Button>
          </div>

          {/* Hi-res canvas used only for the PNG export */}
          <div ref={canvasWrap} className="hidden" aria-hidden>
            <QRCodeCanvas value={url} size={700} level="M" marginSize={2} fgColor={NAVY} />
          </div>
        </DialogContent>
      </Dialog>

      {open && fullscreen && (
        <div
          className="fixed inset-0 z-[70] bg-white flex flex-col items-center justify-center px-6 cursor-pointer"
          onClick={() => setFullscreen(false)}
        >
          <button
            type="button"
            aria-label="Close full screen"
            className="absolute top-4 right-4 w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center"
            style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
          <img src={LOGO_URL} alt="SkillfulMeans" className="h-10 mb-3" />
          <p className="text-xl font-bold text-[#013f7c] mb-6 text-center">{dest.label}</p>
          <QRCodeSVG
            value={url}
            level="M"
            marginSize={1}
            fgColor={NAVY}
            style={{ width: 'min(82vw, 62vh, 460px)', height: 'min(82vw, 62vh, 460px)' }}
          />
          <p className="text-base italic text-gray-600 mt-6 text-center">“Catch stress before it costs you”</p>
          <p className="text-xs text-gray-400 mt-4">Tap anywhere to close</p>
        </div>
      )}
      {/* Keep the hi-res canvas mounted while in full screen too, so Download
          keeps working if the dialog is reopened. */}
    </>
  );
}
