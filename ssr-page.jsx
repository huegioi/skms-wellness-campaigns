import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import fs from 'fs';
import ResultsView from '@/components/fitnessroi/ResultsView';
import RoiComparison from '@/components/fitnessroi/dashboard/RoiComparison';
import { runRoi, participationFrom } from '@/lib/roiModel';

const inputs = {
  employees: 1000, avgSalary: 75000, stressRate: 0.35, turnoverRate: 0.15,
  absDays: 4.2, participRate: participationFrom({ optOut: true, workday: true }),
  stageNum: 3, wellnessFund: 5000,
  participConditions: { optOut: true, workday: true },
};
const scores = { composite: 52, pss4: 44, who5: 51, uwes3: 58, ucla3: 49 };
const data = { quick_scores: scores, roi_snapshot: { inputs, outputs: runRoi(inputs) }, magic_key: 'demo' };

const pub = renderToString(<MemoryRouter><ResultsView data={data} hideCta /></MemoryRouter>);
const dash = renderToString(<RoiComparison
  preliminaryRoi={runRoi(inputs)} teamRoi={runRoi({ ...inputs, stressRate: 0.41 })}
  roiInputs={inputs} stressRateReal={0.41}
  leaderScores={scores} teamScores={{ ...scores, composite: 47 }} />);

fs.writeFileSync('/app/ssr-page.html', `<!doctype html><html><head><meta charset="utf-8">
<script src="https://cdn.tailwindcss.com"></script>
<style>body{background:#faf9f7;font-family:Inter,system-ui,sans-serif}
.lbl{font:600 11px ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#a8a29e;margin:26px 0 8px}</style>
</head><body><div style="max-width:820px;margin:0 auto;padding:28px">
<div class="lbl">Buyer sees · Journey result</div>${pub}
<div class="lbl">Your team sees · Journey dashboard</div>${dash}
</div></body></html>`);
console.log('written');
