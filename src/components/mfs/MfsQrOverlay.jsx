import React from 'react';

const LOGO_URL = 'https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/bb0a43468_SKMSLogoShieldBrown.png';

export default function MfsQrOverlay({ open, onClose, url }) {
  if (!open) return null;

  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=2&data=${encodeURIComponent(url)}`;

  return (
    <div
      className="fixed inset-0 z-[60] bg-white flex flex-col items-center justify-center cursor-pointer"
      onClick={onClose}
    >
      <img src={LOGO_URL} alt="SkillfulMeans" className="h-10 mb-4" />
      <p className="text-lg font-bold text-[#013f7c] mb-1 text-center px-6">The Mental Fitness Score</p>
      <p className="text-sm text-gray-500 mb-6 text-center px-6">Scan to start the free assessment</p>
      <img
        src={qrImgUrl}
        alt="Mental Fitness Score QR code"
        className="w-[82vw] max-w-[420px] h-[82vw] max-h-[420px]"
      />
      <p className="text-xs text-gray-400 mt-6">Tap anywhere to close</p>
    </div>
  );
}