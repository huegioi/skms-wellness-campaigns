import React, { useState } from 'react';
import { productCatalog, workforceChallenges } from './catalogData';
import { calculateChallengePrice } from './pricingUtils';
import StepNavigation from './StepNavigation';
import { Sparkles, Target, CheckCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function ReviewStep({ selections, onBack, allServices = [] }) {
  // Helper: look up a service by ID in allServices, fall back to productCatalog static data
  const getServiceById = (id, catalogCategory) => {
    const fromDb = allServices.find(s => s.id === id);
    if (fromDb) return { name: fromDb.name, price: fromDb.price, description: fromDb.short_description || fromDb.description || '' };
    const fromCatalog = productCatalog[catalogCategory]?.[id];
    if (fromCatalog) return { name: fromCatalog.name, price: fromCatalog.price, description: fromCatalog.description || '' };
    return null;
  };
  const navigate = useNavigate();
  const [showMessage, setShowMessage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customCharges, setCustomCharges] = useState([]);
  const [newChargeLabel, setNewChargeLabel] = useState('');
  const [newChargeAmount, setNewChargeAmount] = useState('');

  // Get client info from assessment data
  const assessmentData = selections.assessmentData || {};
  const clientName = assessmentData.clientName || '';
  const clientEmail = assessmentData.clientEmail || '';
  const companyName = assessmentData.companyName || '';

  const sampleBoxQuantities = selections.sampleBoxQuantities || {};
  const customBoxItems = selections.customBoxItems || [];

  const challengePrice = calculateChallengePrice(assessmentData.companySize);

  const calculateTotal = () => {
    let total = 0;
    (selections.workshops || []).forEach(key => {
      total += getServiceById(key, 'workshops')?.price || 0;
    });
    (selections.challengePrograms || []).forEach(key => {
      total += challengePrice;
    });
    (selections.leadership || []).forEach(key => {
      total += getServiceById(key, 'leadership')?.price || 0;
    });
    (selections.movementClasses || []).forEach(key => {
      total += getServiceById(key, 'movementClasses')?.price || 0;
    });
    total += (sampleBoxQuantities.reduceStress || 0) * 65;
    total += (sampleBoxQuantities.relaxationSleep || 0) * 65;
    total += (sampleBoxQuantities.largeEmotional || 0) * 100;
    total += (sampleBoxQuantities.largeStressReduction || 0) * 100;
    if (selections.customBoxQuantity > 0 && customBoxItems.length > 0) {
      const customBoxTotal = customBoxItems.reduce((sum, item) => sum + item.price, 0);
      total += customBoxTotal * selections.customBoxQuantity;
    }
    // Add custom charges
    customCharges.forEach(charge => {
      total += charge.amount;
    });
    return total;
  };

  const addCustomCharge = () => {
    if (newChargeLabel.trim() && newChargeAmount) {
      setCustomCharges([...customCharges, {
        id: Date.now(),
        label: newChargeLabel.trim(),
        amount: parseFloat(newChargeAmount)
      }]);
      setNewChargeLabel('');
      setNewChargeAmount('');
    }
  };

  const removeCustomCharge = (id) => {
    setCustomCharges(customCharges.filter(c => c.id !== id));
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

  const generatePDF = () => {
    const customBoxTotal = customBoxItems.reduce((sum, item) => sum + item.price, 0);
    
    const pdfContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Mental Fitness Campaign Proposal - ${clientName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 40px;
            background: #ffffff;
            color: #333;
            line-height: 1.6;
          }
          .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 3px solid #013f7c;
          }
          h1 {
            color: #013f7c;
            font-size: 32px;
            margin-bottom: 10px;
          }
          .subtitle {
            color: #666;
            font-size: 16px;
          }
          .section {
            margin-bottom: 30px;
            page-break-inside: avoid;
          }
          .section-title {
            color: #013f7c;
            font-size: 20px;
            font-weight: 700;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 2px solid #cae5e3;
          }
          .narrative-box {
            background: linear-gradient(135deg, rgba(119, 1, 66, 0.05), rgba(1, 63, 124, 0.05));
            border-left: 4px solid #770142;
            padding: 20px;
            margin-bottom: 30px;
            border-radius: 8px;
          }
          .narrative-title {
            color: #770142;
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 12px;
          }
          .glance-box {
            background: linear-gradient(135deg, #264d44 0%, #013f7c 100%);
            color: white;
            padding: 25px;
            border-radius: 12px;
            margin-bottom: 30px;
          }
          .glance-item {
            margin-bottom: 15px;
          }
          .glance-label {
            color: #eaf995;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            margin-bottom: 5px;
          }
          .glance-content {
            font-size: 15px;
          }
          .item {
            margin-bottom: 20px;
            padding: 15px;
            background: #f9f9f9;
            border-radius: 8px;
          }
          .item-title {
            color: #264d44;
            font-weight: 700;
            font-size: 16px;
            margin-bottom: 5px;
          }
          .item-price {
            color: #770142;
            font-weight: 700;
            margin-bottom: 8px;
          }
          .item-description {
            color: #555;
            font-size: 14px;
            line-height: 1.5;
          }
          .total-box {
            background: linear-gradient(135deg, #770142, #441d37);
            color: white;
            padding: 25px;
            border-radius: 12px;
            margin-top: 30px;
            text-align: center;
          }
          .total-amount {
            font-size: 36px;
            font-weight: 700;
            margin: 10px 0;
          }
          .contact-info {
            background: #f4f0e9;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
          }
          .contact-row {
            margin-bottom: 8px;
          }
          .contact-label {
            font-weight: 700;
            color: #264d44;
            display: inline-block;
            width: 120px;
          }
          ul {
            margin-left: 20px;
            margin-top: 8px;
          }
          li {
            margin-bottom: 5px;
            color: #555;
          }
          @media print {
            body { padding: 20px; }
            .section { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Mental Fitness Campaign Proposal</h1>
          <div class="subtitle">Prepared by SkillfulMeans</div>
        </div>

        <div class="contact-info">
          <div class="contact-row"><span class="contact-label">Prepared For:</span> ${clientName}</div>
          ${companyName ? `<div class="contact-row"><span class="contact-label">Company:</span> ${companyName}</div>` : ''}
          <div class="contact-row"><span class="contact-label">Email:</span> ${clientEmail}</div>
          <div class="contact-row"><span class="contact-label">Date:</span> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>

        ${narrative ? `
          <div class="narrative-box">
            <div class="narrative-title">How This Program Supports Your Team</div>
            <p>Your team is currently facing challenges around <strong>${narrative.challenges.join(', ')}</strong>. 
            This customized mental fitness program addresses these needs through <strong>${narrative.components.join(', ')}</strong>, 
            creating a comprehensive approach to building resilience, improving communication, and fostering a healthier workplace culture.</p>
          </div>
        ` : ''}

        <div class="glance-box">
          <div style="font-size: 20px; font-weight: 700; margin-bottom: 20px;">Your Program at a Glance</div>
          
          ${(assessmentData.companySize || assessmentData.industry) ? `
            <div class="glance-item">
              <div class="glance-label">Organization</div>
              <div class="glance-content">
                ${assessmentData.industry ? assessmentData.industry : ''}${assessmentData.industry && assessmentData.companySize ? ' • ' : ''}${assessmentData.companySize ? assessmentData.companySize + ' employees' : ''}
              </div>
            </div>
          ` : ''}

          ${selections.challenges && selections.challenges.length > 0 ? `
            <div class="glance-item">
              <div class="glance-label">Focus Areas</div>
              <div class="glance-content">${selections.challenges.map(id => workforceChallenges.find(c => c.id === id)?.label).filter(Boolean).join(', ')}</div>
            </div>
          ` : ''}

          <div class="glance-item">
            <div class="glance-label">Program Components</div>
            <div class="glance-content">
              ${[
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

          ${assessmentData.timeline ? `
            <div class="glance-item">
              <div class="glance-label">Timeline</div>
              <div class="glance-content">${assessmentData.timeline}</div>
            </div>
          ` : ''}
        </div>

        ${selections.workshops && selections.workshops.length > 0 ? `
          <div class="section">
            <div class="section-title">Workshops (${selections.workshops.length})</div>
            ${selections.workshops.map(key => {
              const workshop = productCatalog.workshops[key];
              return workshop ? `
                <div class="item">
                  <div class="item-title">${workshop.name}</div>
                  <div class="item-price">$${workshop.price.toLocaleString()}</div>
                  <div class="item-description">${workshop.description}</div>
                </div>
              ` : '';
            }).join('')}
          </div>
        ` : ''}

        ${selections.challengePrograms && selections.challengePrograms.length > 0 ? `
          <div class="section">
            <div class="section-title">14-Day Challenges (${selections.challengePrograms.length})</div>
            ${selections.challengePrograms.map(key => {
              const challenge = productCatalog.challenges[key];
              return challenge ? `
                <div class="item">
                  <div class="item-title">${challenge.name}</div>
                  <div class="item-price">$${challenge.price.toLocaleString()}</div>
                  <div class="item-description">${challenge.description}</div>
                </div>
              ` : '';
            }).join('')}
          </div>
        ` : ''}

        ${selections.leadership && selections.leadership.length > 0 ? `
          <div class="section">
            <div class="section-title">Leadership Programs (${selections.leadership.length})</div>
            ${selections.leadership.map(key => {
              const program = productCatalog.leadership[key];
              return program ? `
                <div class="item">
                  <div class="item-title">${program.name}</div>
                  <div class="item-price">$${program.price.toLocaleString()}</div>
                  <div class="item-description">${program.description}</div>
                </div>
              ` : '';
            }).join('')}
          </div>
        ` : ''}

        ${selections.movementClasses && selections.movementClasses.length > 0 ? `
          <div class="section">
            <div class="section-title">Classes (${selections.movementClasses.length})</div>
            ${selections.movementClasses.map(key => {
              const classItem = productCatalog.movementClasses[key];
              return classItem ? `
                <div class="item">
                  <div class="item-title">${classItem.name}</div>
                  <div class="item-price">$${classItem.price.toLocaleString()}</div>
                  <div class="item-description"><strong>Duration:</strong> ${classItem.duration}<br>${classItem.description}</div>
                </div>
              ` : '';
            }).join('')}
          </div>
        ` : ''}

        ${((sampleBoxQuantities.reduceStress || 0) + (sampleBoxQuantities.relaxationSleep || 0) + 
          (sampleBoxQuantities.largeEmotional || 0) + (sampleBoxQuantities.largeStressReduction || 0) > 0 ||
          (selections.customBoxQuantity || 0) > 0) ? `
          <div class="section">
            <div class="section-title">Wellness Boxes</div>
            ${sampleBoxQuantities.reduceStress > 0 ? `
              <div class="item">
                <div class="item-title">Reduce Stress Box (${sampleBoxQuantities.reduceStress} boxes)</div>
                <div class="item-price">${sampleBoxQuantities.reduceStress} × $65 = $${(sampleBoxQuantities.reduceStress * 65).toLocaleString()}</div>
                <div class="item-description">
                  <strong>Includes:</strong>
                  <ul>
                    <li>Heywell Calm + Hydrate</li>
                    <li>Calm Aromatherapy Patches</li>
                    <li>Squishy Dumpling Stress Ball</li>
                    <li>Sleep Gummies</li>
                    <li>Lavender Candle</li>
                  </ul>
                </div>
              </div>
            ` : ''}
            ${sampleBoxQuantities.relaxationSleep > 0 ? `
              <div class="item">
                <div class="item-title">Relaxation & Sleep Box (${sampleBoxQuantities.relaxationSleep} boxes)</div>
                <div class="item-price">${sampleBoxQuantities.relaxationSleep} × $65 = $${(sampleBoxQuantities.relaxationSleep * 65).toLocaleString()}</div>
                <div class="item-description">
                  <strong>Includes:</strong>
                  <ul>
                    <li>Weighted Eye Pillow</li>
                    <li>Herbal Bath Soak</li>
                    <li>Calming Tea</li>
                    <li>Eucalyptus Shower Steamers</li>
                    <li>Sleep Gummies</li>
                  </ul>
                </div>
              </div>
            ` : ''}
            ${sampleBoxQuantities.largeEmotional > 0 ? `
              <div class="item">
                <div class="item-title">Large Emotional Wellness Box (${sampleBoxQuantities.largeEmotional} boxes)</div>
                <div class="item-price">${sampleBoxQuantities.largeEmotional} × $100 = $${(sampleBoxQuantities.largeEmotional * 100).toLocaleString()}</div>
                <div class="item-description">
                  <strong>Includes:</strong>
                  <ul>
                    <li>Mindfulness Cards</li>
                    <li>Essential Oil Roller</li>
                    <li>Herbal Bath Soak</li>
                    <li>Calming Tea</li>
                    <li>Dark Chocolate</li>
                    <li>Spa Body Brush</li>
                    <li>Gold Eye Patches</li>
                  </ul>
                </div>
              </div>
            ` : ''}
            ${sampleBoxQuantities.largeStressReduction > 0 ? `
              <div class="item">
                <div class="item-title">Large Stress Reduction Box (${sampleBoxQuantities.largeStressReduction} boxes)</div>
                <div class="item-price">${sampleBoxQuantities.largeStressReduction} × $100 = $${(sampleBoxQuantities.largeStressReduction * 100).toLocaleString()}</div>
                <div class="item-description">
                  <strong>Includes:</strong>
                  <ul>
                    <li>Calm Patches</li>
                    <li>Calming Tea</li>
                    <li>Stress Ball</li>
                    <li>Essential Oil Roller</li>
                    <li>Mindfulness Cards</li>
                    <li>Herbal Bath Soak</li>
                    <li>Hot Cocoa</li>
                    <li>Heywell Drink</li>
                    <li>Cork Massage Balls</li>
                  </ul>
                </div>
              </div>
            ` : ''}
            ${selections.customBoxQuantity > 0 && customBoxItems.length > 0 ? `
              <div class="item">
                <div class="item-title">Custom Wellness Boxes (${selections.customBoxQuantity} boxes)</div>
                <div class="item-price">${selections.customBoxQuantity} × $${customBoxTotal.toFixed(2)} = $${(customBoxTotal * selections.customBoxQuantity).toLocaleString()}</div>
                <div class="item-description">
                  <strong>Selected Items:</strong>
                  <ul>
                    ${customBoxItems.map(item => `<li>${item.name} ($${item.price.toFixed(2)})</li>`).join('')}
                  </ul>
                </div>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <div class="total-box">
          <div style="font-size: 18px; margin-bottom: 10px;">Estimated Total Investment</div>
          <div class="total-amount">$${calculateTotal().toLocaleString()}</div>
          <div style="font-size: 14px; opacity: 0.9;">(estimated before shipping)</div>
        </div>

        <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #ccc; text-align: center; color: #666;">
          <p>Looking forward to co-creating this mental fitness campaign with SkillfulMeans!</p>
          <p style="margin-top: 10px; font-size: 14px;">Contact: admin@skillfulmeans.life</p>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([pdfContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Mental-Fitness-Campaign-Proposal-${clientName.replace(/\s+/g, '-')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async () => {
    if (!clientName || !clientEmail) {
      alert('Please go back and fill in the client name and email in the Assessment step.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      console.log('Starting proposal submission...');
      // Check if client already exists by email
      const existingClients = await base44.entities.Client.filter({ email: clientEmail });
      let clientId = null;
      
      // Map company size to enum value
      const getCompanySizeEnum = (size) => {
        const num = parseInt(size, 10);
        if (!num) return null;
        if (num <= 50) return '1-50';
        if (num <= 200) return '51-200';
        if (num <= 500) return '201-500';
        if (num <= 1000) return '501-1000';
        if (num <= 5000) return '1001-5000';
        return '5000+';
      };

      const companySizeEnum = getCompanySizeEnum(assessmentData.companySize);

      if (existingClients.length > 0) {
        // Update existing client
        clientId = existingClients[0].id;
        await base44.entities.Client.update(clientId, {
          name: clientName,
          company: companyName,
          wellness_budget: assessmentData.wellnessBudget ? parseFloat(assessmentData.wellnessBudget) : null,
          industry: assessmentData.industry || null,
          company_size: companySizeEnum,
          last_contacted: new Date().toISOString(),
          notes: [
            assessmentData.brokerName && `Broker: ${assessmentData.brokerName}${assessmentData.brokerCompany ? ` (${assessmentData.brokerCompany})` : ''}`,
            assessmentData.consultantName && `Consultant: ${assessmentData.consultantName}${assessmentData.consultantCompany ? ` (${assessmentData.consultantCompany})` : ''}`
          ].filter(Boolean).join('\n') || null
        });
      } else {
        // Create new client
        const newClient = await base44.entities.Client.create({
          name: clientName,
          email: clientEmail,
          company: companyName,
          wellness_budget: assessmentData.wellnessBudget ? parseFloat(assessmentData.wellnessBudget) : null,
          industry: assessmentData.industry || null,
          company_size: companySizeEnum,
          last_contacted: new Date().toISOString(),
          notes: [
            assessmentData.brokerName && `Broker: ${assessmentData.brokerName}${assessmentData.brokerCompany ? ` (${assessmentData.brokerCompany})` : ''}`,
            assessmentData.consultantName && `Consultant: ${assessmentData.consultantName}${assessmentData.consultantCompany ? ` (${assessmentData.consultantCompany})` : ''}`
          ].filter(Boolean).join('\n') || null
        });
        clientId = newClient.id;
      }

      // Create proposal linked to client
      const proposalData = {
        client_id: clientId,
        client_name: clientName,
        client_email: clientEmail,
        company: companyName,
        total_amount: calculateTotal(),
        narrative_summary: narrative ? `Your team is currently facing challenges around ${narrative.challenges.join(', ')}. This customized mental fitness program addresses these needs through ${narrative.components.join(', ')}, creating a comprehensive approach to building resilience, improving communication, and fostering a healthier workplace culture.` : null,
        selections: {
          workshops: selections.workshops || [],
          challengePrograms: selections.challengePrograms || [],
          leadership: selections.leadership || [],
          movementClasses: selections.movementClasses || [],
          sampleBoxQuantities: {
            reduceStress: sampleBoxQuantities.reduceStress || 0,
            relaxationSleep: sampleBoxQuantities.relaxationSleep || 0,
            largeEmotional: sampleBoxQuantities.largeEmotional || 0,
            largeStressReduction: sampleBoxQuantities.largeStressReduction || 0
          },
          challengePrice: challengePrice,
          customBoxQuantity: selections.customBoxQuantity || 0,
          customBoxItems: customBoxItems || [],
          customCharges: customCharges || [],
          assessmentData: selections.assessmentData || {},
          challenges: selections.challenges || []
        },
        status: 'draft'
      };

      const newProposal = await base44.entities.Proposal.create(proposalData);
      console.log('Proposal created successfully:', newProposal);
      
      setShowMessage(true);
    } catch (error) {
      console.error('Error submitting proposal:', error);
      alert(`Error submitting proposal: ${error.message || 'Please try again'}`);
    } finally {
      setIsSubmitting(false);
    }
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

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content {
          background: linear-gradient(135deg, #264d44 0%, #013f7c 100%);
          color: white;
          border-radius: 20px;
          padding: 40px;
          max-width: 600px;
          width: 100%;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        .modal-content h2 {
          font-size: 28px;
          margin-bottom: 24px;
          color: #eaf995;
        }

        .modal-content p {
          font-size: 16px;
          line-height: 1.8;
          margin-bottom: 16px;
        }

        @media (min-width: 768px) {
          .modal-content {
            padding: 50px;
          }
          .modal-content h2 {
            font-size: 32px;
          }
          .modal-content p {
            font-size: 18px;
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

        {/* Services Included */}
        {(selections.workshops?.length > 0 || selections.challengePrograms?.length > 0 || selections.leadership?.length > 0) && (
          <div className="summary-section">
            <div className="summary-title">Services Included</div>
            <div className="summary-content">
              <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: '1.8' }}>
                {selections.workshops?.length > 0 && (
                  <>
                    <li>Customizable email templates for each workshop</li>
                    <li>Handouts, recordings & PowerPoint PDF for each workshop</li>
                  </>
                )}
                {selections.challengePrograms?.length > 0 && (
                  <>
                    <li>Customizable email templates for each challenge</li>
                    <li>App access for challenges</li>
                  </>
                )}
                {selections.leadership?.length > 0 && (
                  <>
                    <li>Before and after assessments</li>
                    <li>ROI report</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        )}

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
              {selections.workshops.map(key => {
                const svc = getServiceById(key, 'workshops');
                return (
                  <div key={key} className="review-item">
                    <span>{svc?.name || key}</span>
                    <span className="font-semibold">${(svc?.price || 0).toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          )}

        {selections.challengePrograms && selections.challengePrograms.length > 0 && (
            <div className="review-section">
              <div className="review-section-title">14-Day Challenges ({selections.challengePrograms.length})</div>
              {selections.challengePrograms.map(key => {
                const svc = getServiceById(key, 'challenges');
                return (
                  <div key={key} className="review-item">
                    <span>{svc?.name || key}</span>
                    <span className="font-semibold">${challengePrice.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          )}

        {selections.leadership && selections.leadership.length > 0 && (
            <div className="review-section">
              <div className="review-section-title">Leadership Programs</div>
              {selections.leadership.map(key => {
                const svc = getServiceById(key, 'leadership');
                return (
                  <div key={key} className="review-item">
                    <span>{svc?.name || key}</span>
                    <span className="font-semibold">${(svc?.price || 0).toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          )}

        {selections.movementClasses && selections.movementClasses.length > 0 && (
            <div className="review-section">
              <div className="review-section-title">Classes</div>
              {selections.movementClasses.map(key => {
                const svc = getServiceById(key, 'movementClasses');
                return (
                  <div key={key} className="review-item">
                    <span>{svc?.name || key}</span>
                    <span className="font-semibold">${(svc?.price || 0).toLocaleString()}</span>
                  </div>
                );
              })}
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
                <span className="font-semibold">${(sampleBoxQuantities.largeEmotional * 100).toLocaleString()}</span>
              </div>
            )}
            {sampleBoxQuantities.largeStressReduction > 0 && (
              <div className="review-item">
                <span>Large Stress Reduction Boxes ({sampleBoxQuantities.largeStressReduction})</span>
                <span className="font-semibold">${(sampleBoxQuantities.largeStressReduction * 100).toLocaleString()}</span>
              </div>
            )}
            {selections.customBoxQuantity > 0 && customBoxItems.length > 0 && (
              <div className="review-item">
                <span>Custom Wellness Boxes ({selections.customBoxQuantity})</span>
                <span className="font-semibold">${(customBoxItems.reduce((sum, item) => sum + item.price, 0) * selections.customBoxQuantity).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Custom Charges Section */}
        <div className="review-section">
          <div className="review-section-title">Additional Charges</div>

          {customCharges.map(charge => (
            <div key={charge.id} className="review-item">
              <span>{charge.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold">${charge.amount.toLocaleString()}</span>
                <button
                  onClick={() => removeCustomCharge(charge.id)}
                  className="text-red-500 hover:text-red-700 text-sm font-bold"
                  style={{ marginLeft: '8px' }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}

          <div className="flex gap-2 mt-3 flex-wrap">
            <input
              type="text"
              className="neuro-input flex-1"
              placeholder="Charge label..."
              value={newChargeLabel}
              onChange={(e) => setNewChargeLabel(e.target.value)}
              style={{ minWidth: '150px' }}
            />
            <input
              type="number"
              className="neuro-input"
              placeholder="Amount"
              value={newChargeAmount}
              onChange={(e) => setNewChargeAmount(e.target.value)}
              style={{ width: '120px' }}
            />
            <button
              type="button"
              onClick={addCustomCharge}
              className="px-4 py-2 rounded-lg font-semibold text-white"
              style={{ background: '#264d44' }}
            >
              Add
            </button>
          </div>
        </div>

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

      {/* Client Info Summary */}
      {!showMessage && (
        <div className="review-card">
          <h3 className="text-xl md:text-2xl font-bold mb-4" style={{ color: '#264d44' }}>
            Client Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-semibold text-gray-600">Name:</span>
              <span className="ml-2">{clientName || 'Not provided'}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-600">Email:</span>
              <span className="ml-2">{clientEmail || 'Not provided'}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-600">Company:</span>
              <span className="ml-2">{companyName || 'Not provided'}</span>
            </div>
            {assessmentData.wellnessBudget && (
              <div>
                <span className="font-semibold text-gray-600">Wellness Budget:</span>
                <span className="ml-2">${parseInt(assessmentData.wellnessBudget).toLocaleString()}</span>
              </div>
            )}
          </div>
          
          {(!clientName || !clientEmail) && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
              Please go back to the Assessment step and fill in the client name and email.
            </div>
          )}
        </div>
      )}

      {/* Submit Button */}
      {!showMessage && (
        <StepNavigation
          onBack={onBack}
          onNext={handleSubmit}
          nextLabel={isSubmitting ? "Submitting..." : "Submit Proposal"}
          isLastStep={true}
          disabled={isSubmitting || !clientName || !clientEmail}
        />
      )}

      {/* Success Modal */}
      {showMessage && (
        <div className="modal-overlay">
          <div className="modal-content">
            <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: '#eaf995' }} />
            <h2>Proposal Submitted!</h2>
            <p>
              The proposal for <strong>{clientName}</strong> has been saved successfully.
            </p>
            <p>
              The client has been added to your Clients list and the proposal is ready to be sent.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => navigate(createPageUrl('Proposals'))}
                className="px-6 py-3 rounded-lg font-semibold text-white"
                style={{ background: '#770142' }}
              >
                View Proposals
              </button>
              <button
                onClick={() => navigate(createPageUrl('Clients'))}
                className="px-6 py-3 rounded-lg font-semibold"
                style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}
              >
                View Clients
              </button>
              <button
                onClick={generatePDF}
                className="px-6 py-3 rounded-lg font-semibold"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
              >
                Download Proposal PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}