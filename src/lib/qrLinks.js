import { ROI_CALCULATOR_URL } from '@/lib/rateCard';

/**
 * Conference QR codes (Admin Tools → QR button on each prospecting tool).
 *
 * Every QR code points at the branded welcome page, /Scan?to=<key>, not at the
 * tool itself. That page shows the SkillfulMeans logo, "Mental Fitness
 * Campaigns" and "Catch stress before it costs you", then forwards to the
 * destination below. Going through one page means the welcome screen works
 * the same for the tools we don't host here (the ROI calculator on Railway,
 * the client demo on GitHub Pages).
 *
 * Printed codes live forever, so NEVER rename a key once it has been printed —
 * change the destination instead, and every code already out there follows.
 */
export const QR_BASE_URL = 'https://app.skillfulmeans.life';

export const QR_DESTINATIONS = {
  quickbuilder: { label: 'Quick Builder', url: '/QuickBuilder' },
  journey:      { label: 'Mental Fitness Journey', url: '/FitnessRoi' },
  roi:          { label: 'ROI Calculator', url: ROI_CALCULATOR_URL },
  demo:         { label: 'Client Demo', url: 'https://huegioi.github.io/skillfulmeans-client-demo' },
};

/** The URL encoded into the QR code for a destination key. */
export function qrScanUrl(key) {
  return `${QR_BASE_URL}/Scan?to=${encodeURIComponent(key)}`;
}
