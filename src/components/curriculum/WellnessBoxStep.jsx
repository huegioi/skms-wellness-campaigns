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
    { name: "Tumbler Shot Glass with Metal Straw and Lid", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/b55e1d9df_3ozTumblerShotGlasswithMetalStrawandLid.png" },
    { name: "Canvas Gym Bag", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/c096f72ca_CanvasGymBag.png" },
    { name: "Skelcore Dual Wheel Massage Roller", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/9eb0bd57f_SkelcoreDualWheelMassageRoller.png" },
    { name: "Fitbit Inspire Activity Tracker", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/4ae0637c1_FitbitInspireActivityTracker.png" },
    { name: "Bright Eyes Collagen Eye Mask", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/33181040b_BrightEyesCollagenEyeMask.png" },
    { name: "Sweet Dream Drops: Lavender & Magnesium Bath Bombs", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/9d9bf38fb_SweetDreamDrops_LavenderMagnesiumBathBombs.png" },
    { name: "Custom Printed Cotton Tote Bags", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/88710e02f_CustomPrintedCottonBagsBulkToteBagsPersonalized.png" },
    { name: "Custom Printed Clear Glass Coffee Mug", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/9e1e19041_CustomPrintedClearGlassCoffeeMugForBusiness-YourLogo.png" },
    { name: "Custom Black Lip Ceramic Camper Mug", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/9dd325f07_YourLogoorArtCustom-BlackLipCeramicCamper13ozMug.png" },
    { name: "Private Label Floral Bath Salt Soak in Test Tubes", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/f5ad4a846_PrivateLabelFloralBathSaltSoakinTestTubes.png" },
    { name: "Custom Logo Journal - Business Branding Notebook", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/8a7bf4761_CustomLogoJournal-BusinessBrandingNotebook.png" },
    { name: "Custom Logo Candles", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/00d4c4b1b_CustomLogocandle.png" },
    { name: "Engraved Wood Bottle Opener", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/53d0049be_EngravedWoodBottleOpener.png" },
    { name: "Skelcore Deep Tissue Massage Ball", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/0996c4ec1_SkelcoreDeepTissueMassageBall.png" },
    { name: "Lavender Aromatherapy Candle", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/a022c39d9_LavenderAromatherapyCandle.png" },
    { name: "Wood Wick Candle - Multiple Scents", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/681d71894_WoodWickCandle4oz-MultipleScents.png" },
    { name: "Skinny Tumbler", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/f17efc8d4_SkinnyTumbler-18oz.png" },
    { name: "Herbal Bath Salts - Personalizable", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/d696c945f_HerbalBathSalts-Personalizable.png" },
    { name: "Body Restore Shower Steamer/Bath Bomb", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/d17e631a2_BodyRestoreShowerSteamer_BathBomb.png" },
    { name: "Mini Foot Massage Roller", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/da274b211_MiniFootMassageRollerOurTravelSizeFootMassager.png" },
    { name: "Spa Body Brush", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/061e3a525_SpaBodyBrush.png" },
    { name: "Heywell Calm + Hydrate Sparkling Lime", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/f85466826_HeywellCalmHydrateSparklingLime.png" },
    { name: "Mindfulness Cards", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/582be99d3_MindfulnessCards.png" },
    { name: "Essential Oil Roller", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/916a98720_EssentialOilRoller.png" },
    { name: "Sleep Gummies", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/8d0c5d7c4_SleepGummies.png" },
    { name: "Calming Tea Herbal Blend", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/e5cc21c9f_CalmingTeaHerbalBlend.png" },
    { name: "Eucalyptus Shower Steamers", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/108912f16_EucalyptusShowerSteamers.png" },
    { name: "Squishing Dumpling Stress Ball", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/3ef20e96d_SquishingDumplingStressBall.png" },
    { name: "2 in 1 Stretch Belt & Yoga Slings", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/4d7d9efe8_2in1StretchBeltSlingsinGrey.png" },
    { name: "Stretchy Workout Band", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/f9bcda348_StretchyWorkoutBand.png" },
    { name: "Calm Aromatherapy Inhaler Patches", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/f133641a7_CalmAromatherapyInhalerPatches.png" },
    { name: "Relaxation & Self Care Gift Set", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/a2d407d2b_RelaxationSelfCareGiftSet.png" },
    { name: "Muscle Relief Bath Soak Pouch", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/57952847c_MuscleReliefBathSoakPouch-EpsomSaltEucalyptusOil.png" },
    { name: "Facial & Body Massage Tool Set", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/f3667e680_FacialBodyMassageToolSet100NaturalQuartz.png" },
    { name: "Yogasleep Sound Machine", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/0bf578406_YogasleepSoundMachine.png" },
    { name: "Weighted Aromatherapy Eye Pillow", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/9483b8c12_WeightedAromatherapyEyePillow.png" },
    { name: "Dreamy Dark Chocolate Hot Cocoa", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/57730873a_Dreamy_DarkChocolateHotCocoa.png" },
    { name: "Merry Mint Holiday Candle", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/206d14e8c_MerryMintHolidayCandle.png" },
    { name: "Holiday Warming Tea Blend", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/a905fc033_HolidayWarmingTeaBlend.png" },
    { name: "Sinus Relief Roll-On", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/377fd46e8_SinusReliefRoll-On.png" },
    { name: "Breathe Congestion Aromatherapy Patches", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/4cfe0eb01_BreatheCongestionHelpingAromatherapyInhalerPatches.png" },
    { name: "Pumpkin + Spices Soy Candle", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/33aa8b604_PumpkinSpices-MiniAmberJarSoyCandle.png" },
    { name: "Lavender Vanilla Tin Soy Candle", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/bb91aa1aa_LavenderVanilla_TinSoyCandle.png" },
    { name: "Sensory Sleep Escape Eye Mask", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/54191fb53_SensorySleepEscapeSelf-HeatingEyeMaskJasmineScent.png" },
    { name: "Sleeping Eye Mask - Soft Breathable", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/b07dfb077_SleepingEyeMaskSoftBreathableEye.png" },
    { name: "Gold Under Eye Patches", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/3ef042c0e_GoldUnderEyePatches-CollagenEyeMask.png" },
    { name: "Cooling Gel Eye Mask", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/4585fcb94_CoolingGelEyeMask.png" },
    { name: "Mindfulness Lavender Eye Pillows", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/933cd01d1_MindfulnessLavenderRelaxationEyePillows.png" },
    { name: "Trigger Point Single Massage Ball", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/1d53676a9_TriggerPointSingleMassageBall.png" },
    { name: "Cork Massage Balls", image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/538527da8_CorkMassageBalls.png" },
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
          padding: 20px;
          box-shadow: 
            8px 8px 16px rgba(0, 0, 0, 0.12),
            -8px -8px 16px rgba(255, 255, 255, 0.9);
          margin-bottom: 20px;
        }

        @media (min-width: 768px) {
          .box-card {
            padding: 24px;
          }
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
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 12px;
          margin-top: 16px;
        }

        @media (min-width: 768px) {
          .items-grid {
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 16px;
          }
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
          height: 100px;
          object-fit: cover;
        }

        @media (min-width: 768px) {
          .item-card img {
            height: 120px;
          }
        }

        .item-card-content {
          padding: 10px;
        }

        @media (min-width: 768px) {
          .item-card-content {
            padding: 12px;
          }
        }

        .item-card-title {
          font-size: 11px;
          font-weight: 600;
          color: #264d44;
          line-height: 1.3;
          min-height: 32px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        @media (min-width: 768px) {
          .item-card-title {
            font-size: 12px;
          }
        }

        .sample-box {
          background: rgba(255, 255, 255, 0.5);
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 12px;
          border-left: 4px solid #eaf995;
        }

        @media (min-width: 768px) {
          .sample-box {
            padding: 16px;
          }
        }

        .sample-box h4 {
          color: #264d44;
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 10px;
        }

        @media (min-width: 768px) {
          .sample-box h4 {
            font-size: 15px;
            margin-bottom: 12px;
          }
        }

        .sample-box ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .sample-box li {
          padding: 4px 0;
          color: #555;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        @media (min-width: 768px) {
          .sample-box li {
            font-size: 13px;
          }
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
          padding: 10px 16px;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 700;
          font-size: 13px;
          color: #264d44;
          cursor: pointer;
          box-shadow: 
            4px 4px 8px rgba(0, 0, 0, 0.1),
            -4px -4px 8px rgba(255, 255, 255, 0.9);
          transition: all 0.2s ease;
          margin-bottom: 16px;
        }

        @media (min-width: 768px) {
          .view-samples-btn {
            padding: 12px 20px;
            font-size: 14px;
          }
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

      <div className="mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-bold mb-2 md:mb-3" style={{ color: '#013f7c' }}>
          Wellness Box Incentives
        </h2>
        <p className="text-base md:text-lg mb-3 md:mb-4" style={{ color: '#666' }}>
          Add wellness boxes to boost engagement and show appreciation for participation.
        </p>
        <p className="text-sm" style={{ color: '#666' }}>
          Each box can be customized with items from our wellness catalog and includes 2 custom printed wellness fliers.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
        {/* Small Boxes */}
        <div className="box-card">
          <h3 className="text-lg md:text-xl font-bold mb-2" style={{ color: '#013f7c' }}>
            Small Wellness Boxes
          </h3>
          <p className="text-sm mb-3 md:mb-4" style={{ color: '#666' }}>
            Perfect for workshop participants and challenge completers
          </p>
          <div className="text-xl md:text-2xl font-bold mb-3 md:mb-4" style={{ color: '#441d37' }}>
            $65 each
          </div>

          <button 
            className="view-samples-btn"
            onClick={() => setShowSmallSamples(!showSmallSamples)}
          >
            <Gift className="w-4 h-4 md:w-5 md:h-5" />
            {showSmallSamples ? 'Hide Sample Boxes' : 'View Sample Boxes'}
            {showSmallSamples ? <ChevronUp className="w-4 h-4 md:w-5 md:h-5 ml-auto" /> : <ChevronDown className="w-4 h-4 md:w-5 md:h-5 ml-auto" />}
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
            <span className="flex-1 text-center text-lg md:text-xl font-bold" style={{ color: '#333' }}>
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
          <h3 className="text-lg md:text-xl font-bold mb-2" style={{ color: '#013f7c' }}>
            Large Wellness Boxes
          </h3>
          <p className="text-sm mb-3 md:mb-4" style={{ color: '#666' }}>
            Premium boxes for leadership teams and top performers
          </p>
          <div className="text-xl md:text-2xl font-bold mb-3 md:mb-4" style={{ color: '#441d37' }}>
            $125 each
          </div>

          <button 
            className="view-samples-btn"
            onClick={() => setShowLargeSamples(!showLargeSamples)}
          >
            <Gift className="w-4 h-4 md:w-5 md:h-5" />
            {showLargeSamples ? 'Hide Sample Boxes' : 'View Sample Boxes'}
            {showLargeSamples ? <ChevronUp className="w-4 h-4 md:w-5 md:h-5 ml-auto" /> : <ChevronDown className="w-4 h-4 md:w-5 md:h-5 ml-auto" />}
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
            <span className="flex-1 text-center text-lg md:text-xl font-bold" style={{ color: '#333' }}>
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
            <Package className="w-4 h-4 md:w-5 md:h-5" style={{ color: '#264d44' }} />
            <h3 className="text-base md:text-lg font-bold" style={{ color: '#264d44' }}>
              Available Wellness Items ({wellnessItems.length})
            </h3>
          </div>
          {showItems ? <ChevronUp className="w-4 h-4 md:w-5 md:h-5" /> : <ChevronDown className="w-4 h-4 md:w-5 md:h-5" />}
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