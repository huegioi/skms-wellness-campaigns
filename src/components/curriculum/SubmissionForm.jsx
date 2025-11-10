import React, { useState } from 'react';
import { productCatalog } from './catalogData';

export default function SubmissionForm({ selectedPainPoints, selectedPlan, planConfigs, stepperValues }) {
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: ''
  });
  const [showSuccess, setShowSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Get the selected plan config
    const config = planConfigs[selectedPlan];
    
    // Calculate selected plan price
    let selectedPlanPrice = 0;
    if (config) {
      config.workshops.forEach(key => {
        selectedPlanPrice += productCatalog.workshops[key]?.price || 0;
      });
      config.challenges.forEach(key => {
        selectedPlanPrice += productCatalog.challenges[key]?.price || 0;
      });
      config.coaching.forEach(key => {
        selectedPlanPrice += productCatalog.coaching[key]?.price || 0;
      });
      selectedPlanPrice += stepperValues.small * 65;
      selectedPlanPrice += stepperValues.large * 125;
    }

    // Build email body
    let emailBody = `Hi, I am interested in co-creating a curriculum with SkillfulMeans...%0D%0A%0D%0A`;
    emailBody += `Name: ${formData.name}%0D%0A`;
    emailBody += `Company: ${formData.company || 'N/A'}%0D%0A`;
    emailBody += `Email: ${formData.email}%0D%0A%0D%0A`;
    emailBody += `Selected Plan: ${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}%0D%0A`;
    emailBody += `Estimated Price: $${selectedPlanPrice.toLocaleString()}%0D%0A%0D%0A`;
    
    emailBody += `Selected Pain Points:%0D%0A`;
    Array.from(selectedPainPoints).forEach(point => {
      emailBody += `- ${point}%0D%0A`;
    });
    emailBody += `%0D%0A`;
    
    if (config) {
      emailBody += `Recommended Workshops:%0D%0A`;
      config.workshops.forEach(key => {
        emailBody += `- ${productCatalog.workshops[key]?.name}%0D%0A`;
      });
      emailBody += `%0D%0A`;

      emailBody += `Recommended Challenges:%0D%0A`;
      config.challenges.forEach(key => {
        emailBody += `- ${productCatalog.challenges[key]?.name}%0D%0A`;
      });
      emailBody += `%0D%0A`;

      if (config.coaching.length > 0) {
        emailBody += `Coaching Programs:%0D%0A`;
        config.coaching.forEach(key => {
          emailBody += `- ${productCatalog.coaching[key]?.name}%0D%0A`;
        });
        emailBody += `%0D%0A`;
      }
    }

    emailBody += `Wellness Boxes:%0D%0A`;
    emailBody += `- Small Boxes: ${stepperValues.small}%0D%0A`;
    emailBody += `- Large Boxes: ${stepperValues.large}%0D%0A`;

    const mailtoLink = `mailto:admin@skillfulmeans.life?subject=Curriculum Design Inquiry from ${formData.name}&body=${emailBody}`;

    // Show success message
    setShowSuccess(true);

    // Trigger mailto after 2.5 seconds
    setTimeout(() => {
      window.location.href = mailtoLink;
    }, 2500);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <style>{`
        .neuro-card {
          background: #f4f0e9;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 
            8px 8px 16px rgba(0, 0, 0, 0.12),
            -8px -8px 16px rgba(255, 255, 255, 0.9);
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

        .neuro-submit {
          background: #441d37;
          color: white;
          border: none;
          border-radius: 12px;
          padding: 14px 32px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          width: 100%;
          box-shadow: 
            6px 6px 12px rgba(0, 0, 0, 0.2),
            -6px -6px 12px rgba(255, 255, 255, 0.1);
          transition: all 0.2s ease;
        }

        .neuro-submit:hover {
          box-shadow: 
            8px 8px 16px rgba(0, 0, 0, 0.25),
            -8px -8px 16px rgba(255, 255, 255, 0.15);
        }

        .neuro-submit:active {
          box-shadow: 
            inset 4px 4px 8px rgba(0, 0, 0, 0.3),
            inset -4px -4px 8px rgba(255, 255, 255, 0.1);
        }

        .success-message {
          background: #e8f5e9;
          color: #2e7d32;
          padding: 16px;
          border-radius: 12px;
          margin-top: 16px;
          box-shadow: 
            inset 2px 2px 4px rgba(0, 0, 0, 0.05),
            inset -2px -2px 4px rgba(255, 255, 255, 0.5);
        }
      `}</style>

      <div className="neuro-card">
        <h3 className="text-2xl font-bold mb-5" style={{ color: '#013f7c' }}>
          Ready to Get Started?
        </h3>

        {!showSuccess ? (
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
                Enter your email *
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

            <button type="submit" className="neuro-submit">
              Submit
            </button>
          </form>
        ) : (
          <div className="success-message">
            <strong>Thank you!</strong> Please complete sending the email from your mail client. A member of our team will follow up with you as soon as possible.
          </div>
        )}
      </div>
    </div>
  );
}