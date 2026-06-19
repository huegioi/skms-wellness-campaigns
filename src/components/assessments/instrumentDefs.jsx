// Shared definitions for all validated assessment instruments.
// Used by the public multi-step cohort assessment form.

export const INSTRUMENTS = {
  who5: {
    key: 'who5',
    label: 'WHO-5',
    subtitle: 'Wellbeing',
    preamble: 'Over the last two weeks…',
    renderStyle: 'labeled',
    questions: [
      { key: 'q1', text: 'I have felt cheerful and in good spirits' },
      { key: 'q2', text: 'I have felt calm and relaxed' },
      { key: 'q3', text: 'I have felt active and vigorous' },
      { key: 'q4', text: 'I woke up feeling fresh and rested' },
      { key: 'q5', text: 'My daily life has been filled with things that interest me' },
    ],
    scale: [
      { value: 0, label: 'At no time' },
      { value: 1, label: 'Some of the time' },
      { value: 2, label: 'Less than half the time' },
      { value: 3, label: 'More than half the time' },
      { value: 4, label: 'Most of the time' },
      { value: 5, label: 'All of the time' },
    ],
  },
  enps: {
    key: 'enps',
    label: 'eNPS',
    subtitle: 'Advocacy',
    preamble: '',
    renderStyle: 'numeric',
    scaleMin: 0,
    scaleMax: 10,
    lowLabel: 'Not at all likely',
    highLabel: 'Extremely likely',
    questions: [
      { key: 'q1', text: 'How likely are you to recommend this program to a colleague?' },
    ],
  },
  uwes3: {
    key: 'uwes3',
    label: 'UWES-3',
    subtitle: 'Work engagement',
    preamble: 'At work…',
    renderStyle: 'labeled',
    questions: [
      { key: 'q1', text: 'I feel bursting with energy' },
      { key: 'q2', text: 'I am enthusiastic about my job' },
      { key: 'q3', text: 'I am immersed in my work' },
    ],
    scale: [
      { value: 0, label: 'Never' },
      { value: 1, label: 'Almost never' },
      { value: 2, label: 'Rarely' },
      { value: 3, label: 'Sometimes' },
      { value: 4, label: 'Often' },
      { value: 5, label: 'Very often' },
      { value: 6, label: 'Always' },
    ],
  },
  pss4: {
    key: 'pss4',
    label: 'PSS-4',
    subtitle: 'Perceived stress',
    preamble: 'In the last month, how often have you…',
    renderStyle: 'labeled',
    questions: [
      { key: 'q1', text: 'felt unable to control the important things in your life?' },
      { key: 'q2', text: 'felt confident about your ability to handle your personal problems?' },
      { key: 'q3', text: 'felt that things were going your way?' },
      { key: 'q4', text: 'felt difficulties were piling up so high you could not overcome them?' },
    ],
    scale: [
      { value: 0, label: 'Never' },
      { value: 1, label: 'Almost never' },
      { value: 2, label: 'Sometimes' },
      { value: 3, label: 'Fairly often' },
      { value: 4, label: 'Very often' },
    ],
  },
  ucla3: {
    key: 'ucla3',
    label: 'UCLA-3',
    subtitle: 'Loneliness',
    preamble: 'How often do you…',
    renderStyle: 'labeled',
    questions: [
      { key: 'q1', text: 'feel that you lack companionship?' },
      { key: 'q2', text: 'feel left out?' },
      { key: 'q3', text: 'feel isolated from others?' },
    ],
    scale: [
      { value: 1, label: 'Hardly ever' },
      { value: 2, label: 'Some of the time' },
      { value: 3, label: 'Often' },
    ],
  },
  cbi: {
    key: 'cbi',
    label: 'CBI',
    subtitle: 'Burnout',
    preamble: 'How often do you…',
    renderStyle: 'labeled',
    questions: [
      { key: 'q1', text: 'feel tired or lethargic at work?' },
      { key: 'q2', text: 'feel physically exhausted at work?' },
      { key: 'q3', text: 'feel emotionally exhausted at work?' },
      { key: 'q4', text: 'think about work outside of work?' },
      { key: 'q5', text: 'feel that you are not contributing to the work?' },
      { key: 'q6', text: 'feel that you are not doing meaningful work?' },
    ],
    scale: [
      { value: 0, label: 'Never' },
      { value: 1, label: 'Almost never' },
      { value: 2, label: 'Sometimes' },
      { value: 3, label: 'Fairly often' },
      { value: 4, label: 'Very often' },
    ],
  },
};

// Low-burden order: fewest items first
export const LOW_BURDEN_ORDER = ['enps', 'ucla3', 'uwes3', 'pss4', 'who5', 'cbi'];

// Full battery for cohort start/end census
export const FULL_BATTERY = ['who5', 'uwes3', 'pss4', 'ucla3', 'cbi', 'enps'];

// Returns instrument definitions in low-burden order for the given keys
export function getOrderedInstruments(keys) {
  return LOW_BURDEN_ORDER.filter(k => keys.includes(k)).map(k => INSTRUMENTS[k]);
}