/**
 * check:claims — the Claims Insight drift test.
 *
 * Bundles the shared scoring engine (Node 20 here can't strip TS types
 * natively, so esbuild does it) and then:
 *   1. verifyClaimsScoring()          — the engine must reproduce the Phase 1
 *      worksheet's example company EXACTLY (51/59/90/90, 11.2% prevalence,
 *      $377,626.67–$701,306.67) plus the sparse-input honesty rules.
 *   2. verifyClaimsBenchmarkIntegrity() — the shipped defaults must satisfy
 *      every structural rule the admin tab enforces on saves.
 *
 * Run:  npm run check:claims
 * Exits non-zero on any failure. Same pattern as the rate card drift test.
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;
const dir = mkdtempSync(join(tmpdir(), 'claims-check-'));
try {
  const entry = join(dir, 'entry.mjs');
  writeFileSync(entry, `
    export { verifyClaimsScoring, scoreClaimsProfile, WORKSHEET_EXAMPLE_INPUTS } from '${root}base44/shared/claimsScoring.ts';
    export { verifyClaimsBenchmarkIntegrity } from '${root}base44/shared/claimsBenchmarks.ts';
  `);
  const out = join(dir, 'bundle.mjs');
  execSync(`npx esbuild ${entry} --bundle --format=esm --platform=neutral --outfile=${out}`, { stdio: 'pipe' });

  const mod = await import(pathToFileURL(out).href);
  const acceptance = mod.verifyClaimsScoring();
  const integrity = mod.verifyClaimsBenchmarkIntegrity();

  const r = mod.scoreClaimsProfile(mod.WORKSHEET_EXAMPLE_INPUTS);
  const line = Object.values(r.subscores).map(s => `${s.score} ${s.band}`).join(' | ');

  if (acceptance.length || integrity.length) {
    console.error('CLAIMS CHECK FAILED');
    for (const f of acceptance) console.error('  acceptance:', f);
    for (const f of integrity) console.error('  integrity:', f);
    process.exit(1);
  }
  console.log('check:claims OK — worksheet example reproduces exactly:', line,
    `· prev ${(r.hiddenCost.correctedPrevalence * 100).toFixed(1)}%`,
    `· $${Math.round(r.hiddenCost.low).toLocaleString()}–$${Math.round(r.hiddenCost.high).toLocaleString()}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
