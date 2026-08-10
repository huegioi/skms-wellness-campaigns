import React from 'react';
import { renderToString } from 'react-dom/server';
import fs from 'fs';
import ScenarioRange from '@/components/fitnessroi/ScenarioRange';
import ScenarioRangeChart from '@/components/fitnessroi/dashboard/ScenarioRangeChart';
import BenchmarkChart from '@/components/fitnessroi/dashboard/BenchmarkChart';
import { runRoi, participationFrom } from '@/lib/roiModel';

const base = {
  employees: 1000, avgSalary: 75000, turnoverRate: 0.15, absDays: 4.2,
  participRate: participationFrom({ optOut: true, workday: true }), stageNum: 3, wellnessFund: 0,
};
const hot = runRoi({ ...base, stressRate: 0.41 }).scenarios;   // optimistic breaches ceiling
const norm = runRoi({ ...base, stressRate: 0.30 }).scenarios;  // all under ceiling

const card = (t, inner) => `<div style="background:#fff;border:1px solid #e7e5e4;border-left:4px solid #0f766e;border-radius:16px;padding:24px;margin-bottom:20px">
<div style="font:600 10px ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:#a8a29e;margin-bottom:12px">${t}</div>${inner}</div>`;

fs.writeFileSync('/app/ssr-fix.html', `<!doctype html><html><head><meta charset="utf-8">
<script src="https://cdn.tailwindcss.com"></script>
<style>body{background:#faf9f7;font-family:Inter,system-ui,sans-serif}</style></head>
<body><div style="max-width:780px;margin:0 auto;padding:24px">
${card('Buyer view · optimistic breaches ceiling (withheld)', renderToString(<ScenarioRange scenarios={hot} />))}
${card('Buyer view · normal case (all three shown)', renderToString(<ScenarioRange scenarios={norm} />))}
${card('Dashboard · scenario range', renderToString(<ScenarioRangeChart scenarios={hot} headcount={1000} />))}
${card('Dashboard · benchmarks', renderToString(<BenchmarkChart scenarios={hot} />))}
</div></body></html>`);
console.log('ok');
