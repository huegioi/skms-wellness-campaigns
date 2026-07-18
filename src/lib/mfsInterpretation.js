// Mental Fitness Score — plain-language interpretations for reports and dashboards.
// Non-clinical, warm, evidence-led. No jargon.

export function getInstrumentInterpretation(instrumentKey, score) {
  const s = score != null ? Math.round(score) : null;
  if (s == null) return 'Not enough responses yet to show this score.';
  switch (instrumentKey) {
    case 'who5':
      if (s < 50)
        return 'Many team members may be running low on energy and positive feelings. This is a signal to act, not a diagnosis — the right program can lift wellbeing meaningfully within weeks.';
      if (s < 68)
        return 'Your team is getting by, but some people are likely running on empty. Targeted wellbeing support can help shift this from "okay" to "genuinely thriving."';
      return 'Most of your team feels cheerful, calm, and rested day to day. This is a strong foundation — protect it by sustaining the practices that got you here.';
    case 'pss4':
      if (s < 50)
        return 'Stress feels overwhelming for a meaningful share of the team. People may be carrying more than they can recover from on their own.';
      if (s < 72)
        return "Day-to-day pressure is manageable for most people, but there's room to help everyone recover faster and feel less stretched.";
      return 'Most people feel they can handle the pressures they face. Stress isn\'t absent — it\'s just not accumulating faster than people can reset.';
    case 'uwes3':
      if (s < 55)
        return 'Many team members may be going through the motions rather than feeling energized by their work. This often points to a need for more meaning, autonomy, or recognition.';
      if (s < 75)
        return "People are engaged with their work, though some may be coasting. There's an opportunity to deepen the sense of purpose and energy.";
      return 'Your team feels energized and absorbed by their work. People find what they do meaningful — one of the strongest buffers against burnout.';
    case 'ucla3':
      if (s < 48)
        return 'Connection is a weak spot. A meaningful share of your team feels isolated — even in a busy workplace. This is often the hidden driver of burnout and turnover.';
      if (s < 60)
        return "Social connection is present but thin. Some people have someone to talk to; others don't. Small, intentional changes can strengthen this significantly.";
      return 'People feel connected to colleagues and have someone to turn to. This sense of belonging is one of the strongest protective factors against stress.';
    default:
      return '';
  }
}

export function getCompositeInterpretation(score) {
  const s = score != null ? Math.round(score) : null;
  if (s == null)
    return 'Not enough responses yet to show a composite score. Keep sharing the anonymous survey link — results unlock at 5 responses.';
  if (s < 50)
    return "Your team's overall mental fitness needs attention. Several areas are under strain, and people may be running on fumes. The good news: small, targeted interventions can create visible improvement within weeks.";
  if (s < 70)
    return "Your team is holding steady, but there's a clear opportunity to strengthen resilience before pressure builds. The sub-scores below show exactly where to focus first.";
  return "Your team is in a strong place overall. Mental fitness isn't the absence of stress — it's the capacity to meet it well. Keep investing in the practices that got you here.";
}