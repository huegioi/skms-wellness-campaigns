import React, { useState } from 'react';
import StepNavigation from './StepNavigation';
import WellnessBoxBuilder from './WellnessBoxBuilder';
import { Gift, Sparkles } from 'lucide-react';

export default function WellnessBoxStep({ selections, updateSelections, onNext, onBack }) {
  const updateStepper = (type, increment) => {
    const currentValue = selections[type];
    const newValue = increment ? currentValue + 1 : Math.max(0, currentValue - 1);
    updateSelections(type, newValue);
  };

  const wellnessItems = [
    { id: '1', name: "Tumbler Shot Glass with Metal Straw and Lid", price: 9.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/b55e1d9df_3ozTumblerShotGlasswithMetalStrawandLid.png" },
    { id: '2', name: "Canvas Gym Bag", price: 20.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/c096f72ca_CanvasGymBag.png" },
    { id: '3', name: "Skelcore Dual Wheel Massage Roller", price: 9.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/9eb0bd57f_SkelcoreDualWheelMassageRoller.png" },
    { id: '4', name: "Fitbit Inspire Activity Tracker", price: 40.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/4ae0637c1_FitbitInspireActivityTracker.png" },
    { id: '5', name: "Bright Eyes Collagen Eye Mask", price: 6.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/33181040b_BrightEyesCollagenEyeMask.png" },
    { id: '6', name: "Sweet Dream Drops: Lavender & Magnesium Bath Bombs", price: 4.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/9d9bf38fb_SweetDreamDrops_LavenderMagnesiumBathBombs.png" },
    { id: '7', name: "Custom Printed Cotton Tote Bags", price: 7.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/88710e02f_CustomPrintedCottonBagsBulkToteBagsPersonalized.png" },
    { id: '8', name: "Custom Printed Clear Glass Coffee Mug", price: 15.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/9e1e19041_CustomPrintedClearGlassCoffeeMugForBusiness-YourLogo.png" },
    { id: '9', name: "Custom Black Lip Ceramic Camper Mug", price: 20.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/9dd325f07_YourLogoorArtCustom-BlackLipCeramicCamper13ozMug.png" },
    { id: '10', name: "Private Label Floral Bath Salt Soak", price: 5.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/f5ad4a846_PrivateLabelFloralBathSaltSoakinTestTubes.png" },
    { id: '11', name: "Custom Logo Journal", price: 22.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/8a7bf4761_CustomLogoJournal-BusinessBrandingNotebook.png" },
    { id: '12', name: "Custom Logo Candles", price: 20.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/00d4c4b1b_CustomLogocandle.png" },
    { id: '13', name: "Engraved Wood Bottle Opener", price: 5.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/53d0049be_EngravedWoodBottleOpener.png" },
    { id: '14', name: "Skelcore Deep Tissue Massage Ball", price: 7.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/0996c4ec1_SkelcoreDeepTissueMassageBall.png" },
    { id: '15', name: "Lavender Aromatherapy Candle", price: 10.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/a022c39d9_LavenderAromatherapyCandle.png" },
    { id: '16', name: "Wood Wick Candle - Multiple Scents", price: 10.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/681d71894_WoodWickCandle4oz-MultipleScents.png" },
    { id: '17', name: "Skinny Tumbler - 18oz", price: 10.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/f17efc8d4_SkinnyTumbler-18oz.png" },
    { id: '18', name: "Herbal Bath Salts - Personalizable", price: 5.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/d696c945f_HerbalBathSalts-Personalizable.png" },
    { id: '19', name: "Body Restore Shower Steamer/Bath Bomb", price: 3.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/d17e631a2_BodyRestoreShowerSteamer_BathBomb.png" },
    { id: '20', name: "Mini Foot Massage Roller", price: 8.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/da274b211_MiniFootMassageRollerOurTravelSizeFootMassager.png" },
    { id: '21', name: "Spa Body Brush", price: 7.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/061e3a525_SpaBodyBrush.png" },
    { id: '22', name: "Heywell Calm + Hydrate Sparkling Lime", price: 7.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/f85466826_HeywellCalmHydrateSparklingLime.png" },
    { id: '23', name: "Mindfulness Cards", price: 15.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/582be99d3_MindfulnessCards.png" },
    { id: '24', name: "Essential Oil Roller", price: 15.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/916a98720_EssentialOilRoller.png" },
    { id: '25', name: "Sleep Gummies", price: 6.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/8d0c5d7c4_SleepGummies.png" },
    { id: '26', name: "Calming Tea Herbal Blend", price: 7.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/e5cc21c9f_CalmingTeaHerbalBlend.png" },
    { id: '27', name: "Eucalyptus Shower Steamers", price: 4.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/108912f16_EucalyptusShowerSteamers.png" },
    { id: '28', name: "Squishing Dumpling Stress Ball", price: 5.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/3ef20e96d_SquishingDumplingStressBall.png" },
    { id: '29', name: "2 in 1 Stretch Belt & Yoga Slings", price: 7.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/4d7d9efe8_2in1StretchBeltSlingsinGrey.png" },
    { id: '30', name: "Stretchy Workout Band", price: 4.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/f9bcda348_StretchyWorkoutBand.png" },
    { id: '31', name: "Calm Aromatherapy Inhaler Patches", price: 6.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/f133641a7_CalmAromatherapyInhalerPatches.png" },
    { id: '32', name: "Relaxation & Self Care Gift Set", price: 30.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/a2d407d2b_RelaxationSelfCareGiftSet.png" },
    { id: '33', name: "Muscle Relief Bath Soak Pouch", price: 9.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/57952847c_MuscleReliefBathSoakPouch-EpsomSaltEucalyptusOil.png" },
    { id: '34', name: "Facial & Body Massage Tool Set", price: 10.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/f3667e680_FacialBodyMassageToolSet100NaturalQuartz.png" },
    { id: '35', name: "Yogasleep Sound Machine", price: 40.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/0bf578406_YogasleepSoundMachine.png" },
    { id: '36', name: "Weighted Aromatherapy Eye Pillow", price: 20.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/9483b8c12_WeightedAromatherapyEyePillow.png" },
    { id: '37', name: "Dreamy Dark Chocolate Hot Cocoa", price: 3.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/57730873a_Dreamy_DarkChocolateHotCocoa.png" },
    { id: '38', name: "Merry Mint Holiday Candle", price: 12.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/206d14e8c_MerryMintHolidayCandle.png" },
    { id: '39', name: "Holiday Warming Tea Blend", price: 7.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/a905fc033_HolidayWarmingTeaBlend.png" },
    { id: '40', name: "Sinus Relief Roll-On", price: 15.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/377fd46e8_SinusReliefRoll-On.png" },
    { id: '41', name: "Breathe Congestion Aromatherapy Patches", price: 4.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/4cfe0eb01_BreatheCongestionHelpingAromatherapyInhalerPatches.png" },
    { id: '42', name: "Pumpkin + Spices Soy Candle", price: 10.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/33aa8b604_PumpkinSpices-MiniAmberJarSoyCandle.png" },
    { id: '43', name: "Lavender Vanilla Tin Soy Candle", price: 14.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/bb91aa1aa_LavenderVanilla_TinSoyCandle.png" },
    { id: '44', name: "Sensory Sleep Escape Eye Mask", price: 6.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/54191fb53_SensorySleepEscapeSelf-HeatingEyeMaskJasmineScent.png" },
    { id: '45', name: "Sleeping Eye Mask - Soft Breathable", price: 13.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/b07dfb077_SleepingEyeMaskSoftBreathableEye.png" },
    { id: '46', name: "Gold Under Eye Patches", price: 3.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/3ef042c0e_GoldUnderEyePatches-CollagenEyeMask.png" },
    { id: '47', name: "Cooling Gel Eye Mask", price: 10.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/4585fcb94_CoolingGelEyeMask.png" },
    { id: '48', name: "Mindfulness Lavender Eye Pillows", price: 12.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/933cd01d1_MindfulnessLavenderRelaxationEyePillows.png" },
    { id: '49', name: "Trigger Point Single Massage Ball", price: 7.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/1d53676a9_TriggerPointSingleMassageBall.png" },
    { id: '50', name: "Cork Massage Balls", price: 6.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/538527da8_CorkMassageBalls.png" }
  ];

  const smallBoxSamples = [
    {
      name: "Reduce Stress Box",
      items: ["Heywell Calm + Hydrate", "Calm Aromatherapy Patches", "Squishy Dumpling Stress Ball", "Sleep Gummies", "Lavender Candle"],
      cost: 33.00
    },
    {
      name: "Relaxation & Sleep Box",
      items: ["Weighted Eye Pillow", "Herbal Bath Soak", "Calming Tea", "Eucalyptus Shower Steamers", "Sleep Gummies"],
      cost: 42.00
    }
  ];

  const largeBoxSamples = [
    {
      name: "Large Emotional Wellness Box",
      items: ["Mindfulness Cards", "Essential Oil Roller", "Herbal Bath Soak", "Calming Tea", "Dreamy Dark Chocolate", "Spa Body Brush", "Gold Eye Patches"],
      cost: 59.00
    },
    {
      name: "Large Stress Reduction Box",
      items: ["Calm Patches", "Calming Tea", "Stress Ball", "Essential Oil Roller", "Mindfulness Cards", "Herbal Bath Soak", "Hot Cocoa", "Heywell Drink", "Cork Massage Balls"],
      cost: 73.00
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

        .sample-boxes-section {
          background: linear-gradient(135deg, rgba(234, 249, 149, 0.2), rgba(202, 229, 227, 0.2));
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 32px;
          border: 2px solid #eaf995;
        }

        .sample-box {
          background: white;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
          box-shadow: 4px 4px 8px rgba(0, 0, 0, 0.08);
        }

        .sample-box h4 {
          color: #264d44;
          font-size: 15px;
          font-weight: 700;
          margin-bottom: 10px;
        }

        @media (min-width: 768px) {
          .sample-box h4 {
            font-size: 16px;
            margin-bottom: 12px;
          }
        }

        .sample-box ul {
          list-style: none;
          padding: 0;
          margin: 0 0 12px 0;
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

        .cost-badge {
          background: #eaf995;
          color: #264d44;
          padding: 6px 12px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 14px;
          display: inline-block;
        }
      `}</style>

      <div className="mb-6 md:mb-8">
        <h2 className="text-2xl md:text-3xl font-bold mb-2 md:mb-3" style={{ color: '#013f7c' }}>
          Wellness Box Incentives
        </h2>
        <p className="text-base md:text-lg mb-3 md:mb-4" style={{ color: '#666' }}>
          Boost engagement with customized wellness boxes for your team
        </p>
      </div>

      {/* Custom Box Builder */}
      <WellnessBoxBuilder wellnessItems={wellnessItems} />

      {/* Suggested Sample Boxes Section */}
      <div className="sample-boxes-section">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-6 h-6" style={{ color: '#264d44' }} />
          <h3 className="text-xl md:text-2xl font-bold" style={{ color: '#264d44' }}>
            Pre-Designed Sample Boxes
          </h3>
        </div>
        <p className="text-sm mb-6" style={{ color: '#666' }}>
          Choose from our curated wellness box collections or use them as inspiration for your custom boxes
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <h4 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: '#770142' }}>
              <Gift className="w-5 h-5" />
              Small Box Samples ($65 each)
            </h4>
            {smallBoxSamples.map((sample, idx) => (
              <div key={idx} className="sample-box">
                <h4>{sample.name}</h4>
                <ul>
                  {sample.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
                <span className="cost-badge">Estimated: ${sample.cost.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div>
            <h4 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: '#770142' }}>
              <Gift className="w-5 h-5" />
              Large Box Samples ($125 each)
            </h4>
            {largeBoxSamples.map((sample, idx) => (
              <div key={idx} className="sample-box">
                <h4>{sample.name}</h4>
                <ul>
                  {sample.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
                <span className="cost-badge">Estimated: ${sample.cost.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stepper Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
        <div className="box-card">
          <h3 className="text-lg md:text-xl font-bold mb-2" style={{ color: '#013f7c' }}>
            Small Wellness Boxes
          </h3>
          <p className="text-sm mb-3 md:mb-4" style={{ color: '#666' }}>
            Perfect for workshop participants
          </p>
          <div className="text-xl md:text-2xl font-bold mb-3 md:mb-4" style={{ color: '#441d37' }}>
            $65 each
          </div>

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

        <div className="box-card">
          <h3 className="text-lg md:text-xl font-bold mb-2" style={{ color: '#013f7c' }}>
            Large Wellness Boxes
          </h3>
          <p className="text-sm mb-3 md:mb-4" style={{ color: '#666' }}>
            Premium boxes for leadership teams
          </p>
          <div className="text-xl md:text-2xl font-bold mb-3 md:mb-4" style={{ color: '#441d37' }}>
            $125 each
          </div>

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

      <StepNavigation
        onNext={onNext}
        onBack={onBack}
        nextLabel="Continue to Movement Classes"
      />
    </div>
  );
}