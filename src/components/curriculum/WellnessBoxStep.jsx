import React, { useState } from 'react';
import StepNavigation from './StepNavigation';
import WellnessBoxBuilder from './WellnessBoxBuilder';
import { Gift, Sparkles, DollarSign } from 'lucide-react';

export default function WellnessBoxStep({ selections, updateSelections, onNext, onBack }) {
  const [customBoxQuantity, setCustomBoxQuantity] = useState(selections.customBoxQuantity || 0);
  const [customBoxItems, setCustomBoxItems] = useState(selections.customBoxItems || []);
  const [sampleBoxQuantities, setSampleBoxQuantities] = useState(
    selections.sampleBoxQuantities || {
      reduceStress: 0,
      emotionalWellness: 0,
      relaxationSleep: 0,
      wintertimeHealthy: 0,
      newYearFreshStart: 0
    }
  );

  const handleCustomQuantityChange = (newQuantity) => {
    setCustomBoxQuantity(newQuantity);
    updateSelections('customBoxQuantity', newQuantity);
  };

  const handleCustomBoxChange = (items) => {
    setCustomBoxItems(items);
    updateSelections('customBoxItems', items);
  };

  const updateSampleBoxQuantity = (boxId, increment) => {
    const newQuantities = {
      ...sampleBoxQuantities,
      [boxId]: increment ? sampleBoxQuantities[boxId] + 1 : Math.max(0, sampleBoxQuantities[boxId] - 1)
    };
    setSampleBoxQuantities(newQuantities);
    updateSelections('sampleBoxQuantities', newQuantities);
  };

  const calculateWellnessBoxTotal = () => {
    let total = 0;
    total += (sampleBoxQuantities.reduceStress || 0) * 100;
    total += (sampleBoxQuantities.emotionalWellness || 0) * 100;
    total += (sampleBoxQuantities.relaxationSleep || 0) * 100;
    total += (sampleBoxQuantities.wintertimeHealthy || 0) * 100;
    total += (sampleBoxQuantities.newYearFreshStart || 0) * 100;
    // Add custom box total
    if (customBoxQuantity > 0 && customBoxItems.length > 0) {
      const customBoxTotal = customBoxItems.reduce((sum, item) => sum + item.price, 0);
      total += customBoxTotal * customBoxQuantity;
    }
    return total;
  };

  const wellnessItems = [
    { id: '1', name: "Tumbler Shot Glass with Metal Straw and Lid", price: 9.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/b55e1d9df_3ozTumblerShotGlasswithMetalStrawandLid.png" },
    { id: '2', name: "Canvas Gym Bag", price: 20.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/c096f72ca_CanvasGymBag.png" },
    { id: '3', name: "Skelcore Dual Wheel Massage Roller", price: 9.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/9eb0bd57f_SkelcoreDualWheelMassageRoller.png" },
    { id: '4', name: "Fitbit Inspire Activity Tracker", price: 40.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/4ae0637c1_FitbitInspireActivityTracker.png" },
    { id: '5', name: "Bright Eyes Collagen Eye Mask", price: 6.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/33181040b_BrightEyesCollagenEyeMask.png" },
    { id: '6', name: "Sweet Dream Drops Bath Bombs", price: 4.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/9d9bf38fb_SweetDreamDrops_LavenderMagnesiumBathBombs.png" },
    { id: '7', name: "Custom Printed Cotton Tote Bags", price: 7.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/88710e02f_CustomPrintedCottonBagsBulkToteBagsPersonalized.png" },
    { id: '8', name: "Custom Printed Clear Glass Coffee Mug", price: 15.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/9e1e19041_CustomPrintedClearGlassCoffeeMugForBusiness-YourLogo.png" },
    { id: '9', name: "Custom Black Lip Ceramic Camper Mug", price: 20.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/9dd325f07_YourLogoorArtCustom-BlackLipCeramicCamper13ozMug.png" },
    { id: '10', name: "Private Label Floral Bath Salt Soak", price: 5.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/f5ad4a846_PrivateLabelFloralBathSaltSoakinTestTubes.png" },
    { id: '11', name: "Custom Logo Journal", price: 22.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/8a7bf4761_CustomLogoJournal-BusinessBrandingNotebook.png" },
    { id: '12', name: "Custom Logo Candles", price: 20.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/00d4c4b1b_CustomLogocandle.png" },
    { id: '13', name: "Engraved Wood Bottle Opener", price: 5.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/53d0049be_EngravedWoodBottleOpener.png" },
    { id: '14', name: "Skelcore Deep Tissue Massage Ball", price: 7.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/0996c4ec1_SkelcoreDeepTissueMassageBall.png" },
    { id: '15', name: "Lavender Aromatherapy Candle", price: 10.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/a022c39d9_LavenderAromatherapyCandle.png" },
    { id: '16', name: "Wood Wick Candle", price: 10.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/681d71894_WoodWickCandle4oz-MultipleScents.png" },
    { id: '17', name: "Skinny Tumbler", price: 10.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/f17efc8d4_SkinnyTumbler-18oz.png" },
    { id: '18', name: "Herbal Bath Salts", price: 5.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/d696c945f_HerbalBathSalts-Personalizable.png" },
    { id: '19', name: "Shower Steamer/Bath Bomb", price: 3.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/d17e631a2_BodyRestoreShowerSteamer_BathBomb.png" },
    { id: '20', name: "Mini Foot Massage Roller", price: 8.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/da274b211_MiniFootMassageRollerOurTravelSizeFootMassager.png" },
    { id: '21', name: "Spa Body Brush", price: 7.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/061e3a525_SpaBodyBrush.png" },
    { id: '22', name: "Heywell Calm + Hydrate", price: 7.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/f85466826_HeywellCalmHydrateSparklingLime.png" },
    { id: '23', name: "Mindfulness Cards", price: 15.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/582be99d3_MindfulnessCards.png" },
    { id: '24', name: "Essential Oil Roller", price: 15.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/916a98720_EssentialOilRoller.png" },
    { id: '25', name: "Sleep Gummies", price: 6.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/8d0c5d7c4_SleepGummies.png" },
    { id: '26', name: "Calming Tea", price: 7.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/e5cc21c9f_CalmingTeaHerbalBlend.png" },
    { id: '27', name: "Eucalyptus Shower Steamers", price: 4.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/108912f16_EucalyptusShowerSteamers.png" },
    { id: '28', name: "Squishy Dumpling Stress Ball", price: 5.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/3ef20e96d_SquishingDumplingStressBall.png" },
    { id: '29', name: "Yoga Slings", price: 7.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/4d7d9efe8_2in1StretchBeltSlingsinGrey.png" },
    { id: '30', name: "Workout Band", price: 4.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/f9bcda348_StretchyWorkoutBand.png" },
    { id: '31', name: "Calm Aromatherapy Patches", price: 6.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/f133641a7_CalmAromatherapyInhalerPatches.png" },
    { id: '32', name: "Relaxation Gift Set", price: 30.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/a2d407d2b_RelaxationSelfCareGiftSet.png" },
    { id: '33', name: "Muscle Relief Bath Soak", price: 9.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/57952847c_MuscleReliefBathSoakPouch-EpsomSaltEucalyptusOil.png" },
    { id: '34', name: "Massage Tool Set", price: 10.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/f3667e680_FacialBodyMassageToolSet100NaturalQuartz.png" },
    { id: '35', name: "Yogasleep Sound Machine", price: 40.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/0bf578406_YogasleepSoundMachine.png" },
    { id: '36', name: "Weighted Eye Pillow", price: 20.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/9483b8c12_WeightedAromatherapyEyePillow.png" },
    { id: '37', name: "Dark Chocolate Hot Cocoa", price: 3.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/57730873a_Dreamy_DarkChocolateHotCocoa.png" },
    { id: '38', name: "Merry Mint Candle", price: 12.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/206d14e8c_MerryMintHolidayCandle.png" },
    { id: '39', name: "Holiday Tea Blend", price: 7.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/a905fc033_HolidayWarmingTeaBlend.png" },
    { id: '40', name: "Sinus Relief Roll-On", price: 15.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/377fd46e8_SinusReliefRoll-On.png" },
    { id: '41', name: "Breathe Aromatherapy Patches", price: 4.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/4cfe0eb01_BreatheCongestionHelpingAromatherapyInhalerPatches.png" },
    { id: '42', name: "Pumpkin Spices Candle", price: 10.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/33aa8b604_PumpkinSpices-MiniAmberJarSoyCandle.png" },
    { id: '43', name: "Lavender Vanilla Candle", price: 14.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/bb91aa1aa_LavenderVanilla_TinSoyCandle.png" },
    { id: '44', name: "Sleep Escape Eye Mask", price: 6.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/54191fb53_SensorySleepEscapeSelf-HeatingEyeMaskJasmineScent.png" },
    { id: '45', name: "Soft Breathable Eye Mask", price: 13.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/b07dfb077_SleepingEyeMaskSoftBreathableEye.png" },
    { id: '46', name: "Gold Eye Patches", price: 3.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/3ef042c0e_GoldUnderEyePatches-CollagenEyeMask.png" },
    { id: '47', name: "Cooling Gel Eye Mask", price: 10.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/4585fcb94_CoolingGelEyeMask.png" },
    { id: '48', name: "Lavender Eye Pillows", price: 12.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/933cd01d1_MindfulnessLavenderRelaxationEyePillows.png" },
    { id: '49', name: "Trigger Point Massage Ball", price: 7.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/1d53676a9_TriggerPointSingleMassageBall.png" },
    { id: '50', name: "Cork Massage Balls", price: 6.00, image: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/538527da8_CorkMassageBalls.png" }
  ];

  const sampleBoxImages = {
    reduceStress: [
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/f85466826_HeywellCalmHydrateSparklingLime.png",
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/108912f16_EucalyptusShowerSteamers.png",
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/57730873a_Dreamy_DarkChocolateHotCocoa.png",
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/3ef20e96d_SquishingDumplingStressBall.png",
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/f133641a7_CalmAromatherapyInhalerPatches.png"
    ],
    emotionalWellness: [
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/582be99d3_MindfulnessCards.png",
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/f133641a7_CalmAromatherapyInhalerPatches.png",
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/e5cc21c9f_CalmingTeaHerbalBlend.png",
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/57730873a_Dreamy_DarkChocolateHotCocoa.png",
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/933cd01d1_MindfulnessLavenderRelaxationEyePillows.png"
    ],
    relaxationSleep: [
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/0bf578406_YogasleepSoundMachine.png",
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/f133641a7_CalmAromatherapyInhalerPatches.png",
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/9483b8c12_WeightedAromatherapyEyePillow.png",
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/d696c945f_HerbalBathSalts-Personalizable.png",
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/8d0c5d7c4_SleepGummies.png"
    ],
    wintertimeHealthy: [
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/206d14e8c_MerryMintHolidayCandle.png",
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/e5cc21c9f_CalmingTeaHerbalBlend.png",
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/377fd46e8_SinusReliefRoll-On.png",
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/4cfe0eb01_BreatheCongestionHelpingAromatherapyInhalerPatches.png",
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/f133641a7_CalmAromatherapyInhalerPatches.png"
    ],
    newYearFreshStart: [
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/a022c39d9_LavenderAromatherapyCandle.png",
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/3ef042c0e_GoldUnderEyePatches-CollagenEyeMask.png",
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/f17efc8d4_SkinnyTumbler-18oz.png",
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/582be99d3_MindfulnessCards.png",
      "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/57730873a_Dreamy_DarkChocolateHotCocoa.png"
    ]
  };

  const sampleBoxes = [
    {
      id: 'reduceStress',
      name: "Reduce Stress Wellness Box",
      items: ["Heywell Calm + Hydrate Sparkling Lime", "Eucalyptus Shower Steamers", "Creamy Milk Chocolate Bar", "Squishy Dumpling Stress Ball", "Calm Absorbent Vitamin Patch (2 boxes)", "2 Custom Printed Fliers"],
      price: 100
    },
    {
      id: 'emotionalWellness',
      name: "Emotional Wellness Box",
      items: ["Mindfulness Cards", "Calm Aromatherapy (2-count)", "Calming Tea", "Dreamy Dark Chocolate Bar", "Meditation Cushion", "2 Custom Printed Fliers"],
      price: 100
    },
    {
      id: 'relaxationSleep',
      name: "Relaxation & Sleep Wellness Box",
      items: ["Yogasleep Travel Sound Machine", "Calm Aromatherapy Patches (3-count)", "Weighted Aromatherapy Eye Pillow", "Herbal Bath Soak", "Juna 2-packs Sleep Gummies", "2 Custom Printed Fliers"],
      price: 100
    },
    {
      id: 'wintertimeHealthy',
      name: "Wintertime Stay Healthy Box",
      items: ["Evergreen + Eucalyptus Candle", "Calming Tea", "Sinus & Headache Relief Roll-On", "Breathe Aromatherapy Inhaler Patches (3-count)", "Daily Absorbent Vitamin Patch (2 boxes)", "2 Custom Printed Fliers"],
      price: 100
    },
    {
      id: 'newYearFreshStart',
      name: "New Year Fresh Start Box",
      items: ["Lavender Aromatherapy Candle", "2-count Bright Eyes Collagen Eye Mask", "20oz Tumbler", "Mind of a Champion Card Deck", "Dreamy Dark Chocolate Bar", "2 Custom Printed Fliers"],
      price: 100
    }
  ];

  const hasAnyBoxes = calculateWellnessBoxTotal() > 0 || customBoxQuantity > 0;

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

        .sample-boxes-section {
          background: linear-gradient(135deg, rgba(234, 249, 149, 0.2), rgba(202, 229, 227, 0.2));
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 32px;
          border: 2px solid #eaf995;
        }

        @media (min-width: 768px) {
          .sample-boxes-section {
            padding: 24px;
          }
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

        .sample-images {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        .sample-images img {
          width: 60px;
          height: 60px;
          object-fit: cover;
          border-radius: 8px;
          box-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
        }

        @media (min-width: 768px) {
          .sample-images img {
            width: 70px;
            height: 70px;
          }
        }

        .total-cost-card {
          background: linear-gradient(135deg, #770142, #441d37);
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 32px;
          color: white;
          box-shadow: 
            8px 8px 16px rgba(0, 0, 0, 0.2),
            -8px -8px 16px rgba(255, 255, 255, 0.05);
        }

        @media (min-width: 768px) {
          .total-cost-card {
            padding: 24px;
          }
        }
      `}</style>

      <div className="mb-6 md:mb-8">
        <img
          src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/0e643c189_Screenshot2026-02-18at32939PM.png"
          alt="Wellness Box"
          className="w-full rounded-2xl mb-5 object-cover"
          style={{ maxHeight: '260px' }}
        />
        <h2 className="text-2xl md:text-3xl font-bold mb-2 md:mb-3" style={{ color: '#013f7c' }}>
          Wellness Box Incentives
        </h2>
        <p className="text-base md:text-lg mb-3 md:mb-4" style={{ color: '#666' }}>
          Boost engagement with customized wellness boxes for your team
        </p>
      </div>

      {/* Custom Box Builder */}
      <WellnessBoxBuilder 
        wellnessItems={wellnessItems} 
        customBoxQuantity={customBoxQuantity}
        onQuantityChange={handleCustomQuantityChange}
        onCustomBoxChange={handleCustomBoxChange}
      />

      {/* Pre-Designed Sample Boxes Section */}
      <div className="sample-boxes-section">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 md:w-6 md:h-6" style={{ color: '#264d44' }} />
          <h3 className="text-xl md:text-2xl font-bold" style={{ color: '#264d44' }}>
            Pre-Designed Sample Boxes
          </h3>
        </div>
        <p className="text-sm mb-6" style={{ color: '#666' }}>
          Choose from our curated wellness box collections
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sampleBoxes.map((box) => (
            <div key={box.id} className="sample-box">
              <div className="sample-images">
                {sampleBoxImages[box.id].map((img, i) => (
                  <img key={i} src={img} alt="" />
                ))}
              </div>
              <h4>{box.name}</h4>
              <p className="text-sm font-bold mb-2" style={{ color: '#770142' }}>${box.price} per box (incl. shipping)</p>
              <ul>
                {box.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
              <div className="neuro-stepper mt-3">
                <button 
                  className="neuro-stepper-btn"
                  onClick={() => updateSampleBoxQuantity(box.id, false)}
                >
                  −
                </button>
                <span className="flex-1 text-center text-lg font-bold" style={{ color: '#333' }}>
                  {sampleBoxQuantities[box.id]}
                </span>
                <button 
                  className="neuro-stepper-btn"
                  onClick={() => updateSampleBoxQuantity(box.id, true)}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Total Wellness Box Cost */}
      {hasAnyBoxes && (
        <div className="total-cost-card">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 md:w-6 md:h-6" />
            <h3 className="text-lg md:text-xl font-bold">Total Wellness Box Investment</h3>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-base md:text-lg">Pre-Designed Boxes</span>
            <span className="text-xl md:text-2xl font-bold">
              ${((sampleBoxQuantities.reduceStress || 0) * 100 + 
                 (sampleBoxQuantities.emotionalWellness || 0) * 100 + 
                 (sampleBoxQuantities.relaxationSleep || 0) * 100 + 
                 (sampleBoxQuantities.wintertimeHealthy || 0) * 100 + 
                 (sampleBoxQuantities.newYearFreshStart || 0) * 100).toLocaleString()}
            </span>
          </div>
          {customBoxQuantity > 0 && customBoxItems.length > 0 && (
            <div className="flex justify-between items-center mt-2">
              <span className="text-base md:text-lg">Custom Boxes ({customBoxQuantity})</span>
              <span className="text-xl md:text-2xl font-bold">
                ${(customBoxItems.reduce((sum, item) => sum + item.price, 0) * customBoxQuantity).toLocaleString()}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/20">
            <span className="text-lg md:text-xl font-bold">Total</span>
            <span className="text-2xl md:text-3xl font-bold">${calculateWellnessBoxTotal().toLocaleString()}</span>
          </div>
          <p className="text-xs mt-3 text-right opacity-80">
            (estimated before shipping)
          </p>
        </div>
      )}

      <StepNavigation
        onNext={onNext}
        onBack={onBack}
        nextLabel="Continue to Review"
      />
    </div>
  );
}