// Product Catalog
export const productCatalog = {
  workshops: {
    mindsetMastery: { name: "Mindset Mastery", price: 1500, description: "Transform limiting beliefs into empowering perspectives" },
    beyondBurnout: { name: "Beyond Burnout", price: 1500, description: "Recognize, prevent, and recover from burnout" },
    navigatingConversations: { name: "Navigating Difficult Conversations", price: 1500, description: "Master conflict resolution with confidence" },
    creatingConnections: { name: "Creating Connections", price: 1500, description: "Build authentic relationships in remote and hybrid teams" },
    fosteringWellBeing: { name: "Fostering Mental Well-Being", price: 1500, description: "Create psychologically safe workplaces" },
    embracingGrowth: { name: "Embracing Growth Mindset", price: 1500, description: "Cultivate continuous learning and innovation" },
    alignedBody: { name: "Aligned Body", price: 1500, description: "Reduce physical strain and improve ergonomics" },
    mindfulEating: { name: "Mindful Eating", price: 1500, description: "Develop healthy relationships with food and eating" },
  },
  challenges: {
    emotionalResilience: { name: "Emotional Resilience Challenge", price: 1500, description: "Build emotional strength through daily practices" },
    clearCommunication: { name: "Clear Communication Challenge", price: 1500, description: "Enhance team communication skills" },
  },
  coaching: {
    leadershipEQ: { name: "Leadership EQ Coaching", price: 5400, description: "Individual coaching for emotional intelligence" },
    leadershipProgram: { name: "Leadership EQ Program", price: 10000, description: "Comprehensive leadership development program" },
  },
  platform: {
    access: { name: "Platform Access", price: 0, description: "Access to online learning platform" },
    community: { name: "Community Forums", price: 0, description: "Connect with peers and share experiences" },
  },
  reporting: {
    analytics: { name: "Analytics Dashboard", price: 0, description: "Track engagement and progress" },
    roi: { name: "ROI Reports", price: 0, description: "Measure return on investment" },
  }
};

// Pain Point Data Mapping
export const painPointData = {
  "Stress, Burnout & Resilience": {
    workshops: ["mindsetMastery", "beyondBurnout"],
    challenges: ["emotionalResilience"]
  },
  "Communication & Conflict": {
    workshops: ["navigatingConversations"],
    challenges: ["clearCommunication"]
  },
  "Team Cohesion & Remote Work": {
    workshops: ["creatingConnections"],
    challenges: []
  },
  "Mental Health & Support": {
    workshops: ["fosteringWellBeing"],
    challenges: []
  },
  "Growth, Mindset & Culture": {
    workshops: ["embracingGrowth"],
    challenges: []
  },
  "Physical & Personal Well-being": {
    workshops: ["alignedBody", "mindfulEating"],
    challenges: []
  },
  "Leadership Development": {
    workshops: [],
    challenges: [],
    coaching: ["leadershipEQ", "leadershipProgram"]
  }
};