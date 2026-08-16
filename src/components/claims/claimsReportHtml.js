/**
 * Builds the five report pages (build plan §6) as self-contained HTML
 * strings for the PDF pipeline (claimsPdf.js). The on-screen profile view
 * renders the same content in React; THIS file is only for the printed
 * artifact, so styles are inline and conservative.
 *
 *   Page 1 — Mental Health Risk Profile (subscores, bands, reasoning, confidence)
 *   Page 2 — The hidden cost (range + method; Milliman framing)
 *   Page 3 — Recommended campaign (signal-by-signal, priced via the rate card)
 *   Page 4 — Clinical referral pathway (the boundary, applied; EAP reach plan)
 *   Page 5 — Method and citations (evidence per subscore, limitations)
 */
import { HONESTY_RAILS, REFERRAL_BOUNDARY, SUBSCORE_EVIDENCE, CLAIMS_BLOCKS, formatFieldValue, fieldByKey } from './claimsFields';

const LOGO_URL = 'https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/bb0a43468_SKMSLogoShieldBrown.png';

const BROWN = '#6b4a35';
const CREAM = '#f4f0e9';
const BAND_COLORS = { Low: '#1a7f4e', Elevated: '#b45309', High: '#b91c1c' };

const money = (n) => '$' + Math.round(n).toLocaleString();
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function pageShell(title, subtitle, bodyHtml, pageNum) {
  return `
  <div style="font-family:Georgia,'Times New Roman',serif;color:#232323;background:#ffffff;padding:56px 64px 48px;box-sizing:border-box;min-height:1294px;position:relative">
    <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid ${BROWN};padding-bottom:14px;margin-bottom:26px">
      <div>
        <p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${BROWN};font-weight:bold">SkillfulMeans · Claims Insight</p>
        <h1 style="margin:6px 0 0;font-size:26px;color:#1c1c1c">${esc(title)}</h1>
        ${subtitle ? `<p style="margin:4px 0 0;font-size:13px;color:#777">${esc(subtitle)}</p>` : ''}
      </div>
      <img src="${LOGO_URL}" style="width:64px;height:64px;object-fit:contain" />
    </div>
    ${bodyHtml}
    <div style="position:absolute;bottom:22px;left:64px;right:64px;display:flex;justify-content:space-between;border-top:1px solid #e5e0d8;padding-top:8px">
      <p style="margin:0;font-size:10px;color:#999">Educational estimates from aggregate, de-identified data — not medical or actuarial advice.</p>
      <p style="margin:0;font-size:10px;color:#999">Page ${pageNum} of 5</p>
    </div>
  </div>`;
}

function railsBox() {
  return `
  <div style="background:${CREAM};border-radius:10px;padding:14px 18px;margin-top:22px">
    <p style="margin:0 0 6px;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${BROWN}">How to read this honestly</p>
    ${HONESTY_RAILS.map(r => `<p style="margin:3px 0;font-size:11px;color:#555;line-height:1.5">• ${esc(r)}</p>`).join('')}
  </div>`;
}

function subscoreCard(s) {
  const color = BAND_COLORS[s.band] || '#9ca3af';
  return `
  <div style="border:1px solid #e5e0d8;border-radius:10px;padding:16px 18px;margin-bottom:12px">
    <div style="display:flex;align-items:baseline;justify-content:space-between">
      <p style="margin:0;font-size:15px;font-weight:bold;color:#1c1c1c">${esc(s.label)}${s.key === 'unmet_need_gap' ? ' <span style="font-size:11px;color:' + BROWN + '">← flagship</span>' : ''}</p>
      <p style="margin:0"><span style="font-size:24px;font-weight:bold;color:${color}">${s.score ?? '—'}</span>
        <span style="font-size:13px;font-weight:bold;color:${color};margin-left:6px">${s.band || 'not in report'}</span></p>
    </div>
    <p style="margin:6px 0 0;font-size:12px;color:#666;line-height:1.5">${esc(s.method)}</p>
  </div>`;
}

