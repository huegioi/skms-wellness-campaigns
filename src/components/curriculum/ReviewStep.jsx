import React, { useState, useEffect } from 'react';
import { productCatalog, workforceChallenges, challengeSolutionMap } from './catalogData';
import StepNavigation from './StepNavigation';
import { Sparkles, Target } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

export default function ReviewStep({ selections, onBack }) {
  const urlParams = new URLSearchParams(window.location.search);
  const clientId = urlParams.get('clientId');

  const { data: client } = useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const clients = await base44.entities.Client.filter({ id: clientId });
      return clients[0] || null;
    },
    enabled: !!clientId
  });

  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: ''
  });
  const [showMessage, setShowMessage] = useState(false);
  const [downloadReady, setDownloadReady] = useState(false);
  const [customCharges, setCustomCharges] = useState([]);
  const [newChargeLabel, setNewChargeLabel] = useState('');
  const [newChargeAmount, setNewChargeAmount] = useState('');

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || '',
        company: client.company || '',
        email: client.email || ''
      });
    }
  }, [client]);

  const assessmentData = selections.assessmentData || {};
  const sampleBoxQuantities = selections.sampleBoxQuantities || {};
  const customBoxItems = selections.customBoxItems || [];

  // Calculate challenge price based on company size
  const calculateChallengePrice = () => {
    const companySize = assessmentData.companySize || '';
    const employees = parseInt(companySize, 10);
    
    if (!employees || employees <= 0) {
      return 1500; // Default if no size entered
    }

    let pricePerParticipant = 25;
    if (employees >= 200) {
      pricePerParticipant = 20;
    } else if (employees >= 50) {
      pricePerParticipant = 22;
    }

    const participants = Math.ceil(employees * 0.30);
    return participants * pricePerParticipant;
  };

  const challengePrice = calculateChallengePrice();

  const calculateTotal = () => {
    let total = 0;
    (selections.workshops || []).forEach(key => {
      total += productCatalog.workshops[key]?.price || 0;
    });
    (selections.challengePrograms || []).forEach(key => {
      total += challengePrice;
    });
    (selections.leadership || []).forEach(key => {
      total += productCatalog.leadership[key]?.price || 0;
    });
    (selections.movementClasses || []).forEach(key => {
      total += productCatalog.movementClasses[key]?.price || 0;
    });
    total += (sampleBoxQuantities.reduceStress || 0) * 65;
    total += (sampleBoxQuantities.relaxationSleep || 0) * 65;
    total += (sampleBoxQuantities.largeEmotional || 0) * 125;
    total += (sampleBoxQuantities.largeStressReduction || 0) * 125;
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
        <title>Mental Fitness Campaign Proposal - ${formData.name}</title>
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
          <div class="contact-row"><span class="contact-label">Prepared For:</span> ${formData.name}</div>
          ${formData.company ? `<div class="contact-row"><span class="contact-label">Company:</span> ${formData.company}</div>` : ''}
          <div class="contact-row"><span class="contact-label">Email:</span> ${formData.email}</div>
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
                <div class="item-price">${sampleBoxQuantities.largeEmotional} × $125 = $${(sampleBoxQuantities.largeEmotional * 125).toLocaleString()}</div>
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
                <div class="item-price">${sampleBoxQuantities.largeStressReduction} × $125 = $${(sampleBoxQuantities.largeStressReduction * 125).toLocaleString()}</div>
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
    a.download = `Mental-Fitness-Campaign-Proposal-${formData.name.replace(/\s+/g, '-')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Save proposal to database
    const proposalData = {
      client_id: clientId || null,
      client_name: formData.name,
      company: formData.company,
      total_amount: calculateTotal(),
      selections: {
        workshops: selections.workshops,
        challengePrograms: selections.challengePrograms,
        leadership: selections.leadership,
        movementClasses: selections.movementClasses,
        sampleBoxQuantities: sampleBoxQuantities,
        customBoxQuantity: selections.customBoxQuantity,
        customBoxItems: customBoxItems,
        customCharges: customCharges,
        assessmentData: selections.assessmentData,
        challenges: selections.challenges
      },
      status: 'draft'
    };

    await base44.entities.Proposal.create(proposalData);
    
    // Update client's last_contacted date if linked to a client
    if (clientId) {
      await base44.entities.Client.update(clientId, { last_contacted: new Date().toISOString() });
    }
    
    setShowMessage(true);
    
    setTimeout(() => {
      generatePDF();
      setDownloadReady(true);
    }, 12000);
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

      {/* Contact Form */}
      {!showMessage && (
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
      )}

      {/* Modal */}
      {showMessage && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Thank You!</h2>
            <p>
              Thank you for taking the time to build your proposed wellness campaign with SkillfulMeans.
            </p>
            <p>
              In a moment, you will be prompted to download a copy of your campaign. Please follow up by attaching your summary and emailing <strong>admin@skillfulmeans.life</strong>.
            </p>
            <p>
              A member of our team will follow up with you asap to get you started.
            </p>
            {downloadReady && (
              <p className="mt-6" style={{ color: '#eaf995', fontSize: '14px' }}>
                ✓ Your campaign summary has been downloaded!
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}