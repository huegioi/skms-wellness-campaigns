// PENDING WILLIAM'S APPROVAL — content blocks not yet confirmed by William.
// Each block renders under its sub-score bar on the MFS results page
// and in condensed form (first sentence + band line + CTA) in the printable report.

const ROI_ENGINE_BASE = 'https://skillfulmeans-roi-production.up.railway.app/';

export const MFS_EVIDENCE_BLOCKS = {
  who5: {
    body: "The WHO-5 is one of the most widely used wellbeing measures in the world — a low team score is an early-warning signal that often shows up later as medical claims and absence. Hospital-validated mental fitness programs have reduced healthcare utilization by 43% (Mass General Hospital), and proactive programs return an average of $5.30 for every $1 invested (Deloitte, 2024).",
    low: "Your team's wellbeing is below the typical range — the strongest case for acting before this becomes claims and turnover.",
    strong: "Your team's wellbeing is above typical — programming now is about protecting it.",
    cta: "Wellbeing scores respond best to layered support: skills are introduced, then practiced daily until they become habit — behavior research shows roughly two weeks of repetition is what makes a new skill stick (Lally, 2010). One-off events rarely move this number; consistent practice does.",
    sources: [
      { label: 'WHO-5 Validation (Topp et al., 2015)', url: 'https://pubmed.ncbi.nlm.nih.gov/25831962/' },
      { label: 'MGH 3RP Study (Stahl et al., 2015)', url: 'https://doi.org/10.1371/journal.pone.0140212' },
      { label: 'Deloitte Mental Health ROI (2024)', url: 'https://www.deloitte.com/ca/en/services/consulting/analysis/mental-health-roi.html' },
      { label: 'Lally, Habit Formation (2010)', url: 'https://doi.org/10.1002/ejsp.674' },
    ],
  },
  pss4: {
    body: "Chronic stress is the quiet budget line: stressed employees lose roughly 27 productive workdays per year (Kessler, Harvard), and unmanaged stress escalates into ER visits and admissions — mindfulness-based programs cut emergency utilization by up to 50% (Kaiser Permanente). Aetna's own MBSR program measurably recovered productivity.",
    low: "Your team's stress is above the typical range — presenteeism is likely already costing more than a program would.",
    strong: "Stress is well-managed — worth reinforcing before busy seasons test it.",
    cta: "The strongest evidence for reducing workplace stress comes from structured, mindfulness-based group training — the same clinical approach that cut healthcare utilization by 43% at Mass General. Skills first, then daily practice in real work conditions.",
    sources: [
      { label: 'PSS-4 (Cohen et al., 1983)', url: 'https://www.cmu.edu/dietrich/psychology/stress-immunity-disease-lab/publications/scalesmeasurements/pdfs/globalmeas83.pdf' },
      { label: 'Stewart et al., JAMA (2003)', url: 'https://jamanetwork.com/journals/jama/fullarticle/196767' },
      { label: 'McCubbin et al., Kaiser Permanente (2014)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4206164/' },
      { label: 'Aetna Mindfulness (Forbes, 2015)', url: 'https://www.forbes.com/sites/jeannemeister/2015/04/27/future-of-work-mindfulness-as-a-leadership-practice/' },
      { label: 'MGH 3RP (Stahl et al., 2015)', url: 'https://doi.org/10.1371/journal.pone.0140212' },
    ],
  },
  uwes3: {
    body: "Engagement is the sub-score most tightly linked to performance and retention (Harter/Gallup) — and emotional-intelligence skills explain up to 67% of the variance in leadership effectiveness (Goleman). Disengagement rarely fixes itself; it compounds.",
    low: "Below-typical engagement usually reflects skills and leadership gaps, not effort gaps — both are trainable.",
    strong: "Engagement is a strength — leadership EQ programming multiplies it through managers.",
    cta: "Engagement grows when people gain emotional-intelligence skills and see their leaders model them — leadership behavior explains much of the variance in team effectiveness (Goleman; Harter/Gallup). Training the team without equipping its leaders leaves the gain on the table.",
    sources: [
      { label: 'UWES-3 (Schaufeli et al., 2019)', url: 'https://doi.org/10.1027/1015-5759/a000430' },
      { label: 'Gallup Q12 Meta-Analysis (Harter)', url: 'https://www.gallup.com/workplace/321725/gallup-q12-meta-analysis-report.aspx' },
      { label: 'Goleman, "What Makes a Leader" (HBR)', url: 'https://hbr.org/2004/01/what-makes-a-leader' },
    ],
  },
  ucla3: {
    body: "Loneliness at work is the most under-measured driver of turnover and disengagement — most companies have never assessed it. Building genuine team connection improves communication, psychological safety, and retention, and connection skills compound year over year.",
    low: "Your team's connection score is below typical — the most common finding in hybrid and remote teams, and one of the most fixable.",
    strong: "Strong connection — a real cultural asset worth naming and protecting.",
    cta: "Connection is built through structured shared experience — teams that practice together, especially across remote and hybrid distance, rebuild belonging measurably. It's the most trainable of the four scores, and gains compound.",
    sources: [
      { label: 'UCLA-3 Loneliness Scale (Hughes et al., 2004)', url: 'https://doi.org/10.1177/0164027504268574' },
      { label: 'Workplace Loneliness Research', url: ROI_ENGINE_BASE + '#studies' },
    ],
  },
};

export const MFS_DISCLAIMER = {
  prefix: "These are population-validated instruments, not diagnoses. For a walk-through of your results:",
  linkText: "book your free strategy session",
  calendlyUrl: 'https://calendly.com/skillfulmeans/strategy-session',
};

export function getFirstSentence(text) {
  if (!text) return '';
  const match = text.match(/[^.!?]+[.!?]+/);
  return match ? match[0].trim() : text;
}

export function getZoneContextSentence(instrumentKey, score, zoneLabel) {
  const block = MFS_EVIDENCE_BLOCKS[instrumentKey];
  if (!block || score == null || !zoneLabel) return '';
  const firstSentence = getFirstSentence(block.body);
  return `Your team scored ${Math.round(score)} — in the ${zoneLabel} zone. ${firstSentence}`;
}