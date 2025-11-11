
import React, { useState } from 'react';
import { productCatalog, workforceChallenges } from './catalogData';
import StepNavigation from './StepNavigation';
import { Sparkles, TrendingUp, AlertCircle } from 'lucide-react';

export default function ReviewStep({ selections, onBack }) {
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: ''
  });
  const [showSuccess, setShowSuccess] = useState(false);

  const assessmentData = selections.assessmentData || {};

  // Generate comprehensive personalized narrative
  const generateNarrative = () => {
    const sections = [];

    // Company context
    if (assessmentData.companySize || assessmentData.industry) {
      const parts = [];
      if (assessmentData.industry) parts.push(assessmentData.industry);
      if (assessmentData.companySize) parts.push(`${assessmentData.companySize} employees`);
      sections.push({
        title: "Your Organization",
        content: parts.join(", ")
      });
    }

    // Workforce challenges
    if (selections.challenges && selections.challenges.length > 0) {
      const challengeLabels = selections.challenges
        .map(id => workforceChallenges.find(c => c.id === id)?.label)
        .filter(Boolean);
      
      sections.push({
        title: "Current Challenges",
        content: `Your organization is facing challenges with ${challengeLabels.slice(0, -1).join(', ')}${challengeLabels.length > 1 ? ' and ' + challengeLabels[challengeLabels.length - 1] : challengeLabels[0]}.`
      });
    }

    // Assessment insights
    const insights = [];
    
    if (assessmentData.resilienceLevel && parseInt(assessmentData.resilienceLevel) <= 3) {
      insights.push("Building resilience and adaptability among leaders");
    }
    if (assessmentData.engagementLevel && parseInt(assessmentData.engagementLevel) <= 3) {
      insights.push("Improving leadership engagement and morale");
    }
    if (assessmentData.emotionalIntelligence && parseInt(assessmentData.emotionalIntelligence) <= 3) {
      insights.push("Developing emotional intelligence and conflict management skills");
    }
    if (assessmentData.conflictFrequency && parseInt(assessmentData.conflictFrequency) <= 2) {
      insights.push("Reducing workplace conflicts and escalations");
    }
    if (assessmentData.decisionQuality && parseInt(assessmentData.decisionQuality) <= 3) {
      insights.push("Enhancing decision-making quality and speed");
    }
    if (assessmentData.goalAlignment && parseInt(assessmentData.goalAlignment) <= 3) {
      insights.push("Improving organizational alignment and goal clarity");
    }

    if (insights.length > 0) {
      sections.push({
        title: "Key Focus Areas Based on Your Assessment",
        list: insights
      });
    }

    // Primary goals
    if (assessmentData.primaryGoals) {
      sections.push({
        title: "Your Stated Goals",
        content: assessmentData.primaryGoals
      });
    }

    // How the program addresses needs
    const programSections = [];

    // Workshops
    if (selections.workshops && selections.workshops.length > 0) {
      const workshopNames = selections.workshops.slice(0, 3).map(key => productCatalog.workshops[key]?.name).filter(Boolean);
      const remaining = selections.workshops.length - 3;
      let text = workshopNames.join(', ');
      if (remaining > 0) text += `, and ${remaining} more`;
      text += ". These sessions provide practical tools and frameworks to address your immediate challenges with stress, communication, and leadership effectiveness.";
      programSections.push({ subtitle: "Workshops - Foundation Building", content: text });
    }

    // Challenges
    if (selections.challengePrograms && selections.challengePrograms.length > 0) {
      programSections.push({
        subtitle: "14-Day Challenges - Habit Formation",
        content: "Daily guided practices reinforce workshop concepts, creating lasting behavioral change and building mental fitness habits across your organization."
      });
    }

    // Leadership
    if (selections.leadership && selections.leadership.length > 0) {
      programSections.push({
        subtitle: "Leadership Development - Culture Transformation",
        content: "Equipping your leaders with emotional intelligence competencies creates a ripple effect throughout the organization, modeling healthy behaviors and creating psychologically safe environments."
      });
    }

    // Movement Classes
    if (selections.movementClasses && selections.movementClasses.length > 0) {
      programSections.push({
        subtitle: "Movement & Mindfulness - Sustained Practice",
        content: "Ongoing classes provide consistent touchpoints for stress reduction, physical wellness, and community building."
      });
    }

    // Wellness Boxes
    if (selections.smallBoxes > 0 || selections.largeBoxes > 0) {
      programSections.push({
        subtitle: "Wellness Incentives - Recognition & Engagement",
        content: "Tangible rewards boost participation rates and demonstrate organizational commitment to employee well-being."
      });
    }

    if (programSections.length > 0) {
      sections.push({
        title: "How Your Customized Campaign Addresses These Needs",
        subsections: programSections
      });
    }

    // Success metrics
    if (assessmentData.successMetrics) {
      sections.push({
        title: "Expected Impact on Your Success Metrics",
        content: `This comprehensive approach is designed to positively impact the metrics you've identified: ${assessmentData.successMetrics}`
      });
    }

    // Timeline
    if (assessmentData.timeline) {
      const timelineText = {
        'immediate': 'immediate implementation',
        '1-3months': '1-3 month rollout',
        '3-6months': '3-6 month implementation',
        '6-12months': '6-12 month phased approach',
        'exploring': 'flexible timeline to fit your needs'
      }[assessmentData.timeline] || 'customized timeline';
      
      sections.push({
        title: "Implementation",
        content: `Your ${timelineText} aligns well with our program delivery model.`
      });
    }

    sections.push({
      title: "Bottom Line",
      content: "This integrated mental fitness ecosystem creates sustainable culture change, addressing both immediate needs and long-term organizational health.",
      highlight: true
    });

    return sections;
  };

  // Generate assessment summary
  const generateAssessmentSummary = () => {
    const items = [];
    
    if (assessmentData.resilienceLevel) {
      items.push({ label: 'Leadership Resilience', value: `${assessmentData.resilienceLevel}/5`, status: parseInt(assessmentData.resilienceLevel) >= 4 ? 'good' : 'needs-work' });
    }
    if (assessmentData.engagementLevel) {
      items.push({ label: 'Team Engagement', value: `${assessmentData.engagementLevel}/5`, status: parseInt(assessmentData.engagementLevel) >= 4 ? 'good' : 'needs-work' });
    }
    if (assessmentData.emotionalIntelligence) {
      items.push({ label: 'Emotional Intelligence', value: `${assessmentData.emotionalIntelligence}/5`, status: parseInt(assessmentData.emotionalIntelligence) >= 4 ? 'good' : 'needs-work' });
    }
    if (assessmentData.decisionQuality) {
      items.push({ label: 'Decision Quality', value: `${assessmentData.decisionQuality}/5`, status: parseInt(assessmentData.decisionQuality) >= 4 ? 'good' : 'needs-work' });
    }
    if (assessmentData.goalAlignment) {
      items.push({ label: 'Goal Alignment', value: `${assessmentData.goalAlignment}/5`, status: parseInt(assessmentData.goalAlignment) >= 4 ? 'good' : 'needs-work' });
    }
    
    return items;
  };

  // Calculate total price
  const calculateTotal = () => {
    let total = 0;
    (selections.workshops || []).forEach(key => {
      total += productCatalog.workshops[key]?.price || 0;
    });
    (selections.challengePrograms || []).forEach(key => {
      total += productCatalog.challenges[key]?.price || 0;
    });
    (selections.leadership || []).forEach(key => {
      total += productCatalog.leadership[key]?.price || 0;
    });
    (selections.movementClasses || []).forEach(key => {
      total += productCatalog.movementClasses[key]?.price || 0;
    });
    total += (selections.smallBoxes || 0) * 65;
    total += (selections.largeBoxes || 0) * 125;
    return total;
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Build email body
    let emailBody = `Hi, I am interested in co-creating a mental fitness campaign with SkillfulMeans...%0D%0A%0D%0A`;
    emailBody += `Name: ${formData.name}%0D%0A`;
    emailBody += `Company: ${formData.company || 'N/A'}%0D%0A`;
    emailBody += `Email: ${formData.email}%0D%0A%0D%0A`;
    emailBody += `Estimated Total: $${calculateTotal().toLocaleString()}%0D%0A%0D%0A`;
    
    // Add assessment data
    if (assessmentData.companySize) emailBody += `Company Size: ${assessmentData.companySize}%0D%0A`;
    if (assessmentData.industry) emailBody += `Industry: ${assessmentData.industry}%0D%0A`;
    if (assessmentData.timeline) emailBody += `Timeline: ${assessmentData.timeline}%0D%0A`;
    emailBody += `%0D%0A`;
    
    if (selections.challenges && selections.challenges.length > 0) {
      emailBody += `Workforce Challenges:%0D%0A`;
      selections.challenges.forEach(id => {
        const challenge = workforceChallenges.find(c => c.id === id);
        emailBody += `- ${challenge?.label}%0D%0A`;
      });
      emailBody += `%0D%0A`;
    }

    if (assessmentData.primaryGoals) {
      emailBody += `Primary Goals: ${assessmentData.primaryGoals}%0D%0A%0D%0A`;
    }

    emailBody += `Selected Workshops:%0D%0A`;
    (selections.workshops || []).forEach(key => {
      emailBody += `- ${productCatalog.workshops[key]?.name}%0D%0A`;
    });
    emailBody += `%0D%0A`;

    emailBody += `Selected Challenges:%0D%0A`;
    (selections.challengePrograms || []).forEach(key => {
      emailBody += `- ${productCatalog.challenges[key]?.name}%0D%0A`;
    });
    emailBody += `%0D%0A`;

    if (selections.leadership && selections.leadership.length > 0) {
      emailBody += `Leadership Programs:%0D%0A`;
      selections.leadership.forEach(key => {
        emailBody += `- ${productCatalog.leadership[key]?.name}%0D%0A`;
      });
      emailBody += `%0D%0A`;
    }

    if (selections.movementClasses && selections.movementClasses.length > 0) {
      emailBody += `Movement/Mindfulness Classes:%0D%0A`;
      selections.movementClasses.forEach(key => {
        emailBody += `- ${productCatalog.movementClasses[key]?.name}%0D%0A`;
      });
      emailBody += `%0D%0A`;
    }

    emailBody += `Wellness Boxes:%0D%0A`;
    emailBody += `- Small Boxes: ${selections.smallBoxes || 0}%0D%0A`;
    emailBody += `- Large Boxes: ${selections.largeBoxes || 0}%0D%0A`;

    const mailtoLink = `mailto:admin@skillfulmeans.life?subject=Mental Fitness Campaign from ${formData.name}&body=${emailBody}`;

    setShowSuccess(true);

    setTimeout(() => {
      window.location.href = mailtoLink;
    }, 2500);
  };

  const assessmentSummary = generateAssessmentSummary();
  const narrativeSections = generateNarrative();

  return (
    <div>
      <style>{`
        .review-card {
          background: #f4f0e9;
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow: 
            8px 8px 16px rgba(0, 0, 0, 0.12),
            -8px -8px 16px rgba(255, 255, 255, 0.9);
        }

        .narrative-card {
          background: linear-gradient(135deg, #441d37 0%, #5a2747 100%);
          border-radius: 16px;
          padding: 28px;
          margin-bottom: 24px;
          color: white;
          box-shadow: 
            8px 8px 16px rgba(0, 0, 0, 0.2),
            -8px -8px 16px rgba(255, 255, 255, 0.05);
        }

        .narrative-section {
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.15);
        }

        .narrative-section:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }

        .narrative-title {
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 12px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          font-size: 14px;
          opacity: 0.9;
        }

        .narrative-content {
          font-size: 16px;
          line-height: 1.8;
          color: rgba(255, 255, 255, 0.95);
        }

        .narrative-list {
          margin-top: 8px;
          padding-left: 20px;
          list-style-type: disc;
        }

        .narrative-list li {
          margin-bottom: 8px;
          line-height: 1.6;
          font-size: 15px;
        }

        .narrative-subsection {
          margin-top: 16px;
          padding-left: 16px;
          border-left: 3px solid rgba(255, 255, 255, 0.3);
        }

        .narrative-subtitle {
          font-weight: 700;
          font-size: 16px;
          margin-bottom: 6px;
          color: #ffffff;
        }

        .narrative-highlight {
          background: rgba(255, 255, 255, 0.1);
          padding: 20px;
          border-radius: 12px;
          border: 2px solid rgba(255, 255, 255, 0.2);
        }

        .assessment-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-top: 16px;
        }

        .assessment-item {
          background: rgba(255, 255, 255, 0.1);
          padding: 16px;
          border-radius: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .assessment-item.needs-work {
          border-left: 4px solid #fbbf24;
        }

        .assessment-item.good {
          border-left: 4px solid #10b981;
        }

        .review-section {
          margin-bottom: 20px;
        }

        .review-section-title {
          font-size: 18px;
          font-weight: 700;
          color: #013f7c;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 2px solid rgba(1, 63, 124, 0.2);
        }

        .review-item {
          padding: 8px 0;
          color: #555;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .neuro-input {
          background: #f4f0e9;
          border: none;
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 14px;
          color: #333;
          width: 100%;
          box-shadow: 
            inset 4px 4px 8px rgba(0, 0, 0, 0.1),
            inset -4px -4px 8px rgba(255, 255, 255, 0.8);
          transition: all 0.2s ease;
        }

        .neuro-input:focus {
          outline: none;
          box-shadow: 
            inset 5px 5px 10px rgba(0, 0, 0, 0.12),
            inset -5px -5px 10px rgba(255, 255, 255, 0.9);
        }

        .success-message {
          background: #e8f5e9;
          color: #2e7d32;
          padding: 20px;
          border-radius: 12px;
          text-align: center;
          box-shadow: 
            inset 2px 2px 4px rgba(0, 0, 0, 0.05),
            inset -2px -2px 4px rgba(255, 255, 255, 0.5);
        }
      `}</style>

      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-3" style={{ color: '#013f7c' }}>
          Your Customized Campaign
        </h2>
        <p className="text-lg" style={{ color: '#666' }}>
          See how your program addresses your organization's specific needs.
        </p>
      </div>

      {/* Personalized Narrative */}
      <div className="narrative-card">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-6 h-6" />
          <h3 className="text-xl font-bold">Your Personalized Campaign Story</h3>
        </div>
        
        {assessmentSummary.length > 0 && (
          <div className="assessment-grid mb-6">
            {assessmentSummary.map((item, idx) => (
              <div key={idx} className={`assessment-item ${item.status}`}>
                <span className="text-sm font-semibold">{item.label}</span>
                <span className="text-lg font-bold">{item.value}</span>
              </div>
            ))}
          </div>
        )}

        {narrativeSections.map((section, idx) => (
          <div key={idx} className={section.highlight ? "narrative-section narrative-highlight" : "narrative-section"}>
            <div className="narrative-title">{section.title}</div>
            
            {section.content && (
              <div className="narrative-content">{section.content}</div>
            )}
            
            {section.list && (
              <ul className="narrative-list">
                {section.list.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            )}
            
            {section.subsections && section.subsections.map((subsection, i) => (
              <div key={i} className="narrative-subsection">
                <div className="narrative-subtitle">{subsection.subtitle}</div>
                <div className="narrative-content">{subsection.content}</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Program Summary */}
      <div className="review-card">
        {selections.workshops && selections.workshops.length > 0 && (
          <div className="review-section">
            <div className="review-section-title">Workshops ({selections.workshops.length})</div>
            {selections.workshops.map(key => (
              <div key={key} className="review-item">
                <span>{productCatalog.workshops[key]?.name}</span>
                <span className="font-semibold">${productCatalog.workshops[key]?.price.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        {selections.challengePrograms && selections.challengePrograms.length > 0 && (
          <div className="review-section">
            <div className="review-section-title">14-Day Challenges ({selections.challengePrograms.length})</div>
            {selections.challengePrograms.map(key => (
              <div key={key} className="review-item">
                <span>{productCatalog.challenges[key]?.name}</span>
                <span className="font-semibold">${productCatalog.challenges[key]?.price.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        {selections.leadership && selections.leadership.length > 0 && (
          <div className="review-section">
            <div className="review-section-title">Leadership Programs</div>
            {selections.leadership.map(key => (
              <div key={key} className="review-item">
                <span>{productCatalog.leadership[key]?.name}</span>
                <span className="font-semibold">${productCatalog.leadership[key]?.price.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        {selections.movementClasses && selections.movementClasses.length > 0 && (
          <div className="review-section">
            <div className="review-section-title">Movement & Mindfulness Classes</div>
            {selections.movementClasses.map(key => (
              <div key={key} className="review-item">
                <span>{productCatalog.movementClasses[key]?.name}</span>
                <span className="font-semibold">${productCatalog.movementClasses[key]?.price.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        {(selections.smallBoxes > 0 || selections.largeBoxes > 0) && (
          <div className="review-section">
            <div className="review-section-title">Wellness Boxes</div>
            {selections.smallBoxes > 0 && (
              <div className="review-item">
                <span>Small Boxes ({selections.smallBoxes})</span>
                <span className="font-semibold">${(selections.smallBoxes * 65).toLocaleString()}</span>
              </div>
            )}
            {selections.largeBoxes > 0 && (
              <div className="review-item">
                <span>Large Boxes ({selections.largeBoxes})</span>
                <span className="font-semibold">${(selections.largeBoxes * 125).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 pt-6 border-t-2 border-gray-300">
          <div className="flex justify-between items-center">
            <span className="text-2xl font-bold" style={{ color: '#013f7c' }}>Total Estimate</span>
            <span className="text-3xl font-bold" style={{ color: '#441d37' }}>${calculateTotal().toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Contact Form */}
      {!showSuccess ? (
        <div className="review-card">
          <h3 className="text-2xl font-bold mb-5" style={{ color: '#013f7c' }}>
            Submit Your Campaign
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block mb-2 font-semibold" style={{ color: '#555' }}>
                Your Name *
              </label>
              <input
                type="text"
                name="name"
                required
                className="neuro-input"
                placeholder="Enter your name"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            <div className="mb-4">
              <label className="block mb-2 font-semibold" style={{ color: '#555' }}>
                Company Name
              </label>
              <input
                type="text"
                name="company"
                className="neuro-input"
                placeholder="Enter company name"
                value={formData.company}
                onChange={handleChange}
              />
            </div>

            <div className="mb-5">
              <label className="block mb-2 font-semibold" style={{ color: '#555' }}>
                Email Address *
              </label>
              <input
                type="email"
                name="email"
                required
                className="neuro-input"
                placeholder="your@email.com"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <StepNavigation
              onBack={onBack}
              nextLabel="Submit Campaign"
              isLastStep={true}
            />
          </form>
        </div>
      ) : (
        <div className="success-message">
          <h3 className="text-xl font-bold mb-2">Thank You!</h3>
          <p>Please complete sending the email from your mail client. A member of our team will follow up with you as soon as possible.</p>
        </div>
      )}
    </div>
  );
}
