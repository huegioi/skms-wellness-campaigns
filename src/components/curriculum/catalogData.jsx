// Product Catalog — names, descriptions and icons ONLY.
//
// Prices deliberately do NOT live here. Every price comes from the rate card
// (base44/shared/rateCard.ts) via priceForCatalogItem(category, key, headcount),
// because a workshop costs $1,500 for a 200-person client and $5,100 for a
// 4,000-person one — a static number in this file can only ever be wrong for
// someone. It previously held a flat $1,500 for all 18 workshops and all 5
// challenges, and that number reached client proposals.
export const productCatalog = {
  workshops: {
    steadySeasons: {
      name: "Steady Through the Seasons",
      description: "The holiday season can be a joyful time — but it also brings increased pressure, disrupted routines, and a higher risk of burnout and seasonal mood changes. This interactive workshop offers practical, evidence-based tools to help employees manage stress, regulate their energy, and support their mental health during the winter months.",
      icon: "Snowflake",
      seasonal: true
    },
    mindsetMastery: {
      name: "Mindset Mastery: Developing Emotional Resilience",
      description: "This is part one of a 3-part series. Participants learn how to build a resiliency toolbox to increase creativity, productivity, and proactive interpersonal engagement.",
      icon: "Brain"
    },
    beyondBurnout: {
      name: "Beyond Burnout: From Pressure to Presence",
      description: "This workshop explores practical ways to shift from self-criticism to self-compassion as a professional strength. Participants learn to recognize the inner critic, apply evidence-based practices, and reframe mistakes as opportunities for growth.",
      icon: "Flame"
    },
    navigatingConversations: {
      name: "Navigating Difficult Conversations",
      description: "Participants learn to approach high-stakes conversations (like feedback or conflict) with clarity and compassion. The session focuses on recognizing stress signals, listening with empathy, and applying a simple, step-by-step framework.",
      icon: "MessageCircle"
    },
    mindfulnessStress: {
      name: "Mindfulness for Stress Reduction",
      description: "This workshop focuses on 'being rather than doing, on resting rather than striving, and accepting rather than fixing'. The goal is to return to the day with mental focus, clarity, and a renewed sense of purpose.",
      icon: "Sparkles"
    },
    positiveMinds: {
      name: "Positive Minds, Productive Teams",
      description: "This workshop explores the science behind how positive states of mind like kindness, compassion, and gratitude affect work life and teams. Participants learn simple daily practices to create a calmer, more confident mind.",
      icon: "Heart"
    },
    creatingConnections: {
      name: "Creating Connections: Cultivating Community",
      description: "Designed for the remote work environment, this interactive workshop provides practical strategies to foster belonging, strengthen relationships, and enhance communication.",
      icon: "Users"
    },
    embracingGrowth: {
      name: "Embracing Growth Mindset",
      description: "This workshop introduces the concept of a growth mindset. Participants learn how to shift perspectives by viewing challenges as opportunities, which helps to reduce stress, cultivate resilience, and unlock potential.",
      icon: "TrendingUp"
    },
    fosteringWellBeing: {
      name: "Fostering Mental Well-Being",
      description: "A live, interactive webinar focused on mental health awareness, grief, and addiction. It provides practical tools for managing stress, supporting others, accessing professional resources, and reducing stigma.",
      icon: "Shield"
    },
    compassionCrisis: {
      name: "Compassion in Crisis",
      description: "This workshop offers a supportive space to explore healthy ways of managing difficult emotions (stress, grief, helplessness) that arise from distressing world events, such as natural disasters or global crises.",
      icon: "Umbrella"
    },

    snapshotRecovery: {
      name: "A Snapshot of Recovery",
      description: "Based on Dr. Jackson's experience at Massachusetts General Hospital, this workshop looks at how chronic pain affects the body and how simple shifts in attention and breathing can regulate the nervous system to improve physical pain and inflammation.",
      icon: "Activity"
    },
    mindfulEating: {
      name: "Mindful & Intuitive Eating",
      description: "This workshop helps shift the mindset around food from self-discipline to self-compassion. It covers how to be mindful of the body and microbiome to tune into what the body needs to feel nourished, healthy, and satisfied.",
      icon: "Apple"
    },
    alignedBody: {
      name: "The Aligned Body",
      description: "This interactive workshop delivers practical, science-backed tools to support musculoskeletal health. Participants learn accessible exercises and mindful movement practices to build strength, mobility, and posture.",
      icon: "Move"
    }
  },
  challenges: {
    emotionalResilience: {
      name: "Deepening Emotional Resilience Challenge",
      duration: "14-Day",
      description: "Participants learn to build a resilience toolkit to boost productivity, creativity, and engagement. The challenge focuses on tuning into the body's signals, recognizing thought patterns, and articulating needs effectively.",
      icon: "Target"
    },
    calmConfident: {
      name: "Creating a Calm and Confident Mind Challenge",
      duration: "14-Day",
      description: "Designed for both new and seasoned practitioners, this challenge helps establish a daily meditation practice to cultivate a lasting sense of calm and confidence.",
      icon: "CircleDot"
    },
    creatingConnections: {
      name: "Creating Connections Challenge",
      duration: "14-Day",
      description: "A 14-day journey designed to strengthen an online community by fostering authentic connection, trust, and mutual support. It uses insightful videos and thoughtful exercises to build community bonds.",
      icon: "Link"
    },
    clearCommunication: {
      name: "Clear Communication Challenge",
      duration: "14-Day",
      description: "This challenge helps teams build confidence, resilience, and skill in navigating high-stakes communication with clarity and empathy. It breaks down large communication skills into small, accessible daily steps.",
      icon: "MessagesSquare"
    },
    compassionateColleague: {
      name: "Compassionate Colleague Challenge",
      duration: "14-Day",
      description: "This challenge builds skills to support colleagues' daily struggles with empathy and confidence. It equips peers to be compassionate allies, without acting as therapists, using an evidence-informed 'Listen, Validate, Refer' framework.",
      icon: "HandHeart"
    }
  },
  movementClasses: {
    mindfulMovement: {
      name: "Mindful Movement",
      duration: "4-12 week series",
      description: "A gentle movement class accessible to all fitness levels. It helps teams connect with their bodies, reduce stress, release tension, and reduce back/neck pain from sitting at a desk.",
      icon: "Waves"
    },
    yogaStress: {
      name: "Yoga for Stress Reduction",
      duration: "4-12 week series",
      description: "This class combines strength-building and flexibility-focused postures to address tight muscles and mental stress. It uses gentle flows and restorative poses to calm the nervous system.",
      icon: "Wind"
    },
    mindfulnessClasses: {
      name: "Mindfulness Classes",
      duration: "Weekly/Bi-weekly/Monthly",
      description: "This class teaches practical mindfulness techniques, including walking and sitting meditation, to reduce stress, improve focus, and boost team communication.",
      icon: "Flower2"
    }
  },
  leadership: {
    leadershipProgram: {
      name: "Leadership EQ Program",
      description: "A sequential workshop series designed to build leadership skills, align teams, and develop mental fitness. Leaders learn exercises to enhance emotional resilience, foster a growth mindset, and promote values-based leadership.",
      icon: "Crown"
    },
    workshop1: {
      name: "Leadership EQ Workshop 1: Growth Mindset",
      description: "Part one of the Leadership EQ series. This is a personal exploration into developing a growth mindset. Leaders walk away with clarity about their personal character strengths and how they inform successes and obstacles.",
      icon: "Lightbulb"
    },
    workshop2: {
      name: "Leadership EQ Workshop 2: Aligned Leadership",
      description: "Part two of the series. This workshop helps leaders develop a model for aligning personal and organizational values, both for themselves and for the people who report to them.",
      icon: "Compass"
    },
    workshop3: {
      name: "Leadership EQ Workshop 3: Emotional Resilience",
      description: "Part three of the series. This session offers a model and practice for bouncing back from conflict. It provides a straightforward four-step process for preparing for and having difficult conversations.",
      icon: "Shield"
    },
    coachingProgram: {
      name: "Leadership EQ Coaching Program",
      description: "This program blends individualized support with collaborative growth for emerging and established leaders. It develops emotional intelligence competencies by focusing on three phases: growth mindset, aligning values, and emotional resilience.",
      icon: "Award"
    }
  },
  wellnessBoxes: {
    physical: {
      name: "Custom Wellness Boxes (Physical)",
      description: "Custom-curated physical gift boxes. Themes can include Mental Health/Stress Relief, Gratitude, or New Year New You theme.",
      icon: "Gift"
    },
    digital: {
      name: "Digital Wellness Boxes",
      description: "A global incentive solution. These boxes include a digital gift card (employees choose the merchant) plus digital content like mini-course videos, meditation recordings, and workbooks. Themes include Mental Health/Stress Relief, Mindfulness, and Emotional Resilience.",
      icon: "Sparkles"
    }
  }
};

