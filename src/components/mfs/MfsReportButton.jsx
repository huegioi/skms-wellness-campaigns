import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { MFS_INSTRUMENTS, SCORE_ZONES, getZone } from '@/lib/mfsScore';
import { getInstrumentInterpretation, getCompositeInterpretation } from '@/lib/mfsInterpretation';
import { MFS_EVIDENCE_BLOCKS, MFS_DISCLAIMER, getZoneContextSentence } from '@/lib/mfsScoreContent';

const LOGO_URL = 'https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/bb0a43468_SKMSLogoShieldBrown.png';
const CALENDLY_URL = 'https://calendly.com/skillfulmeans/strategy-session';

export default function MfsReportButton({ data, token }) {
  if (!data || data.locked) return null;

  const { assessment, response_count, composite, instruments } = data;
  const employeeCount = assessment?.employee_count || '';
  const roiUrl = 'https://skillfulmeans-roi-production.up.railway.app/' + (employeeCount ? `?headcount=${encodeURIComponent(employeeCount)}` : '');

  const handlePrint = () => {
    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=1&data=${encodeURIComponent(CALENDLY_URL)}`;

    // ── Dial SVG ──
    const dialSize = 130;
    const radius = (dialSize - 20) / 2;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.max(0, Math.min(100, composite ?? 0));
    const offset = circumference - (clamped / 100) * circumference;
    const dialColor = clamped >= 70 ? '#264d44' : clamped >= 50 ? '#013f7c' : '#770142';

    const dialZones = SCORE_ZONES.composite.zones;
    let _cum = 0;
    const dialZoneArcs = dialZones.map(z => {
      const segStart = _cum;
      const segLen = ((z.max - _cum) / 100) * circumference;
      _cum = z.max;
      return `<circle cx="${dialSize / 2}" cy="${dialSize / 2}" r="${radius}" fill="none" stroke="${z.color}" stroke-width="10" stroke-dasharray="${Math.max(0, segLen - 1.5)} ${circumference - Math.max(0, segLen - 1.5)}" stroke-dashoffset="${-(segStart / 100) * circumference}"/>`;
    }).join('');

    const dialSvg = `
      <svg width="${dialSize}" height="${dialSize}" style="transform: rotate(-90deg)">
        ${dialZoneArcs}
        <circle cx="${dialSize / 2}" cy="${dialSize / 2}" r="${radius}" fill="none" stroke="${dialColor}" stroke-width="10"
          stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
      </svg>
    `;

    // ── Instrument bars ──
    const barsHtml = MFS_INSTRUMENTS.map((inst) => {
      const instData = instruments?.[inst.key];
      const score = instData?.average;
      const zoneDef = SCORE_ZONES[inst.key];
      const zones = zoneDef?.zones || [];
      const zoneLabel = getZone(inst.key, score);
      const interp = getInstrumentInterpretation(inst.key, score);
      const scoreRounded = score != null ? Math.round(score) : '—';
      const evBlock = MFS_EVIDENCE_BLOCKS[inst.key];
      const evBody = evBlock && score != null ? getZoneContextSentence(inst.key, score, zoneLabel) : '';
      let evBandLine = '';
      let evCalloutStyle = '';
      if (evBlock && zoneLabel === 'Low') { evBandLine = evBlock.low; evCalloutStyle = 'background:#fffbeb;border-left:3px solid #f59e0b;'; }
      else if (evBlock && zoneLabel === 'High') { evBandLine = evBlock.strong; evCalloutStyle = 'background:#f0fdf4;border-left:3px solid #15803d;'; }
      const evCta = evBlock?.cta || '';
      const zoneBarsHtml = zones.map((z, i) => {
        const left = i > 0 ? zones[i - 1].max : 0;
        const width = z.max - left;
        return `<div class="bar-zone" style="left:${left}%;width:${width}%;background:${z.color}"></div>`;
      }).join('');
      return `
        <div class="instrument">
          <div class="inst-row">
            <span class="inst-label">${inst.label}</span>
            <span class="inst-score" style="color:${inst.color}">${scoreRounded}${zoneLabel ? ` <span style="font-size:11px;color:#9ca3af;font-weight:normal">· ${zoneLabel}</span>` : ''}</span>
          </div>
          <div class="bar-wrap">
            <div class="bar-track">
              ${zoneBarsHtml}
            </div>
            <div class="bar-marker" style="left:${Math.max(0, Math.min(100, score ?? 0))}%;border-color:${inst.color}"></div>
          </div>
          <div class="inst-meta">${instData?.count || 0} responses · Zone: ${zoneLabel || '—'}</div>
          <p class="inst-interp">${interp}</p>
          ${evBody ? `<div class="inst-evidence"><p class="ev-body">${evBody}</p>${(evBandLine || evCta) ? `<div class="ev-callout" style="${evCalloutStyle}">${evBandLine ? `<div class="ev-callout-band">${evBandLine}</div>` : ''}${evCta ? `<div class="ev-callout-body">${evCta}</div>` : ''}</div>` : ''}</div>` : ''}
        </div>
      `;
    }).join('');

    const compositeInterp = getCompositeInterpretation(composite);

    const printWin = window.open('', '_blank', 'width=820,height=1000');
    printWin.document.write(`
      <html><head><title>Mental Fitness Score — ${assessment.company_name || 'Report'}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Georgia, 'Times New Roman', serif; color: #1f2937; padding: 36px 44px; max-width: 740px; margin: 0 auto; }
        .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #013f7c; padding-bottom: 16px; margin-bottom: 24px; }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .header img { height: 38px; }
        .header-brand { font-size: 13px; color: #6b7280; }
        .header-brand strong { color: #013f7c; font-size: 15px; display: block; }
        .header-date { font-size: 12px; color: #6b7280; text-align: right; }
        h1 { font-size: 22px; color: #013f7c; margin-bottom: 2px; }
        .subtitle { font-size: 13px; color: #6b7280; margin-bottom: 20px; }
        .dial-section { text-align: center; margin-bottom: 20px; }
        .dial-wrap { position: relative; display: inline-block; width: ${dialSize}px; height: ${dialSize}px; }
        .dial-num { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .dial-num .big { font-size: 34px; font-weight: bold; color: #1f2937; font-family: Arial, sans-serif; }
        .dial-num .small { font-size: 10px; color: #9ca3af; font-family: Arial, sans-serif; }
        .dial-label { font-size: 12px; color: #6b7280; margin-top: 6px; }
        .composite-interp { font-size: 13px; line-height: 1.6; color: #374151; background: #f9fafb; border-left: 3px solid #013f7c; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 22px; }
        .instruments-title { font-size: 14px; font-weight: bold; color: #013f7c; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
        .instrument { margin-bottom: 14px; }
        .inst-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
        .inst-label { font-size: 13px; font-weight: bold; color: #374151; font-family: Arial, sans-serif; }
        .inst-score { font-size: 16px; font-weight: bold; font-family: Arial, sans-serif; }
        .bar-wrap { position: relative; height: 10px; }
        .bar-track { position: absolute; top: 0; left: 0; width: 100%; height: 10px; background: #f3f4f6; border-radius: 5px; overflow: hidden; }
        .bar-zone { position: absolute; height: 100%; }
        .bar-marker { position: absolute; top: -2px; height: 14px; width: 3px; border-radius: 2px; background: white; border: 2px solid #374151; transform: translateX(-50%); }
        .inst-meta { font-size: 10px; color: #9ca3af; margin-top: 3px; font-family: Arial, sans-serif; }
        .inst-interp { font-size: 12px; line-height: 1.5; color: #4b5563; margin-top: 5px; }
        .inst-evidence { margin-top: 6px; padding: 8px 10px; background: #f9fafb; border-radius: 6px; }
        .ev-body { font-size: 11px; line-height: 1.5; color: #4b5563; }
        .ev-callout { font-size: 12px; margin-top: 6px; padding: 10px 12px; border-radius: 0 4px 4px 0; line-height: 1.5; }
        .ev-callout-band { font-weight: bold; margin-bottom: 4px; }
        .ev-callout-body { color: #4b5563; font-weight: normal; }
        .disclaimer { font-size: 11px; color: #6b7280; margin-top: 16px; padding: 10px 14px; background: #f9fafb; border-radius: 6px; line-height: 1.5; }
        .disclaimer a { color: #013f7c; }
        .zones-footnote { font-size: 10px; color: #9ca3af; margin-top: 14px; padding-top: 10px; border-top: 1px solid #e5e7eb; line-height: 1.5; }
        .cta-block { margin-top: 24px; display: flex; flex-direction: column; gap: 12px; }
        .cta { display: flex; align-items: center; gap: 16px; border-radius: 10px; padding: 18px 24px; color: white; }
        .cta-primary { background: #770142; }
        .cta-secondary { background: #f8f5f0; border: 2px solid #770142; color: #770142; }
        .cta-qr { width: 80px; height: 80px; border-radius: 6px; flex-shrink: 0; }
        .cta-text h3 { font-size: 15px; margin-bottom: 4px; font-family: Arial, sans-serif; }
        .cta-text p { font-size: 12px; color: #bfdbfe; line-height: 1.4; font-family: Arial, sans-serif; }
        .cta-secondary .cta-text h3 { color: #770142; }
        .cta-secondary .cta-text p { color: #6b7280; }
        .footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; }
        .footer-brand { font-size: 13px; color: #6b7280; }
        .footer-brand strong { color: #013f7c; }
        .footer-created { font-size: 11px; color: #9ca3af; margin-top: 4px; font-style: italic; }
        .meta-line { font-size: 12px; color: #6b7280; margin-bottom: 18px; font-family: Arial, sans-serif; }
        @media print { body { padding: 20px 28px; } .no-print { display: none; } @page { margin: 0.5in; } }
      </style></head><body>
        <div class="header">
          <div class="header-left">
            <img src="${LOGO_URL}" alt="SkillfulMeans" />
            <div class="header-brand"><strong>SkillfulMeans</strong>Wellness</div>
          </div>
          <div class="header-date">${dateStr}</div>
        </div>

        <h1>Mental Fitness Score Report</h1>
        <div class="subtitle">${assessment.company_name || 'Team'} — Confidential team snapshot</div>
        <div class="meta-line">${response_count} anonymized responses · All scores 0–100 (higher = better)</div>

        <div class="dial-section">
          <div class="dial-wrap">
            ${dialSvg}
            <div class="dial-num">
              <span class="big">${composite != null ? Math.round(composite) : '—'}</span>
              <span class="small">out of 100</span>
              ${getZone('composite', composite) ? `<span class="small" style="margin-top:2px">${getZone('composite', composite)} zone</span>` : ''}
            </div>
          </div>
          <div class="dial-label">Composite Mental Fitness Score</div>
        </div>

        <div class="composite-interp">${compositeInterp}</div>

        <div class="instruments-title">Score Breakdown</div>
        ${barsHtml}

        <div class="disclaimer">${MFS_DISCLAIMER.prefix} <a href="${MFS_DISCLAIMER.calendlyUrl}">${MFS_DISCLAIMER.linkText}</a>.</div>

        <div class="zones-footnote">
          <strong>About the zones:</strong> Low, Typical, and High zones follow published research norms for each instrument.
          WHO-5 (Topp et al., 2015) · PSS-4 (Cohen et al., 1983) · UWES-3 (Schaufeli et al., 2006) · UCLA-3 (Hughes et al., 2004).
          Composite zones are the average of the four instruments' boundaries.
        </div>

        <div class="cta-block">
          <div class="cta cta-primary">
            <img class="cta-qr" src="${qrUrl}" alt="Strategy session QR" />
            <div class="cta-text">
              <h3>Book your free strategy session</h3>
              <p>A 30-minute consultation to walk through these results and design a targeted plan for your team. Scan the QR code or visit calendly.com/skillfulmeans/strategy-session.</p>
            </div>
          </div>
          <div class="cta cta-secondary">
            <div class="cta-text">
              <h3>Estimate the impact of a campaign with SkillfulMeans</h3>
              <p>Visit skillfulmeans-roi-production.up.railway.app${employeeCount ? '/?headcount=' + employeeCount : ''} to model your team's ROI.</p>
            </div>
          </div>
        </div>

        <div class="footer">
          <div class="footer-brand"><strong>SkillfulMeans</strong> Wellness · skillfulmeans.life</div>
          <div class="footer-created">Created by William Jackson Psy. D.</div>
        </div>
      </body></html>
    `);
    printWin.document.close();
    printWin.onload = () => { printWin.focus(); printWin.print(); };
  };

  return (
    <div className="bg-[#f8f5f0] rounded-2xl border border-[#e8e0d5] p-5 mb-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-800">Download your full report</p>
        <p className="text-xs text-gray-500 mt-0.5">Printable PDF with score breakdown, zone analysis, and evidence.</p>
      </div>
      <Button onClick={handlePrint} className="bg-[#770142] hover:bg-[#5a0132] text-white gap-2 shrink-0">
        <Download className="w-4 h-4" /> Download
      </Button>
    </div>
  );
}