import React from 'react';
import { renderToString } from 'react-dom/server';
import ResultsView from '@/components/fitnessroi/ResultsView';
import RoiComparison from '@/components/fitnessroi/dashboard/RoiComparison';
import { runRoi, participationFrom } from '@/lib/roiModel';
import { MemoryRouter } from 'react-router-dom';

const inputs = {
  employees: 1000, avgSalary: 75000, stressRate: 0.35, turnoverRate: 0.15,
  absDays: 4.2, participRate: participationFrom({}), stageNum: 3, wellnessFund: 5000,
};
const scores = { composite: 52, pss4: 44, who5: 51, uwes3: 58, ucla3: 49 };
const data = { quick_scores: scores, roi_snapshot: { inputs, outputs: runRoi(inputs) }, magic_key: 'demo' };

let fails = 0;
function tryRender(name, el) {
  try {
    const html = renderToString(el);
    console.log(`  ${name.padEnd(16)} OK  ${html.length.toLocaleString()} chars`);
    return html;
  } catch (e) {
    fails++; console.log(`  ${name.padEnd(16)} FAIL  ${e.message}`); return '';
  }
}

console.log('SSR smoke test');
const a = tryRender('ResultsView', <MemoryRouter><ResultsView data={data} /></MemoryRouter>);
const b = tryRender('RoiComparison', <RoiComparison
  preliminaryRoi={runRoi(inputs)} teamRoi={runRoi({ ...inputs, stressRate: 0.41 })}
  roiInputs={inputs} stressRateReal={0.41}
  leaderScores={scores} teamScores={{ ...scores, composite: 47 }} />);

const must = [
  ['participation builder', a, 'How you run it matters'],
  ['always-on raffle',      a, 'raffled among the people who take part'],
  ['four drivers only',     a, 'four cost drivers we can evidence'],
  ['client range',          a, 'Three numbers, not one'],
  ['scenario range',        b, 'Scenario range'],
  ['benchmarks',            b, 'Against published benchmarks'],
  ['ceiling label',         b, 'Ceiling of research-based effect'],
  ['conservative internal', b, 'internal'],
];
console.log('\ncontent checks');
for (const [label, html, needle] of must) {
  const ok = html.includes(needle);
  if (!ok) fails++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
}
const banned = [["Workers' Comp", a + b], ['7.11', a + b], ['health premium', (a + b).toLowerCase()]];
console.log('\nbanned strings');
for (const [needle, html] of banned) {
  const bad = html.includes(needle);
  if (bad) fails++;
  console.log(`  ${bad ? 'FAIL' : 'PASS'}  absent: ${needle}`);
}
console.log('\n' + (fails ? `${fails} FAILURES` : 'ALL PASS'));
process.exit(fails ? 1 : 0);