// Workforce Challenges Assessment
export const workforceChallenges = [
  {
    id: "stress_burnout",
    label: "Stress & Burnout",
    description: "High stress levels, exhaustion, and burnout symptoms",
    icon: "Flame"
  },
  {
    id: "communication",
    label: "Communication Issues",
    description: "Difficulty with feedback, conflict, or team communication",
    icon: "MessageCircle"
  },
  {
    id: "remote_disconnect",
    label: "Remote Work Disconnect",
    description: "Lack of connection and community in virtual teams",
    icon: "Monitor"
  },
  {
    id: "mental_health",
    label: "Mental Health Support",
    description: "Need for mental health resources and awareness",
    icon: "Heart"
  },
  {
    id: "growth_culture",
    label: "Growth & Innovation",
    description: "Fixed mindset, resistance to change, fear of failure",
    icon: "TrendingUp"
  },
  {
    id: "leadership_development",
    label: "Leadership Development",
    description: "Need to develop emotionally intelligent leaders",
    icon: "Crown"
  },
  {
    id: "physical_wellness",
    label: "Physical Wellness",
    description: "Sedentary lifestyle, poor posture, chronic pain",
    icon: "Activity"
  },
  {
    id: "work_life_balance",
    label: "Work-Life Balance",
    description: "Difficulty separating work and personal life",
    icon: "Scale"
  }
];

