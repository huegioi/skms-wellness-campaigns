
import React, { useState } from 'react';
import { productCatalog, workforceChallenges } from './catalogData';
import StepNavigation from './StepNavigation';
import { Sparkles } from 'lucide-react';

export default function ReviewStep({ selections, onBack }) {
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: ''
  });
  const [showSuccess, setShowSuccess] = useState(false);

  const assessmentData = selections.assessmentData || {};

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

    // Build comprehensive email body
    let emailBody = `MENTAL FITNESS CAMPAIGN PROPOSAL%0D%0A`;
    emailBody += `======================================%0D%0A%0D%0A`;
    
    // Contact Info
    emailBody += `CONTACT INFORMATION%0D%0A`;
    emailBody += `-------------------%0D%0A`;
    emailBody += `Name: ${formData.name}%0D%0A`;
    emailBody += `Company: ${formData.company || 'N/A'}%0D%0A`;
    emailBody += `Email: ${formData.email}%0D%0A%0D%0A`;
    
    // Organization Overview
    if (assessmentData.companySize || assessmentData.industry || assessmentData.timeline) {
      emailBody += `ORGANIZATION OVERVIEW%0D%0A`;
      emailBody += `-------------------%0D%0A`;
      if (assessmentData.industry) emailBody += `Industry: ${assessmentData.industry}%0D%0A`;
      if (assessmentData.companySize) emailBody += `Company Size: ${assessmentData.companySize}%0D%0A`;
      if (assessmentData.timeline) emailBody += `Timeline: ${assessmentData.timeline}%0D%0A`;
      emailBody += `%0D%0A`;
    }
    
    // Current Challenges
    if (selections.challenges && selections.challenges.length > 0) {
      emailBody += `IDENTIFIED WORKFORCE CHALLENGES%0D%0A`;
      emailBody += `-------------------%0D%0A`;
      selections.challenges.forEach(id => {
        const challenge = workforceChallenges.find(c => c.id === id);
        if (challenge) emailBody += `• ${challenge.label}%0D%0A`;
      });
      emailBody += `%0D%0A`;
    }

    // Assessment Scores (if provided)
    if (assessmentData.teamResilience || assessmentData.engagementLevel || assessmentData.teamCommunication || assessmentData.teamDecisionQuality || assessmentData.goalAlignment || assessmentData.leadershipEffectiveness) {
      emailBody += `ASSESSMENT RESULTS%0D%0A`;
      emailBody += `-------------------%0D%0A`;
      if (assessmentData.teamResilience) emailBody += `Team Resilience: ${assessmentData.teamResilience}/5%0D%0A`;
      if (assessmentData.engagementLevel) emailBody += `Team Engagement: ${assessmentData.engagementLevel}/5%0D%0A`;
      if (assessmentData.teamCommunication) emailBody += `Team Communication: ${assessmentData.teamCommunication}/5%0D%0A`;
      if (assessmentData.teamDecisionQuality) emailBody += `Decision Quality: ${assessmentData.teamDecisionQuality}/5%0D%0A`;
      if (assessmentData.goalAlignment) emailBody += `Goal Alignment: ${assessmentData.goalAlignment}/5%0D%0A`;
      if (assessmentData.leadershipEffectiveness) emailBody += `Leadership Effectiveness: ${assessmentData.leadershipEffectiveness}/5%0D%0A`;
      emailBody += `%0D%0A`;
    }

    // Goals
    if (assessmentData.primaryGoals) {
      emailBody += `PRIMARY GOALS%0D%0A`;
      emailBody += `-------------------%0D%0A`;
      emailBody += `${assessmentData.primaryGoals}%0D%0A%0D%0A`;
    }

    // Program Summary
    emailBody += `PROPOSED PROGRAM COMPONENTS%0D%0A`;
    emailBody += `======================================%0D%0A%0D%0A`;

    // Workshops
    if (selections.workshops && selections.workshops.length > 0) {
      emailBody += `WORKSHOPS (${selections.workshops.length})%0D%0A`;
      emailBody += `-------------------%0D%0A`;
      (selections.workshops || []).forEach(key => {
        const workshop = productCatalog.workshops[key];
        if (workshop) {
          emailBody += `• ${workshop.name} - $${workshop.price.toLocaleString()}%0D%0A`;
        }
      });
      emailBody += `%0D%0A`;
    }

    // Challenges
    if (selections.challengePrograms && selections.challengePrograms.length > 0) {
      emailBody += `14-DAY CHALLENGES (${selections.challengePrograms.length})%0D%0A`;
      emailBody += `-------------------%0D%0A`;
      (selections.challengePrograms || []).forEach(key => {
        const challenge = productCatalog.challenges[key];
        if (challenge) {
          emailBody += `• ${challenge.name} - $${challenge.price.toLocaleString()}%0D%0A`;
        }
      });
      emailBody += `%0D%0A`;
    }

    // Leadership
    if (selections.leadership && selections.leadership.length > 0) {
      emailBody += `LEADERSHIP PROGRAMS%0D%0A`;
      emailBody += `-------------------%0D%0A`;
      selections.leadership.forEach(key => {
        const program = productCatalog.leadership[key];
        if (program) {
          emailBody += `• ${program.name} - $${program.price.toLocaleString()}%0D%0A`;
        }
      });
      emailBody += `%0D%0A`;
    }

    // Movement Classes
    if (selections.movementClasses && selections.movementClasses.length > 0) {
      emailBody += `CLASSES%0D%0A`;
      emailBody += `-------------------%0D%0A`;
      selections.movementClasses.forEach(key => {
        const classItem = productCatalog.movementClasses[key];
        if (classItem) {
          emailBody += `• ${classItem.name} - $${classItem.price.toLocaleString()}%0D%0A`;
        }
      });
      emailBody += `%0D%0A`;
    }

    // Wellness Boxes
    if (selections.smallBoxes > 0 || selections.largeBoxes > 0) {
      emailBody += `WELLNESS BOXES%0D%0A`;
      emailBody += `-------------------%0D%0A`;
      if (selections.smallBoxes > 0) {
        emailBody += `• Small Wellness Boxes: ${selections.smallBoxes} x $65 = $${(selections.smallBoxes * 65).toLocaleString()}%0D%0A`;
      }
      if (selections.largeBoxes > 0) {
        emailBody += `• Large Wellness Boxes: ${selections.largeBoxes} x $125 = $${(selections.largeBoxes * 125).toLocaleString()}%0D%0A`;
      }
      emailBody += `%0D%0A`;
    }

    // Total
    emailBody += `======================================%0D%0A`;
    emailBody += `ESTIMATED TOTAL (before shipping): $${calculateTotal().toLocaleString()}%0D%0A`;
    emailBody += `======================================%0D%0A%0D%0A`;

    // Success Metrics
    if (assessmentData.successMetrics) {
      emailBody += `SUCCESS METRICS%0D%0A`;
      emailBody += `-------------------%0D%0A`;
      emailBody += `${assessmentData.successMetrics}%0D%0A%0D%0A`;
    }

    emailBody += `Looking forward to co-creating this mental fitness campaign with SkillfulMeans!`;

    const mailtoLink = `mailto:admin@skillfulmeans.life?subject=Mental Fitness Campaign Proposal - ${formData.name}&body=${emailBody}`;

    setShowSuccess(true);

    setTimeout(() => {
      window.location.href = mailtoLink;
    }, 2500);
  };

  return (
    <div>
      <style>{`
        .review-card {
          background: #f4f0e9;
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 24px;
          box-shadow: 
            8px 8px 16px rgba(0, 0, 0, 0.12),
            -8px -8px 16px rgba(255, 255, 255, 0.9);
        }

        @media (min-width: 768px) {
          .review-card {
            padding: 24px;
          }
        }

        .summary-card {
          background: linear-gradient(135deg, #264d44 0%, #013f7c 100%);
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 24px;
          color: white;
          box-shadow: 
            8px 8px 16px rgba(0, 0, 0, 0.2),
            -8px -8px 16px rgba(255, 255, 255, 0.05);
        }

        @media (min-width: 768px) {
          .summary-card {
            padding: 28px;
          }
        }

        .summary-section {
          margin-bottom: 16px;
        }

        .summary-title {
          font-size: 13px;
          font-weight: 700;
          color: #eaf995;
          margin-bottom: 8px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .summary-content {
          font-size: 15px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.95);
        }

        .review-section {
          margin-bottom: 20px;
        }

        .review-section-title {
          font-size: 16px;
          font-weight: 700;
          color: #264d44;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 2px solid rgba(38, 77, 68, 0.2);
        }

        @media (min-width: 768px) {
          .review-section-title {
            font-size: 18px;
          }
        }

        .review-item {
          padding: 6px 0;
          color: #555;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 14px;
        }

        @media (min-width: 768px) {
          .review-item {
            padding: 8px 0;
          }
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
          background: linear-gradient(135deg, #eaf995, #cae5e3);
          color: #264d44;
          padding: 20px;
          border-radius: 12px;
          text-align: center;
          box-shadow: 
            inset 2px 2px 4px rgba(0, 0, 0, 0.05),
            inset -2px -2px 4px rgba(255, 255, 255, 0.5);
        }
      `}</style>

      <div className="mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-bold mb-2 md:mb-3" style={{ color: '#013f7c' }}>
          Campaign Summary
        </h2>
        <p className="text-base md:text-lg" style={{ color: '#666' }}>
          Review your customized mental fitness program
        </p>
      </div>

      {/* Concise Summary */}
      <div className="summary-card">
        <div className="flex items-center gap-2 mb-5">
          <Sparkles className="w-5 h-5 md:w-6 md:h-6" style={{ color: '#eaf995' }} />
          <h3 className="text-lg md:text-xl font-bold">Your Program at a Glance</h3>
        </div>
        
        {(assessmentData.companySize || assessmentData.industry) && (
          <div className="summary-section">
            <div className="summary-title">Organization</div>
            <div className="summary-content">
              {assessmentData.industry && `${assessmentData.industry}`}
              {assessmentData.industry && assessmentData.companySize && ` • `}
              {assessmentData.companySize && `${assessmentData.companySize} employees`}
            </div>
          </div>
        )}

        {selections.challenges && selections.challenges.length > 0 && (
          <div className="summary-section">
            <div className="summary-title">Focus Areas</div>
            <div className="summary-content">
              {selections.challenges.map(id => workforceChallenges.find(c => c.id === id)?.label).filter(Boolean).join(', ')}
            </div>
          </div>
        )}

        <div className="summary-section">
          <div className="summary-title">Program Components</div>
          <div className="summary-content">
            {[
              selections.workshops?.length > 0 && `${selections.workshops.length} Workshops`,
              selections.challengePrograms?.length > 0 && `${selections.challengePrograms.length} Challenges`,
              selections.leadership?.length > 0 && `${selections.leadership.length} Leadership Programs`,
              selections.movementClasses?.length > 0 && `${selections.movementClasses.length} Classes`,
              (selections.smallBoxes > 0 || selections.largeBoxes > 0) && 'Wellness Boxes'
            ].filter(Boolean).join(' • ')}
          </div>
        </div>

        {assessmentData.timeline && (
          <div className="summary-section">
            <div className="summary-title">Timeline</div>
            <div className="summary-content">{assessmentData.timeline}</div>
          </div>
        )}
      </div>

      {/* Detailed Breakdown */}
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
            <div className="review-section-title">Classes</div>
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

        <div className="mt-6 pt-6 border-t-2" style={{ borderColor: '#cae5e3' }}>
          <div className="flex justify-between items-center">
            <span className="text-xl md:text-2xl font-bold" style={{ color: '#264d44' }}>Total Investment</span>
            <span className="text-2xl md:text-3xl font-bold" style={{ color: '#770142' }}>${calculateTotal().toLocaleString()}</span>
          </div>
          <p className="text-xs mt-1 text-right" style={{ color: '#666' }}>
            (estimated before shipping)
          </p>
        </div>
      </div>

      {/* Contact Form */}
      {!showSuccess ? (
        <div className="review-card">
          <h3 className="text-xl md:text-2xl font-bold mb-4 md:mb-5" style={{ color: '#264d44' }}>
            Submit Your Proposal
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block mb-2 font-semibold text-sm md:text-base" style={{ color: '#555' }}>
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
              <label className="block mb-2 font-semibold text-sm md:text-base" style={{ color: '#555' }}>
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
              <label className="block mb-2 font-semibold text-sm md:text-base" style={{ color: '#555' }}>
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
              nextLabel="Submit Proposal"
              isLastStep={true}
            />
          </form>
        </div>
      ) : (
        <div className="success-message">
          <h3 className="text-lg md:text-xl font-bold mb-2">Thank You!</h3>
          <p className="text-sm md:text-base">Please complete sending the email from your mail client. A member of our team will follow up with you soon.</p>
        </div>
      )}
    </div>
  );
}
