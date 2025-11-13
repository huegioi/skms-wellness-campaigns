import React, { useState } from 'react';
import StepNavigation from './StepNavigation';
import { ChevronDown, ChevronUp, Package, Sparkles, Gift } from 'lucide-react';

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
    { name: "Tumbler Shot Glass with Metal Straw and Lid", image: "https://images.unsplash.com/photo-1534056982245-6e323ab4c1cd?w=400" },
    { name: "Canvas Gym Bag", image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400" },
    { name: "Skelcore Dual Wheel Massage Roller", image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400" },
    { name: "Fitbit Inspire Activity Tracker", image: "https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=400" },
    { name: "Bright Eyes Collagen Eye Mask", image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=400" },
    { name: "Sweet Dream Drops: Lavender & Magnesium Bath Bombs", image: "https://images.unsplash.com/photo-1608181692339-1b9f0b51b4d0?w=400" },
    { name: "Custom Printed Cotton Tote Bags", image: "https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=400" },
    { name: "Custom Printed Clear Glass Coffee Mug", image: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400" },
    { name: "Custom Black Lip Ceramic Camper Mug", image: "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=400" },
    { name: "Private Label Floral Bath Salt Soak in Test Tubes", image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400" },
    { name: "Custom Logo Journal - Business Branding Notebook", image: "https://images.unsplash.com/photo-1517842645767-c639042777db?w=400" },
    { name: "Custom Logo Candles", image: "https://images.unsplash.com/photo-1602874801006-94c0f0c1f1cc?w=400" },
    { name: "Engraved Wood Bottle Opener", image: "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400" },
    { name: "Skelcore Deep Tissue Massage Ball", image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400" },
    { name: "Lavender Aromatherapy Candle", image: "https://images.unsplash.com/photo-1602874801006-94c0f0c1f1cc?w=400" },
    { name: "Wood Wick Candle - Multiple Scents", image: "https://images.unsplash.com/photo-1587486937504-2bbd5e1067a9?w=400" },
    { name: "Skinny Tumbler", image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400" },
    { name: "Herbal Bath Salts - Personalizable", image: "https://images.unsplash.com/photo-1608181692339-1b9f0b51b4d0?w=400" },
    { name: "Body Restore Shower Steamer/Bath Bomb", image: "https://images.unsplash.com/photo-1608181692339-1b9f0b51b4d0?w=400" },
    { name: "Mini Foot Massage Roller", image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400" },
    { name: "Spa Body Brush", image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400" },
    { name: "Heywell Calm + Hydrate Sparkling Lime", image: "https://images.unsplash.com/photo-1625772452859-1c03d5bf1137?w=400" },
    { name: "Mindfulness Cards", image: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?w=400" },
    { name: "Essential Oil Roller", image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400" },
    { name: "Sleep Gummies", image: "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=400" },
    { name: "Calming Tea Herbal Blend", image: "https://images.unsplash.com/photo-1597318112993-f8f6ab19d50b?w=400" },
    { name: "Eucalyptus Shower Steamers", image: "https://images.unsplash.com/photo-1608181692339-1b9f0b51b4d0?w=400" },
    { name: "Squishing Dumpling Stress Ball", image: "https://images.unsplash.com/photo-1611532736579-6b16e2b50449?w=400" },
    { name: "2 in 1 Stretch Belt & Yoga Slings", image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400" },
    { name: "Stretchy Workout Band", image: "https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=400" },
    { name: "Calm Aromatherapy Inhaler Patches", image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400" },
    { name: "Relaxation & Self Care Gift Set", image: "https://images.unsplash.com/photo-1549480017-d76466a2a8f6?w=400" },
    { name: "Muscle Relief Bath Soak Pouch", image: "https://images.unsplash.com/photo-1608181692339-1b9f0b51b4d0?w=400" },
    { name: "Facial & Body Massage Tool Set", image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=400" },
    { name: "Yogasleep Sound Machine", image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400" },
    { name: "Weighted Aromatherapy Eye Pillow", image: "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=400" },
    { name: "Dreamy Dark Chocolate Hot Cocoa", image: "https://images.unsplash.com/photo-1542990253-a781e04c0082?w=400" },
    { name: "Merry Mint Holiday Candle", image: "https://images.unsplash.com/photo-1602874801006-94c0f0c1f1cc?w=400" },
    { name: "Holiday Warming Tea Blend", image: "https://images.unsplash.com/photo-1597318112993-f8f6ab19d50b?w=400" },
    { name: "Sinus Relief Roll-On", image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400" },
    { name: "Breathe Congestion Aromatherapy Patches", image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400" },
    { name: "Pumpkin + Spices Soy Candle", image: "https://images.unsplash.com/photo-1602874801006-94c0f0c1f1cc?w=400" },
    { name: "Lavender Vanilla Tin Soy Candle", image: "https://images.unsplash.com/photo-1602874801006-94c0f0c1f1cc?w=400" },
    { name: "Sensory Sleep Escape Eye Mask", image: "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=400" },
    { name: "Sleeping Eye Mask - Soft Breathable", image: "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=400" },
    { name: "Gold Under Eye Patches", image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=400" },
    { name: "Cooling Gel Eye Mask", image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=400" },
    { name: "Mindfulness Lavender Eye Pillows", image: "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=400" },
    { name: "Trigger Point Single Massage Ball", image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400" },
    { name: "Cork Massage Balls", image: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400" },
    { name: "Calm Absorbent Vitamin Patch", image: "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=400" },
    { name: "Meditation Cushion", image: "https://images.unsplash.com/photo-1545389336-cf090694435e?w=400" }
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
          margin-top: 24px;
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
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
          margin-top: 16px;
        }

        .item-card {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 
            4px 4px 8px rgba(0, 0, 0, 0.08),
            -4px -4px 8px rgba(255, 255, 255, 0.9);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .item-card:hover {
          transform: translateY(-2px);
          box-shadow: 
            6px 6px 12px rgba(0, 0, 0, 0.12),
            -6px -6px 12px rgba(255, 255, 255, 0.95);
        }

        .item-card img {
          width: 100%;
          height: 120px;
          object-fit: cover;
        }

        .item-card-content {
          padding: 12px;
        }

        .item-card-title {
          font-size: 12px;
          font-weight: 600;
          color: #264d44;
          line-height: 1.3;
          min-height: 32px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .sample-box {
          background: rgba(255, 255, 255, 0.5);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
          border-left: 4px solid #eaf995;
        }

        .sample-box h4 {
          color: #264d44;
          font-size: 15px;
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

        .view-samples-btn {
          background: linear-gradient(135deg, #eaf995, #cae5e3);
          border: none;
          border-radius: 12px;
          padding: 12px 20px;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 700;
          font-size: 14px;
          color: #264d44;
          cursor: pointer;
          box-shadow: 
            4px 4px 8px rgba(0, 0, 0, 0.1),
            -4px -4px 8px rgba(255, 255, 255, 0.9);
          transition: all 0.2s ease;
          margin-bottom: 16px;
        }

        .view-samples-btn:hover {
          box-shadow: 
            6px 6px 12px rgba(0, 0, 0, 0.15),
            -6px -6px 12px rgba(255, 255, 255, 0.95);
          transform: translateY(-1px);
        }

        .view-samples-btn:active {
          box-shadow: 
            inset 3px 3px 6px rgba(0, 0, 0, 0.15),
            inset -3px -3px 6px rgba(255, 255, 255, 0.5);
          transform: translateY(0);
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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

          {/* Prominent View Sample Boxes Button */}
          <button 
            className="view-samples-btn"
            onClick={() => setShowSmallSamples(!showSmallSamples)}
          >
            <Gift className="w-5 h-5" />
            {showSmallSamples ? 'Hide Sample Boxes' : 'View Sample Boxes'}
            {showSmallSamples ? <ChevronUp className="w-5 h-5 ml-auto" /> : <ChevronDown className="w-5 h-5 ml-auto" />}
          </button>

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

          {/* Prominent View Sample Boxes Button */}
          <button 
            className="view-samples-btn"
            onClick={() => setShowLargeSamples(!showLargeSamples)}
          >
            <Gift className="w-5 h-5" />
            {showLargeSamples ? 'Hide Sample Boxes' : 'View Sample Boxes'}
            {showLargeSamples ? <ChevronUp className="w-5 h-5 ml-auto" /> : <ChevronDown className="w-5 h-5 ml-auto" />}
          </button>

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

      {/* Available Items - Now Below */}
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
              <div key={index} className="item-card">
                <img src={item.image} alt={item.name} />
                <div className="item-card-content">
                  <div className="item-card-title">{item.name}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <StepNavigation
        onNext={onNext}
        onBack={onBack}
        nextLabel="Continue to Movement Classes"
      />
    </div>
  );
}