// Mapping challenges to recommended solutions
export const challengeSolutionMap = {
  stress_burnout: {
    workshops: ["beyondBurnout", "mindsetMastery", "mindfulnessStress"],
    challenges: ["emotionalResilience", "calmConfident"],
    classes: ["yogaStress", "mindfulnessClasses"]
  },
  communication: {
    workshops: ["navigatingConversations", "positiveMinds"],
    challenges: ["clearCommunication", "compassionateColleague"],
    leadership: ["workshop3"]
  },
  remote_disconnect: {
    workshops: ["creatingConnections", "positiveMinds"],
    challenges: ["creatingConnections"],
    classes: ["mindfulnessClasses"]
  },
  mental_health: {
    workshops: ["fosteringWellBeing", "compassionCrisis", "mindsetMastery"],
    challenges: ["emotionalResilience", "compassionateColleague"],
    classes: ["mindfulnessClasses"]
  },
  growth_culture: {
    workshops: ["embracingGrowth", "positiveMinds"],
    leadership: ["workshop1", "leadershipProgram"]
  },
  leadership_development: {
    workshops: ["mindsetMastery"],
    leadership: ["leadershipProgram", "workshop1", "workshop2", "workshop3", "coachingProgram"]
  },
  physical_wellness: {
    workshops: ["alignedBody", "mindfulEating", "snapshotRecovery"],
    classes: ["mindfulMovement", "yogaStress"]
  },
  work_life_balance: {
    workshops: ["mindfulnessStress", "steadySeasons", "beyondBurnout"],
    challenges: ["calmConfident"],
    classes: ["mindfulnessClasses", "yogaStress"]
  }
};