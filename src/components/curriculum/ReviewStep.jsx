
import React, { useState } from 'react';
import { productCatalog, workforceChallenges, challengeSolutionMap } from './catalogData';
import StepNavigation from './StepNavigation';
import { Sparkles, Target } from 'lucide-react';

export default function ReviewStep({ selections, onBack }) {
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: ''
  });
  const [showSuccess, setShowSuccess] = useState(false);

  const assessmentData = selections.assessmentData || {};
  const sampleBoxQuantities = selections.sampleBoxQuantities || {};

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
    // Add sample box totals
    total += (sampleBoxQuantities.reduceStress || 0) * 65;
    total += (sampleBoxQuantities.relaxationSleep || 0) * 65;
    total += (sampleBoxQuantities.largeEmotional || 0) * 125;
    total += (sampleBoxQuantities.largeStressReduction || 0) * 125;
    return total;
  };

  const generateNarrative = () => {
    if (!selections.challenges || selections.challenges.length === 0) {
      return null;
    }

    const challengeLabels = selections.challenges
      .map(id => workforceChallenges.find(c => c.id === id)?.label)
      .filter(Boolean);

    const programComponents = [];
    if (selections.workshops?.length > 0) programComponents.push(`${selections.workshops.length} targeted workshops`);
    if (selections.challengePrograms?.length > 0) programComponents.push(`${selections.challengePrograms.length} engagement challenges`);
    if (selections.leadership?.length > 0) programComponents.push('leadership development');
    if (selections.movementClasses?.length > 0) programComponents.push('ongoing wellness classes');
    
    const hasWellnessBoxes = (sampleBoxQuantities.reduceStress || 0) + (sampleBoxQuantities.relaxationSleep || 0) + 
                             (sampleBoxQuantities.largeEmotional || 0) + (sampleBoxQuantities.largeStressReduction || 0) > 0 ||
                             (selections.customBoxQuantity || 0) > 0;
    if (hasWellnessBoxes) programComponents.push('wellness box incentives');

    if (programComponents.length === 0) {
      return null;
    }

    return {
      challenges: challengeLabels,
      components: programComponents
    };
  };

  const narrative = generateNarrative();

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
    
    // HOW THIS PROGRAM SUPPORTS YOUR TEAM
    if (narrative) {
      emailBody += `HOW THIS PROGRAM SUPPORTS YOUR TEAM%0D%0A`;
      emailBody += `======================================%0D%0A`;
      emailBody += `Your team is currently facing challenges around ${narrative.challenges.join(', ')}. `;
      emailBody += `This customized mental fitness program addresses these needs through ${narrative.components.join(', ')}, `;
      emailBody += `creating a comprehensive approach to building resilience, improving communication, and fostering a healthier workplace culture.%0D%0A%0D%0A`;
    }

    // YOUR PROGRAM AT A GLANCE
    emailBody += `YOUR PROGRAM AT A GLANCE%0D%0A`;
    emailBody += `======================================%0D%0A`;
    
    // Organization
    if (assessmentData.companySize || assessmentData.industry) {
      emailBody += `ORGANIZATION:%0D%0A`;
      if (assessmentData.industry) emailBody += `  Industry: ${assessmentData.industry}%0D%0A`;
      if (assessmentData.companySize) emailBody += `  Company Size: ${assessmentData.companySize}%0D%0A`;
      emailBody += `%0D%0A`;
    }
    
    // Focus Areas
    if (selections.challenges && selections.challenges.length > 0) {
      emailBody += `FOCUS AREAS:%0D%0A`;
      emailBody += `  ${selections.challenges.map(id => workforceChallenges.find(c => c.id === id)?.label).filter(Boolean).join(', ')}%0D%0A%0D%0A`;
    }

    // Program Components Summary
    const componentsList = [];
    if (selections.workshops?.length > 0) componentsList.push(`${selections.workshops.length} Workshops`);
    if (selections.challengePrograms?.length > 0) componentsList.push(`${selections.challengePrograms.length} Challenges`);
    if (selections.leadership?.length > 0) componentsList.push(`${selections.leadership.length} Leadership Programs`);
    if (selections.movementClasses?.length > 0) componentsList.push(`${selections.movementClasses.length} Classes`);
    
    const hasWellnessBoxes = (sampleBoxQuantities.reduceStress || 0) + (sampleBoxQuantities.relaxationSleep || 0) + 
                             (sampleBoxQuantities.largeEmotional || 0) + (sampleBoxQuantities.largeStressReduction || 0) > 0 ||
                             (selections.customBoxQuantity || 0) > 0;
    if (hasWellnessBoxes) componentsList.push('Wellness Boxes');

    if (componentsList.length > 0) {
      emailBody += `PROGRAM COMPONENTS:%0D%0A`;
      emailBody += `  ${componentsList.join(' • ')}%0D%0A%0D%0A`;
    }

    // Timeline
    if (assessmentData.timeline) {
      emailBody += `TIMELINE:%0D%0A`;
      emailBody += `  ${assessmentData.timeline}%0D%0A%0D%0A`;
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

    // DETAILED PROGRAM BREAKDOWN
    emailBody += `DETAILED PROGRAM BREAKDOWN%0D%0A`;
    emailBody += `======================================%0D%0A%0D%0A`;

    // Workshops
    if (selections.workshops && selections.workshops.length > 0) {
      emailBody += `WORKSHOPS (${selections.workshops.length})%0D%0A`;
      emailBody += `-------------------%0D%0A`;
      selections.workshops.forEach(key => {
        const workshop = productCatalog.workshops[key];
        if (workshop) {
          emailBody += `• ${workshop.name}%0D%0A`;
          emailBody += `  Price: $${workshop.price.toLocaleString()}%0D%0A`;
          emailBody += `  ${workshop.description}%0D%0A%0D%0A`;
        }
      });
    }

    // Challenges
    if (selections.challengePrograms && selections.challengePrograms.length > 0) {
      emailBody += `14-DAY CHALLENGES (${selections.challengePrograms.length})%0D%0A`;
      emailBody += `-------------------%0D%0A`;
      selections.challengePrograms.forEach(key => {
        const challenge = productCatalog.challenges[key];
        if (challenge) {
          emailBody += `• ${challenge.name}%0D%0A`;
          emailBody += `  Price: $${challenge.price.toLocaleString()}%0D%0A`;
          emailBody += `  ${challenge.description}%0D%0A%0D%0A`;
        }
      });
    }

    // Leadership
    if (selections.leadership && selections.leadership.length > 0) {
      emailBody += `LEADERSHIP PROGRAMS (${selections.leadership.length})%0D%0A`;
      emailBody += `-------------------%0D%0A`;
      selections.leadership.forEach(key => {
        const program = productCatalog.leadership[key];
        if (program) {
          emailBody += `• ${program.name}%0D%0A`;
          emailBody += `  Price: $${program.price.toLocaleString()}%0D%0A`;
          emailBody += `  ${program.description}%0D%0A%0D%0A`;
        }
      });
    }

    // Classes
    if (selections.movementClasses && selections.movementClasses.length > 0) {
      emailBody += `CLASSES (${selections.movementClasses.length})%0D%0A`;
      emailBody += `-------------------%0D%0A`;
      selections.movementClasses.forEach(key => {
        const classItem = productCatalog.movementClasses[key];
        if (classItem) {
          emailBody += `• ${classItem.name}%0D%0A`;
          emailBody += `  Price: $${classItem.price.toLocaleString()}%0D%0A`;
          emailBody += `  Duration: ${classItem.duration}%0D%0A`;
          emailBody += `  ${classItem.description}%0D%0A%0D%0A`;
        }
      });
    }

    // Wellness Boxes
    if (hasWellnessBoxes) {
      emailBody += `WELLNESS BOXES%0D%0A`;
      emailBody += `-------------------%0D%0A`;
      
      if (sampleBoxQuantities.reduceStress > 0) {
        emailBody += `• Reduce Stress Box (${sampleBoxQuantities.reduceStress} boxes)%0D%0A`;
        emailBody += `  Price: ${sampleBoxQuantities.reduceStress} x $65 = $${(sampleBoxQuantities.reduceStress * 65).toLocaleString()}%0D%0A`;
        emailBody += `  Includes: Heywell Calm + Hydrate, Calm Aromatherapy Patches, Squishy Dumpling Stress Ball, Sleep Gummies, Lavender Candle%0D%0A%0D%0A`;
      }
      
      if (sampleBoxQuantities.relaxationSleep > 0) {
        emailBody += `• Relaxation & Sleep Box (${sampleBoxQuantities.relaxationSleep} boxes)%0D%0A`;
        emailBody += `  Price: ${sampleBoxQuantities.relaxationSleep} x $65 = $${(sampleBoxQuantities.relaxationSleep * 65).toLocaleString()}%0D%0A`;
        emailBody += `  Includes: Weighted Eye Pillow, Herbal Bath Soak, Calming Tea, Eucalyptus Shower Steamers, Sleep Gummies%0D%0A%0D%0A`;
      }
      
      if (sampleBoxQuantities.largeEmotional > 0) {
        emailBody += `• Large Emotional Wellness Box (${sampleBoxQuantities.largeEmotional} boxes)%0D%0A`;
        emailBody += `  Price: ${sampleBoxQuantities.largeEmotional} x $125 = $${(sampleBoxQuantities.largeEmotional * 125).toLocaleString()}%0D%0A`;
        emailBody += `  Includes: Mindfulness Cards, Essential Oil Roller, Herbal Bath Soak, Calming Tea, Dark Chocolate, Spa Body Brush, Gold Eye Patches%0D%0A%0D%0A`;
      }
      
      if (sampleBoxQuantities.largeStressReduction > 0) {
        emailBody += `• Large Stress Reduction Box (${sampleBoxQuantities.largeStressReduction} boxes)%0D%0A`;
        emailBody += `  Price: ${sampleBoxQuantities.largeStressReduction} x $125 = $${(sampleBoxQuantities.largeStressReduction * 125).toLocaleString()}%0D%0A`;
        emailBody += `  Includes: Calm Patches, Calming Tea, Stress Ball, Essential Oil Roller, Mindfulness Cards, Herbal Bath Soak, Hot Cocoa, Heywell Drink, Cork Massage Balls%0D%0A%0D%0A`;
      }
      
      if (selections.customBoxQuantity > 0) {
        emailBody += `• Custom Wellness Boxes (${selections.customBoxQuantity} boxes)%0D%0A`;
        emailBody += `  Pricing: To be determined based on custom selection%0D%0A`;
        if (selections.customBoxItems && selections.customBoxItems.length > 0) {
          emailBody += `  Selected Items:%0D%0A`;
          selections.customBoxItems.forEach(item => {
            emailBody += `    - ${item.name} ($${item.price.toFixed(2)})%0D%0A`;
          });
        }
        emailBody += `%0D%0A`;
      }
    }

    // Total Investment
    emailBody += `%0D%0A======================================%0D%0A`;
    emailBody += `ESTIMATED TOTAL INVESTMENT%0D%0A`;
    emailBody += `======================================%0D%0A`;
    emailBody += `$${calculateTotal().toLocaleString()}%0D%0A`;
    emailBody += `(estimated before shipping`;
    if (selections.customBoxQuantity > 0) {
      emailBody += `, custom wellness boxes pricing to be determined`;
    }
    emailBody += `)%0D%0A%0D%0A`;

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

        .narrative-card {
          background: linear-gradient(135deg, rgba(119, 1, 66, 0.1), rgba(1, 63, 124, 0.1));
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 24px;
          border-left: 4px solid #770142;
        }

        @media (min-width: 768px) {
          .narrative-card {
            padding: 24px;
          }
        }

        .narrative-text {
          font-size: 15px;
          line-height: 1.7;
          color: #333;
        }

        @media (min-width: 768px) {
          .narrative-text {
            font-size: 16px;
          }
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

      {/* Program Narrative */}
      {narrative && (
        <div className="narrative-card">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 md:w-6 md:h-6" style={{ color: '#770142' }} />
            <h3 className="text-lg md:text-xl font-bold" style={{ color: '#770142' }}>
              How This Program Supports Your Team
            </h3>
          </div>
          <p className="narrative-text">
            Your team is currently facing challenges around <strong>{narrative.challenges.join(', ')}</strong>. 
            This customized mental fitness program addresses these needs through <strong>{narrative.components.join(', ')}</strong>, 
            creating a comprehensive approach to building resilience, improving communication, and fostering a healthier workplace culture.
          </p>
        </div>
      )}

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
              ((sampleBoxQuantities.reduceStress || 0) + (sampleBoxQuantities.relaxationSleep || 0) + 
              (sampleBoxQuantities.largeEmotional || 0) + (sampleBoxQuantities.largeStressReduction || 0) > 0 ||
              (selections.customBoxQuantity || 0) > 0) && 'Wellness Boxes'
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

        {((sampleBoxQuantities.reduceStress || 0) + (sampleBoxQuantities.relaxationSleep || 0) + 
          (sampleBoxQuantities.largeEmotional || 0) + (sampleBoxQuantities.largeStressReduction || 0) > 0 ||
          (selections.customBoxQuantity || 0) > 0) && (
          <div className="review-section">
            <div className="review-section-title">Wellness Boxes</div>
            {sampleBoxQuantities.reduceStress > 0 && (
              <div className="review-item">
                <span>Reduce Stress Boxes ({sampleBoxQuantities.reduceStress})</span>
                <span className="font-semibold">${(sampleBoxQuantities.reduceStress * 65).toLocaleString()}</span>
              </div>
            )}
            {sampleBoxQuantities.relaxationSleep > 0 && (
              <div className="review-item">
                <span>Relaxation & Sleep Boxes ({sampleBoxQuantities.relaxationSleep})</span>
                <span className="font-semibold">${(sampleBoxQuantities.relaxationSleep * 65).toLocaleString()}</span>
              </div>
            )}
            {sampleBoxQuantities.largeEmotional > 0 && (
              <div className="review-item">
                <span>Large Emotional Wellness Boxes ({sampleBoxQuantities.largeEmotional})</span>
                <span className="font-semibold">${(sampleBoxQuantities.largeEmotional * 125).toLocaleString()}</span>
              </div>
            )}
            {sampleBoxQuantities.largeStressReduction > 0 && (
              <div className="review-item">
                <span>Large Stress Reduction Boxes ({sampleBoxQuantities.largeStressReduction})</span>
                <span className="font-semibold">${(sampleBoxQuantities.largeStressReduction * 125).toLocaleString()}</span>
              </div>
            )}
            {selections.customBoxQuantity > 0 && (
              <div className="review-item">
                <span>Custom Wellness Boxes ({selections.customBoxQuantity})</span>
                <span className="font-semibold text-sm" style={{ color: '#666' }}>Contact for pricing</span>
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
            (estimated before shipping{selections.customBoxQuantity > 0 ? ', custom boxes pricing TBD' : ''})
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
