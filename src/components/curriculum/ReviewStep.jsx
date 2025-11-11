import React, { useState } from 'react';
import { productCatalog, workforceChallenges, challengeSolutionMap } from './catalogData';
import StepNavigation from './StepNavigation';
import { Sparkles } from 'lucide-react';

export default function ReviewStep({ selections, onBack }) {
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: ''
  });
  const [showSuccess, setShowSuccess] = useState(false);

  // Generate narrative based on workforce challenges
  const generateNarrative = () => {
    if (!selections.challenges || selections.challenges.length === 0) {
      return "Your customized mental fitness campaign combines carefully selected programs to support your team's growth and well-being.";
    }

    const challengeLabels = selections.challenges
      .map(id => workforceChallenges.find(c => c.id === id)?.label)
      .filter(Boolean);

    let narrative = `Based on your assessment, your workforce is facing challenges with ${challengeLabels.slice(0, -1).join(', ')}${challengeLabels.length > 1 ? ' and ' + challengeLabels[challengeLabels.length - 1] : challengeLabels[0]}. `;
    
    narrative += "Your customized SkillfulMeans campaign directly addresses these needs:\n\n";

    // Workshops
    if (selections.workshops && selections.workshops.length > 0) {
      narrative += "**Workshops**: ";
      const workshopNames = selections.workshops.map(key => productCatalog.workshops[key]?.name).filter(Boolean);
      narrative += `The selected workshops (${workshopNames.join(', ')}) provide foundational knowledge and practical tools to build resilience, improve communication, and create a supportive work environment.\n\n`;
    }

    // Challenges
    if (selections.challengePrograms && selections.challengePrograms.length > 0) {
      narrative += "**14-Day Challenges**: ";
      const challengeNames = selections.challengePrograms.map(key => productCatalog.challenges[key]?.name).filter(Boolean);
      narrative += `These challenges (${challengeNames.join(', ')}) reinforce workshop learnings through daily practices, creating lasting behavioral change and team engagement.\n\n`;
    }

    // Leadership
    if (selections.leadership && selections.leadership.length > 0) {
      narrative += "**Leadership Development**: ";
      narrative += "Your leadership programs equip managers with emotional intelligence skills to model healthy behaviors, support their teams effectively, and create psychologically safe work environments.\n\n";
    }

    // Movement Classes
    if (selections.movementClasses && selections.movementClasses.length > 0) {
      narrative += "**Movement & Mindfulness**: ";
      narrative += "Ongoing classes provide consistent touchpoints for physical wellness, stress reduction, and community building, addressing both mental and physical aspects of well-being.\n\n";
    }

    // Wellness Boxes
    if (selections.smallBoxes > 0 || selections.largeBoxes > 0) {
      narrative += "**Wellness Incentives**: ";
      narrative += "Wellness boxes serve as tangible recognition of participation, boosting engagement and showing your organization's commitment to employee well-being.\n\n";
    }

    narrative += "Together, these programs create a comprehensive mental fitness ecosystem that will help your workforce thrive.";

    return narrative;
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
    
    if (selections.challenges && selections.challenges.length > 0) {
      emailBody += `Workforce Challenges:%0D%0A`;
      selections.challenges.forEach(id => {
        const challenge = workforceChallenges.find(c => c.id === id);
        emailBody += `- ${challenge?.label}%0D%0A`;
      });
      emailBody += `%0D%0A`;
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

        .narrative-content {
          line-height: 1.8;
          white-space: pre-wrap;
        }

        .narrative-content strong {
          font-weight: 700;
          display: block;
          margin-top: 12px;
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
          Review Your Campaign
        </h2>
        <p className="text-lg" style={{ color: '#666' }}>
          See how your customized campaign addresses your workforce needs.
        </p>
      </div>

      {/* Personalized Narrative */}
      <div className="narrative-card">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-6 h-6" />
          <h3 className="text-xl font-bold">Your Personalized Campaign Story</h3>
        </div>
        <div className="narrative-content">
          {generateNarrative()}
        </div>
      </div>

      {/* Summary */}
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
            Your Information
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