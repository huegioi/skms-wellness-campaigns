import React, { useState } from 'react';
import StepNavigation from './StepNavigation';
import { ChevronDown, ChevronUp, Package } from 'lucide-react';

export default function WellnessBoxStep({ selections, updateSelections, onNext, onBack }) {
  const [showItems, setShowItems] = useState(false);
  const [showSmallSamples, setShowSmallSamples] = useState(false);
  const [showLargeSamples, setShowLargeSamples] = useState(false);

  const updateStepper = (type, increment) => {
    const currentValue = selections[type];
    const newValue = increment ? currentValue + 1 : Math.max(0, currentValue - 1);
    updateSelections(type, newValue);
  };

  const wellnessItems = [
    "Tumbler Shot Glass with Metal Straw and Lid",
    "Canvas Gym Bag",
    "Skelcore Dual Wheel Massage Roller",
    "Fitbit Inspire Activity Tracker",
    "Bright Eyes Collagen Eye Mask",
    "Sweet Dream Drops: Lavender & Magnesium Bath Bombs",
    "Custom Printed Cotton Tote Bags",
    "Custom Printed Clear Glass Coffee Mug",
    "Custom Black Lip Ceramic Camper Mug",
    "Private Label Floral Bath Salt Soak in Test Tubes",
    "Custom Logo Journal - Business Branding Notebook",
    "Custom Logo Candles",
    "Engraved Wood Bottle Opener",
    "Skelcore Deep Tissue Massage Ball",
    "Lavender Aromatherapy Candle",
    "Wood Wick Candle - Multiple Scents",
    "Skinny Tumbler",
    "Herbal Bath Salts - Personalizable",
    "Body Restore Shower Steamer/Bath Bomb",
    "Mini Foot Massage Roller",
    "Spa Body Brush",
    "Heywell Calm + Hydrate Sparkling Lime",
    "Mindfulness Cards",
    "Essential Oil Roller",
    "Sleep Gummies",
    "Calming Tea Herbal Blend",
    "Eucalyptus Shower Steamers",
    "Squishing Dumpling Stress Ball",
    "2 in 1 Stretch Belt & Yoga Slings",
    "Stretchy Workout Band",
    "Calm Aromatherapy Inhaler Patches",
    "Relaxation & Self Care Gift Set",
    "Muscle Relief Bath Soak Pouch - Epsom Salt + Eucalyptus Oil",
    "Facial & Body Massage Tool Set - Natural Quartz",
    "Yogasleep Sound Machine",
    "Weighted Aromatherapy Eye Pillow",
    "Dreamy Dark Chocolate Hot Cocoa",
    "Merry Mint Holiday Candle",
    "Holiday Warming Tea Blend",
    "Sinus Relief Roll-On",
    "Breathe Congestion Helping Aromatherapy Patches",
    "Pumpkin + Spices Mini Amber Jar Soy Candle",
    "Lavender Vanilla Tin Soy Candle",
    "Sensory Sleep Escape Self-Heating Eye Mask",
    "Sleeping Eye Mask - Soft Breathable",
    "Gold Under Eye Patches - Collagen Eye Mask",
    "Cooling Gel Eye Mask",
    "Mindfulness Lavender Relaxation Eye Pillows",
    "Trigger Point Single Massage Ball",
    "Cork Massage Balls",
    "Calm Absorbent Vitamin Patch",
    "Meditation Cushion"
  ];

  const smallBoxSamples = [
    {
      name: "Reduce Stress Wellness Box",
      items: [
        "Heywell Calm + Hydrate Sparkling Lime",
        "Calm Aromatherapy Patches",
        "Creamy Milk Chocolate Bar",
        "Squishy Dumpling Stress Ball",
        "Calm Absorbent Vitamin Patch",
        "2 Custom Printed Wellness Fliers"
      ]
    },
    {
      name: "Relaxation & Sleep Box",
      items: [
        "Heywell Calm + Hydrate Sparkling Lime",
        "Calm Aromatherapy Patches",
        "Weighted Aromatherapy Eye Pillow",
        "Herbal Bath Soak",
        "Sleep Gummies",
        "2 Custom Printed Wellness Fliers"
      ]
    }
  ];

  const largeBoxSamples = [
    {
      name: "Large Emotional Wellness Box",
      items: [
        "Mindfulness Cards",
        "Herbal Bath Soak",
        "Calming Tea",
        "Dreamy Dark Chocolate Bar",
        "Meditation Cushion",
        "2 Custom Printed Wellness Fliers"
      ]
    },
    {
      name: "Large Stress Reduction Box",
      items: [
        "Calm Aromatherapy Patches",
        "Calming Tea",
        "Squishy Dumpling Stress Ball",
        "Essential Oil Roller",
        "Mindfulness Cards",
        "Herbal Bath Soak",
        "Dreamy Dark Chocolate Bar",
        "Heywell Calm + Hydrate Sparkling Lime",
        "Calm Absorbent Vitamin Patch",
        "2 Custom Printed Wellness Fliers"
      ]
    }
  ];

  return (
    <div>
      <style>{`
        .neuro-stepper {
          background: #f4f0e9;
          border-radius: 12px;
          padding: 8px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 
            inset 3px 3px 6px rgba(0, 0, 0, 0.1),
            inset -3px -3px 6px rgba(255, 255, 255, 0.8);
        }

        .neuro-stepper-btn {
          background: #f4f0e9;
          border: none;
          width: 40px;
          height: 40px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 20px;
          color: #441d37;
          font-weight: bold;
          box-shadow: 
            4px 4px 8px rgba(0, 0, 0, 0.12),
            -4px -4px 8px rgba(255, 255, 255, 0.9);
          transition: all 0.2s ease;
        }

        .neuro-stepper-btn:hover {
          box-shadow: 
            3px 3px 6px rgba(0, 0, 0, 0.15),
            -3px -3px 6px rgba(255, 255, 255, 0.95);
        }

        .neuro-stepper-btn:active {
          box-shadow: 
            inset 2px 2px 4px rgba(0, 0, 0, 0.2),
            inset -2px -2px 4px rgba(255, 255, 255, 0.1);
        }

        .box-card {
          background: #f4f0e9;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 
            8px 8px 16px rgba(0, 0, 0, 0.12),
            -8px -8px 16px rgba(255, 255, 255, 0.9);
          margin-bottom: 20px;
        }

        .expandable-section {
          background: #f4f0e9;
          border-radius: 12px;
          padding: 16px;
          margin-top: 16px;
          box-shadow: 
            4px 4px 8px rgba(0, 0, 0, 0.08),
            -4px -4px 8px rgba(255, 255, 255, 0.9);
        }

        .expandable-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          padding: 8px;
          border-radius: 8px;
          transition: background 0.2s;
        }

        .expandable-header:hover {
          background: rgba(234, 249, 149, 0.2);
        }

        .items-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 12px;
          margin-top: 12px;
        }

        .item-chip {
          background: linear-gradient(135deg, rgba(202, 229, 227, 0.4), rgba(234, 249, 149, 0.4));
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 13px;
          color: #264d44;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .sample-box {
          background: rgba(255, 255, 255, 0.5);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
          border-left: 4px solid #eaf995;
        }

        .sample-box h4 {
          color: #264d44;
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 12px;
        }

        .sample-box ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .sample-box li {
          padding: 4px 0;
          color: #555;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sample-box li:before {
          content: "•";
          color: #264d44;
          font-weight: bold;
          font-size: 16px;
        }
      `}</style>

      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-3" style={{ color: '#013f7c' }}>
          Wellness Box Incentives
        </h2>
        <p className="text-lg mb-4" style={{ color: '#666' }}>
          Add wellness boxes to boost engagement and show appreciation for participation.
        </p>
        <p className="text-sm" style={{ color: '#666' }}>
          Each box can be customized with items from our wellness catalog and includes 2 custom printed wellness fliers.
        </p>
      </div>

      {/* Available Items */}
      <div className="expandable-section">
        <div className="expandable-header" onClick={() => setShowItems(!showItems)}>
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5" style={{ color: '#264d44' }} />
            <h3 className="text-lg font-bold" style={{ color: '#264d44' }}>
              Available Wellness Items ({wellnessItems.length})
            </h3>
          </div>
          {showItems ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
        
        {showItems && (
          <div className="items-grid">
            {wellnessItems.map((item, index) => (
              <div key={index} className="item-chip">
                <span className="text-xs">✓</span>
                {item}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 mb-8">
        {/* Small Boxes */}
        <div className="box-card">
          <h3 className="text-xl font-bold mb-2" style={{ color: '#013f7c' }}>
            Small Wellness Boxes
          </h3>
          <p className="text-sm mb-4" style={{ color: '#666' }}>
            Perfect for workshop participants and challenge completers
          </p>
          <div className="text-2xl font-bold mb-4" style={{ color: '#441d37' }}>
            $65 each
          </div>

          {/* Sample Boxes */}
          <div className="expandable-header mb-2" onClick={() => setShowSmallSamples(!showSmallSamples)}>
            <span className="text-sm font-semibold" style={{ color: '#264d44' }}>View Sample Boxes</span>
            {showSmallSamples ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>

          {showSmallSamples && (
            <div className="mb-4">
              {smallBoxSamples.map((sample, idx) => (
                <div key={idx} className="sample-box">
                  <h4>{sample.name}</h4>
                  <ul>
                    {sample.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div className="neuro-stepper">
            <button 
              className="neuro-stepper-btn"
              onClick={() => updateStepper('smallBoxes', false)}
            >
              −
            </button>
            <span className="flex-1 text-center text-xl font-bold" style={{ color: '#333' }}>
              {selections.smallBoxes}
            </span>
            <button 
              className="neuro-stepper-btn"
              onClick={() => updateStepper('smallBoxes', true)}
            >
              +
            </button>
          </div>
        </div>

        {/* Large Boxes */}
        <div className="box-card">
          <h3 className="text-xl font-bold mb-2" style={{ color: '#013f7c' }}>
            Large Wellness Boxes
          </h3>
          <p className="text-sm mb-4" style={{ color: '#666' }}>
            Premium boxes for leadership teams and top performers
          </p>
          <div className="text-2xl font-bold mb-4" style={{ color: '#441d37' }}>
            $125 each
          </div>

          {/* Sample Boxes */}
          <div className="expandable-header mb-2" onClick={() => setShowLargeSamples(!showLargeSamples)}>
            <span className="text-sm font-semibold" style={{ color: '#264d44' }}>View Sample Boxes</span>
            {showLargeSamples ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>

          {showLargeSamples && (
            <div className="mb-4">
              {largeBoxSamples.map((sample, idx) => (
                <div key={idx} className="sample-box">
                  <h4>{sample.name}</h4>
                  <ul>
                    {sample.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div className="neuro-stepper">
            <button 
              className="neuro-stepper-btn"
              onClick={() => updateStepper('largeBoxes', false)}
            >
              −
            </button>
            <span className="flex-1 text-center text-xl font-bold" style={{ color: '#333' }}>
              {selections.largeBoxes}
            </span>
            <button 
              className="neuro-stepper-btn"
              onClick={() => updateStepper('largeBoxes', true)}
            >
              +
            </button>
          </div>
        </div>
      </div>

      <StepNavigation
        onNext={onNext}
        onBack={onBack}
        nextLabel="Continue to Movement Classes"
      />
    </div>
  );
}