export function buildClaimsReportPages(profile, { quote = null, stageInfo = null } = {}) {
  const { company_name, report_year, inputs = {}, results = {} } = profile;
  const r = results;
  const subs = r.subscores || {};
  const campaign = r.campaign || {};
  const sub = `${esc(company_name)} · ${inputs.headcount ? Number(inputs.headcount).toLocaleString() + ' employees' : ''}${inputs.industry ? ' · ' + esc(inputs.industry) : ''}${report_year ? ' · report year ' + report_year : ''}`;

  // ── Page 1 — Risk profile ──
  const providedBlocks = CLAIMS_BLOCKS
    .map(b => ({ b, n: b.fields.filter(f => inputs[f.key] !== undefined && inputs[f.key] !== '').length }))
    .map(({ b, n }) => `${b.key} (${n}/${b.fields.length})`).join(' · ');
  const page1 = pageShell('Mental Health Risk Profile', sub, `
    ${Object.values(subs).map(subscoreCard).join('')}
    <div style="border:1px solid #e5e0d8;border-radius:10px;padding:12px 18px;background:#fafaf7">
      <p style="margin:0;font-size:12px;color:#555"><b>Data confidence: ${esc(r.confidence || '—')}</b> — ${r.fieldsProvided ?? '?'} of ${r.fieldsCounted ?? 11} key report fields provided.
      Fields entered by block: ${providedBlocks}. Every conclusion in this report is qualified by this.</p>
    </div>
    ${railsBox()}
  `, 1);

  // ── Page 2 — Hidden cost ──
  const hc = r.hiddenCost;
  let visibleBh = null;
  if (inputs.pmpm && inputs.bhSpendShare && inputs.headcount) {
    visibleBh = Number(inputs.headcount) * Number(inputs.pmpm) * 12 * Number(inputs.bhSpendShare);
  }
  const page2 = pageShell('The Hidden Cost', sub, hc ? `
    <p style="font-size:14px;color:#444;line-height:1.6;margin:0 0 18px">
      Correcting the identified burden for what claims data is known to miss puts estimated true
      depression/anxiety prevalence at <b>${(hc.correctedPrevalence * 100).toFixed(1)}%</b> —
      roughly <b>${Math.round(hc.affectedEmployees).toLocaleString()} employees</b>. At published
      per-case productivity-loss figures, adjusted to this workforce's average salary, that costs:
    </p>
    <div style="background:${CREAM};border-radius:12px;padding:26px;text-align:center;margin-bottom:18px">
      <p style="margin:0;font-size:34px;font-weight:bold;color:${BROWN}">${money(hc.low)} – ${money(hc.high)}</p>
      <p style="margin:6px 0 0;font-size:13px;color:#777">estimated annual presenteeism + absenteeism cost — a range, not a promise</p>
    </div>
    ${visibleBh !== null ? `
    <div style="border:1px solid #e5e0d8;border-radius:10px;padding:14px 18px;margin-bottom:18px">
      <p style="margin:0;font-size:13px;color:#444;line-height:1.6">
        Visible behavioral health medical spend runs ≈ <b>${money(visibleBh)}</b>/year
        (${(Number(inputs.bhSpendShare) * 100).toFixed(1)}% of ≈ ${money(Number(inputs.headcount) * Number(inputs.pmpm) * 12)} total paid,
        treating enrolled employees as members). The hidden productivity cost above is
        <b>${(hc.low / visibleBh).toFixed(1)}–${(hc.high / visibleBh).toFixed(1)}×</b> that line —
        the typical published pattern is 2–5×. Most of the cost of distress never appears on the BH line.
      </p>
    </div>` : ''}
    <p style="font-size:12px;color:#666;line-height:1.7;margin:0 0 8px"><b>The Milliman frame applied here:</b>
      in a 21-million-member commercial book, the 27% of members with behavioral comorbidity drove 56.5%
      of total spend — yet only 4.4% of spend went to behavioral treatment. A heavy comorbidity shadow with a
      thin behavioral line (this report${subs.unmetNeedGap?.band ? `: unmet-need gap <b>${subs.unmetNeedGap.band}</b>` : ''})
      is that signature in miniature.</p>
    <p style="font-size:11px;color:#888;line-height:1.6;margin:0"><b>Method.</b> Estimated true prevalence = max(coded prevalence,
      antidepressant utilization × ${'≈'}0.65 depression-attribution) × ${'≈'}1.4 under-detection correction, capped at 25%
      (Gardarsdottir et al.; PMID 30680859; claims-validation literature). Cost = affected employees × per-case annual
      productivity loss (Stewart, JAMA 2003; Goetzel 2004; inflation-adjusted, salary-scaled) × 0.7–1.3 range multipliers.
      Claims lag 3–12 months; the true figure moves with detection, not with need.</p>
  ` : `
    <p style="font-size:14px;color:#666;line-height:1.6">The report did not include enough fields to estimate hidden cost
    (needs headcount, average salary, and either coded prevalence or antidepressant utilization). This is shown as
    missing rather than $0 — absence of data is not absence of cost.</p>
  `, 2);

  // ── Page 3 — Recommended campaign ──
  const page3 = pageShell('Recommended Campaign', sub, `
    <p style="font-size:13px;color:#444;line-height:1.6;margin:0 0 14px">
      Recommendations follow stepped-care logic: match intensity to need, sequence for habit formation, always
      measure. Buffet-style one-off offerings show <i>no average benefit</i> in the largest workplace-wellbeing
      dataset (Fleming 2024) — which is why this is a sequenced campaign, not a menu.
    </p>
    ${(campaign.signals || []).map(sig => `
      <div style="border:1px solid #e5e0d8;border-radius:10px;padding:13px 16px;margin-bottom:10px">
        <p style="margin:0 0 4px;font-size:13px;font-weight:bold;color:#1c1c1c">${esc(sig.label)}</p>
        <p style="margin:0 0 4px;font-size:11px;color:#888"><b>Signal:</b> ${esc(sig.trigger)}</p>
        <p style="margin:0 0 4px;font-size:12px;color:#444"><b>Response:</b> ${esc(sig.response)}</p>
        <p style="margin:0;font-size:11px;color:#888"><b>Mechanism:</b> ${esc(sig.mechanism)}</p>
      </div>`).join('')}
    ${stageInfo ? `
    <div style="background:${CREAM};border-radius:12px;padding:18px 20px;margin:16px 0">
      <p style="margin:0 0 2px;font-size:15px;font-weight:bold;color:${BROWN}">Suggested tier: Stage ${campaign.stage} — ${esc(stageInfo.name)}</p>
      <p style="margin:0 0 8px;font-size:12px;color:#777;font-style:italic">${esc(stageInfo.tagline)}</p>
      <p style="margin:0;font-size:12px;color:#555;line-height:1.6">${esc(campaign.stageRationale || '')}</p>
      ${quote ? `
      <div style="margin-top:12px;border-top:1px solid #ded7cb;padding-top:10px">
        ${quote.lines.map(l => `<p style="margin:3px 0;font-size:12px;color:#444;display:flex;justify-content:space-between"><span>${esc(l.label)}</span><b>${money(l.amount)}</b></p>`).join('')}
        <p style="margin:8px 0 0;font-size:14px;color:#1c1c1c;display:flex;justify-content:space-between;border-top:1px solid #ded7cb;padding-top:8px"><b>Campaign total (per campaign)</b><b>${money(quote.total)}</b></p>
        <p style="margin:4px 0 0;font-size:10px;color:#999">Priced from the live SkillfulMeans rate card at ${Number(inputs.headcount).toLocaleString()} employees; workshop sections scale per 1,000 employees.</p>
      </div>` : ''}
    </div>` : ''}
    <p style="margin:0 0 4px;font-size:12px;font-weight:bold;color:#1c1c1c">Sequence</p>
    ${(campaign.sequence || []).map((s, i) => `<p style="margin:2px 0;font-size:12px;color:#555">${i + 1}. ${esc(s)}</p>`).join('')}
    <p style="margin:12px 0 4px;font-size:12px;font-weight:bold;color:#1c1c1c">Measurement plan</p>
    ${(campaign.measurementPlan || []).map(s => `<p style="margin:2px 0;font-size:12px;color:#555">• ${esc(s)}</p>`).join('')}
    <p style="margin:12px 0 0;font-size:11px;color:#888;font-style:italic">${esc(campaign.expectedOutcomeLanguage || '')}</p>
  `, 3);

  // ── Page 4 — Clinical referral pathway ──
  const page4 = pageShell('Clinical Referral Pathway', sub, `
    <p style="font-size:13px;color:#444;line-height:1.6;margin:0 0 14px">
      This page is deliberate: it names what SkillfulMeans does <b>not</b> treat. Scaled depression/anxiety
      treatment returns ~4:1 in productivity (Chisholm 2016) — recommending therapy is not lost revenue, it is
      what makes the programming recommendation trustworthy.
    </p>
    ${(r.referralFlags || []).length ? `
    <div style="margin-bottom:16px">
      ${(r.referralFlags || []).map(f => `
        <div style="border-left:4px solid ${f.key === 'eap_reach' ? '#b45309' : '#b91c1c'};background:#fdf7f4;border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:8px">
          <p style="margin:0;font-size:12px;color:#5c2323;line-height:1.5">${esc(f.text)}</p>
        </div>`).join('')}
    </div>` : `<p style="font-size:12px;color:#666;margin:0 0 14px">No clinical-severity flags fired on the provided fields. The boundary below still applies to anything the data did not show.</p>`}
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <tr style="background:${CREAM}">
        <th style="text-align:left;padding:8px 10px;color:${BROWN};border:1px solid #e5e0d8">Signal</th>
        <th style="text-align:left;padding:8px 10px;color:${BROWN};border:1px solid #e5e0d8">Belongs with</th>
        <th style="text-align:left;padding:8px 10px;color:${BROWN};border:1px solid #e5e0d8">SkillfulMeans' role</th>
      </tr>
      ${REFERRAL_BOUNDARY.map(row => `
      <tr>
        <td style="padding:7px 10px;border:1px solid #e5e0d8;color:#444;line-height:1.4">${esc(row.signal)}</td>
        <td style="padding:7px 10px;border:1px solid #e5e0d8;color:#444;line-height:1.4">${esc(row.belongsWith)}</td>
        <td style="padding:7px 10px;border:1px solid #e5e0d8;color:#666;line-height:1.4">${esc(row.role)}</td>
      </tr>`).join('')}
    </table>
    <p style="margin:14px 0 0;font-size:11px;color:#888;line-height:1.6">
      In crisis, call or text <b>988</b> (Suicide & Crisis Lifeline). SkillfulMeans designs the handoff —
      awareness content, manager response training, EAP re-introduction — and never treats.
    </p>
  `, 4);

  // ── Page 5 — Method and citations ──
  const bmUsed = profile.benchmarks_used || {};
  const keyBms = [
    ['Antidepressant utilization benchmark', 'adUtilizationBenchmark', v => (v * 100).toFixed(1) + '%'],
    ['BH % of spend benchmark', 'bhSpendShareBenchmark', v => (v * 100).toFixed(1) + '%'],
    ['Coded prevalence benchmark', 'codedPrevalenceBenchmark', v => (v * 100).toFixed(0) + '%'],
    ['ER visits/1,000 benchmark', 'erVisitsPer1000Benchmark', v => v],
    ['EAP utilization benchmark', 'eapUtilizationBenchmark', v => (v * 100).toFixed(0) + '%'],
    ['Under-detection correction', 'underDetectionFactor', v => '×' + v],
    ['AD → depression attribution', 'adDepressionAttribution', v => v],
    ['Per-case productivity loss', 'productivityLossPerCase', v => money(v) + ' at ' + money(bmUsed.referenceSalary || 60000) + ' ref salary'],
    ['Band cutoffs (Low/Elevated/High)', 'bandLowElevated', () => `${bmUsed.bandLowElevated ?? 35} / ${bmUsed.bandElevatedHigh ?? 65}`],
  ];
  const enteredRows = Object.entries(inputs)
    .map(([k, v]) => { const f = fieldByKey(k); return f ? `<tr><td style="padding:4px 10px;border:1px solid #e5e0d8;color:#555">${esc(f.label)}</td><td style="padding:4px 10px;border:1px solid #e5e0d8;color:#222;text-align:right">${esc(formatFieldValue(f, v))}</td></tr>` : ''; })
    .join('');
  const page5 = pageShell('Method & Citations', sub, `
    ${SUBSCORE_EVIDENCE.map(e => `
      <div style="margin-bottom:10px">
        <p style="margin:0;font-size:12px;font-weight:bold;color:#1c1c1c">${esc(e.label)}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#555;line-height:1.5">${esc(e.logic)}</p>
        <p style="margin:2px 0 0;font-size:10px;color:#888;line-height:1.5"><i>${esc(e.evidence)}</i></p>
      </div>`).join('')}
    <p style="margin:14px 0 6px;font-size:12px;font-weight:bold;color:#1c1c1c">Benchmarks in effect when this profile was scored</p>
    <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:14px">
      ${keyBms.map(([label, key, fmt]) => bmUsed[key] !== undefined || key === 'bandLowElevated' ? `
        <tr><td style="padding:4px 10px;border:1px solid #e5e0d8;color:#555">${esc(label)}</td>
        <td style="padding:4px 10px;border:1px solid #e5e0d8;color:#222;text-align:right">${fmt(bmUsed[key])}</td></tr>` : '').join('')}
    </table>
    <p style="margin:0 0 6px;font-size:12px;font-weight:bold;color:#1c1c1c">Report fields as entered (aggregate only)</p>
    <table style="width:100%;border-collapse:collapse;font-size:10px">${enteredRows}</table>
    <p style="margin:12px 0 0;font-size:10px;color:#888;line-height:1.6">
      Full citations: "Reading Mental Health Risk in Employer Claims Data" (SkillfulMeans literature review).
      Key sources: CDC/NCHS Data Brief 377; Milliman Research Report 2020 (Davenport et al.); Stewart et al., JAMA 2003;
      Goetzel et al., JOEM 2004; Fiest et al. 2014 (claims validation); Gardarsdottir et al. (antidepressant indications);
      PMID 30680859 (predictive algorithm); Chisholm et al., Lancet Psychiatry 2016 (treatment ROI 4:1); Fleming, 2024
      (Oxford wellbeing dataset); Gayed et al. 2018 (manager training); Tan 2014; Bartlett 2019 (workplace CBT/mindfulness RCTs).
    </p>
    ${railsBox()}
  `, 5);

  return [page1, page2, page3, page4, page5];
}
