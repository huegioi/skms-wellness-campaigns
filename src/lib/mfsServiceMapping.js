// Maps MFS instrument scores to suggested services for Curriculum Designer prefill.
// Weakest sub-scores drive the suggestions; William can edit before saving.

export const MFS_SERVICE_MAPPING = {
  pss4: {
    label: 'Stress',
    workshopKeywords: ['stress', 'burnout', 'mindfulness'],
    challengeKeywords: ['calm'],
  },
  ucla3: {
    label: 'Connection',
    workshopKeywords: ['connection', 'community'],
    challengeKeywords: ['connection'],
  },
  uwes3: {
    label: 'Engagement',
    workshopKeywords: ['growth'],
    leadershipKeywords: ['growth', 'leadership'],
  },
  who5: {
    label: 'Wellbeing',
    fullCampaign: true,
  },
};

// Given MFS instrument averages and the live service catalog, returns suggested
// service IDs grouped by selection category, plus human-readable labels.
export function suggestServicesFromMfs(instruments, allServices) {
  const empty = { workshops: [], challengePrograms: [], leadership: [], movementClasses: [], labels: [] };
  if (!instruments || !allServices || allServices.length === 0) return empty;

  // Sort instruments by score ascending (weakest first)
  const sorted = Object.entries(instruments)
    .filter(([key, data]) => data && data.average != null)
    .sort((a, b) => a[1].average - b[1].average);

  if (sorted.length === 0) return empty;

  const workshops = new Set();
  const challengePrograms = new Set();
  const leadership = new Set();
  const movementClasses = new Set();
  const labels = [];

  for (const [key, data] of sorted) {
    const mapping = MFS_SERVICE_MAPPING[key];
    if (!mapping) continue;
    labels.push(`${mapping.label}: ${Math.round(data.average)}/100`);

    if (mapping.fullCampaign) {
      // Suggest one from each category
      const first = (cat) => allServices.find(s => s.category === cat && s.is_active !== false);
      const w = first('workshop');     if (w) workshops.add(w.id);
      const ch = first('challenge');   if (ch) challengePrograms.add(ch.id);
      const ld = first('leadership');  if (ld) leadership.add(ld.id);
      const cl = first('class');       if (cl) movementClasses.add(cl.id);
      continue;
    }

    const matchByKeywords = (category, keywords) => {
      for (const svc of allServices) {
        if (svc.category !== category || svc.is_active === false) continue;
        const name = (svc.name || '').toLowerCase();
        if (keywords.some(kw => name.includes(kw))) {
          if (category === 'workshop') workshops.add(svc.id);
          else if (category === 'challenge') challengePrograms.add(svc.id);
          else if (category === 'leadership') leadership.add(svc.id);
          else if (category === 'class') movementClasses.add(svc.id);
        }
      }
    };

    if (mapping.workshopKeywords) matchByKeywords('workshop', mapping.workshopKeywords);
    if (mapping.challengeKeywords) matchByKeywords('challenge', mapping.challengeKeywords);
    if (mapping.leadershipKeywords) matchByKeywords('leadership', mapping.leadershipKeywords);
  }

  return {
    workshops: Array.from(workshops),
    challengePrograms: Array.from(challengePrograms),
    leadership: Array.from(leadership),
    movementClasses: Array.from(movementClasses),
    labels,
  };
}