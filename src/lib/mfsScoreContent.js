// PENDING WILLIAM'S APPROVAL — content blocks not yet confirmed by William.
// Each block renders under its sub-score bar on the MFS results page
// and in condensed form (first sentence + band line + CTA) in the printable report.

const ROI_ENGINE_BASE = 'https://skillfulmeans-roi-production.up.railway.app/';

export const MFS_EVIDENCE_BLOCKS = {
  who5: {
    body: "The WHO-5 is one of the most widely used wellbeing measures in the world — a low team score is an early-warning signal that often shows up later as medical claims and absence. Hospital-validated mental fitness programs have reduced healthcare utilization by 43% (Mass General Hospital), and proactive programs return an average of $5.30 for every $1 invested (Deloitte, 2024).",
    low: "Your team's wellbeing is below the typical range — the strongest case for acting before this becomes claims and turnover.",
    strong: "Your team's wellbeing is above typical — programming now is about protecting it.",
    cta: "Wellbeing responds fastest to a full campaign — workshops that build skills, challenges that make them habits.",
    sources: [
      { label: 'WHO-5 Validation Studies', url: ROI_ENGINE_BASE + '#studies' },
      { label: 'Healthcare Utilization Data', url: ROI_ENGINE_BASE + '#clinical-data' },
    ],
  },
  pss4: {
    body: "Chronic stress is the quiet budget line: stressed employees lose roughly 27 productive workdays per year (Kessler, Harvard), and unmanaged stress escalates into ER visits and admissions — mindfulness-based programs cut emergency utilization by up to 50% (Kaiser Permanente). Aetna's own MBSR program measurably recovered productivity.",
    low: "Your team's stress is above the typical range — presenteeism is likely already costing more than a program would.",
    strong: "Stress is well-managed — worth reinforcing before busy seasons test it.",
    cta: "Our stress-reduction workshops use the same evidence base (MBSR), paired with a 14-day challenge that turns relief into routine.",
    sources: [
      { label: 'Stress & Productivity Studies', url: ROI_ENGINE_BASE + '#studies' },
      { label: 'MBSR Clinical Data', url: ROI_ENGINE_BASE + '#clinical-data' },
    ],
  },
  uwes3: {
    body: "Engagement is the sub-score most tightly linked to performance and retention (Harter/Gallup) — and emotional-intelligence skills explain up to 67% of the variance in leadership effectiveness (Goleman). Disengagement rarely fixes itself; it compounds.",
    low: "Below-typical engagement usually reflects skills and leadership gaps, not effort gaps — both are trainable.",
    strong: "Engagement is a strength — leadership EQ programming multiplies it through managers.",
    cta: "Growth-mindset workshops and Leadership EQ are built for exactly this score.",
    sources: [
      { label: 'Engagement & Retention Studies', url: ROI_ENGINE_BASE + '#studies' },
      { label: 'Leadership EQ Data', url: ROI_ENGINE_BASE + '#clinical-data' },
    ],
  },
  ucla3: {
    body: "Loneliness at work is the most under-measured driver of turnover and disengagement — most companies have never assessed it. Building genuine team connection improves communication, psychological safety, and retention, and connection skills compound year over year.",
    low: "Your team's connection score is below typical — the most common finding in hybrid and remote teams, and one of the most fixable.",
    strong: "Strong connection — a real cultural asset worth naming and protecting.",
    cta: "Creating Connections — our workshop plus 14-day community challenge — was designed for this exact score.",
    sources: [
      { label: 'Workplace Loneliness Studies', url: ROI_ENGINE_BASE + '#studies' },
      { label: 'Connection & Retention Data', url: ROI_ENGINE_BASE + '#clinical-data' },
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