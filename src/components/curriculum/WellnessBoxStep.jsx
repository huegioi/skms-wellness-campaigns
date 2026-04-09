import React, { useState } from 'react';
import StepNavigation from './StepNavigation';
import WellnessBoxBuilder from './WellnessBoxBuilder';
import { Gift, Sparkles, DollarSign, Zap, Brain, Send, Loader2, CheckCircle, BookOpen, Headphones, Video } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const IMG_BASE = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/';

const physicalBrochureBoxes = [
  {
    id: 'reduceStress',
    name: 'Reduce Stress Wellness Sample Box',
    price: 60,
    priceLabel: '$60/box + shipping',
    bgColor: '#d0d5f0',
    items: [
      { name: 'Heywell Calm + Hydrate Sparkling Lime', img: 'f85466826_HeywellCalmHydrateSparklingLime.png' },
      { name: 'Calm Aromatherapy Patches', img: 'f133641a7_CalmAromatherapyInhalerPatches.png' },
      { name: 'Creamy Milk Chocolate Bar', img: '57730873a_Dreamy_DarkChocolateHotCocoa.png' },
      { name: 'Squishy Dumpling Stress Ball', img: '3ef20e96d_SquishingDumplingStressBall.png' },
      { name: 'Calm Absorbent Vitamin Patch', img: 'f133641a7_CalmAromatherapyInhalerPatches.png' },
      { name: '2 Custom Printed Fliers', img: null },
    ]
  },
  {
    id: 'largeEmotional',
    name: 'Large Emotional Wellness Sample Box',
    price: 100,
    priceLabel: '$100/box + shipping',
    bgColor: '#e8e0d5',
    items: [
      { name: 'Mindfulness Cards', img: '582be99d3_MindfulnessCards.png' },
      { name: 'Herbal Bath Soak', img: 'd696c945f_HerbalBathSalts-Personalizable.png' },
      { name: 'Calming Tea', img: 'e5cc21c9f_CalmingTeaHerbalBlend.png' },
      { name: 'Dreamy Dark Chocolate Bar', img: '57730873a_Dreamy_DarkChocolateHotCocoa.png' },
      { name: 'Meditation Cushion', img: '9483b8c12_WeightedAromatherapyEyePillow.png' },
      { name: '2 Custom Printed Fliers', img: null },
    ]
  },
  {
    id: 'relaxationSleep',
    name: 'Relaxation & Sleep Sample Box',
    price: 60,
    priceLabel: '$60 Per Box',
    bgColor: '#f5dde8',
    items: [
      { name: 'Heywell Calm + Hydrate', img: 'f85466826_HeywellCalmHydrateSparklingLime.png' },
      { name: 'Calm Aromatherapy Patches', img: 'f133641a7_CalmAromatherapyInhalerPatches.png' },
      { name: 'Weighted Aromatherapy Eye Pillow', img: '9483b8c12_WeightedAromatherapyEyePillow.png' },
      { name: 'Herbal Bath Soak', img: 'd696c945f_HerbalBathSalts-Personalizable.png' },
      { name: 'Sleep Gummies', img: '8d0c5d7c4_SleepGummies.png' },
      { name: '2 Custom Printed Fliers', img: null },
    ]
  },
  {
    id: 'largeStressReduction',
    name: 'Large Stress Reduction Sample Box',
    price: 120,
    priceLabel: '$120/box',
    bgColor: '#e5d0b8',
    items: [
      { name: 'Calming Tea', img: 'e5cc21c9f_CalmingTeaHerbalBlend.png' },
      { name: 'Calm Aromatherapy Patches', img: 'f133641a7_CalmAromatherapyInhalerPatches.png' },
      { name: 'Squishy Dumpling Stress Ball', img: '3ef20e96d_SquishingDumplingStressBall.png' },
      { name: 'Essential Oil Roller', img: '916a98720_EssentialOilRoller.png' },
      { name: 'Mindfulness Cards', img: '582be99d3_MindfulnessCards.png' },
      { name: 'Heywell Calm + Hydrate', img: 'f85466826_HeywellCalmHydrateSparklingLime.png' },
      { name: 'Herbal Bath + Dark Chocolate', img: 'd696c945f_HerbalBathSalts-Personalizable.png' },
      { name: 'Absorbent Vitamin Patch', img: 'f133641a7_CalmAromatherapyInhalerPatches.png' },
      { name: '2 Custom Printed Fliers', img: null },
    ]
  }
];

const digitalBrochureBoxes = [
  {
    id: 'stressReductionDigital',
    name: 'Stress Reduction Sample Digital Box',
    price: 50,
    priceLabel: '$50',
    items: [
      { name: '$25 Digital Giftcard\n(Over 100 merchants)', icon: Gift },
      { name: '1 Topic Mini-Course Video', icon: Video },
      { name: 'Meditation Recordings', icon: Headphones },
      { name: 'Digital Workbook', icon: BookOpen },
    ]
  },
  {
    id: 'beyondBurnoutDigital',
    name: 'Beyond Burnout Sample Digital Box',
    price: 100,
    priceLabel: '$100',
    items: [
      { name: '$50 Digital Giftcard\n(Over 100 merchants)', icon: Gift },
      { name: '2 Topic Mini-Course Videos', icon: Video },
      { name: '2 Meditation Recordings', icon: Headphones },
      { name: 'Digital Workbook', icon: BookOpen },
    ]
  }
];

const physicalSteps = [
  {
    num: '01',
    title: 'Step One',
    heading: 'Select 1 or 2 Wellness Box Themes',
    body: 'Chose your topic: Mental Health/Stress Relief, Gratitude, New Year New You theme and customize items in your boxes (see details on next page)'
  },
  {
    num: '02',
    title: 'Step Two',
    heading: 'Tell Us Your Budget',
    body: 'We determine your per box budget using your wellness fund budget divided by your employee head count. Boxes range between $40–$100 depending on items included.'
  },
  {
    num: '03',
    title: 'Step Three',
    heading: 'We Ship Your Wellness Boxes',
    body: 'Finally, we collect the addresses you would like the boxes mailed to. Based on your choices above, your box will be curated for you, then shipped to employees homes and/or offices. Shipping is USPS $4.95–$12.50 depending on weight.'
  }
];

const digitalSteps = [
  {
    num: '01',
    title: 'Step One',
    heading: 'Select Your Wellness Box Theme',
    body: 'Chose your topic: Mental Health/Stress Relief, Mindfulness, Emotional Resilience, then add the giftcard amount of your choice. (see details on next page)'
  },
  {
    num: '02',
    title: 'Step Two',
    heading: 'Tell Us Your Budget',
    body: 'We determine your per box budget using your wellness fund budget divided by your employee head count. Digital Boxes are $30/box plus to cost of your gift card ($5–$200 or more). Employees will be able to chose the merchant for the gift card of their choice based on available merchants in their country.'
  },
  {
    num: '03',
    title: 'Step Three',
    heading: 'We Email Your Digital Wellness Boxes',
    body: 'Finally, we collect the email addresses you would like the rewards sent to. We can collect this information ourselves during a workshop or challenge, or you can send us a list. Making incentives turn-key with your wellness program.'
  }
];

function StepCard({ num, title, heading, body }) {
  return (
    <div className="bg-white rounded-2xl p-5 flex-1 min-w-0 shadow-sm" style={{ border: '1px solid #e8e0d5' }}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: '#441d37' }}>
          {num}
        </div>
        <span className="font-semibold text-gray-700">{title}</span>
      </div>
      <p className="font-bold text-sm mb-3" style={{ color: '#1a1a1a' }}>{heading}</p>
      <div className="h-px mb-3" style={{ background: '#e0d8cf' }} />
      <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
    </div>
  );
}

function BoxStepper({ qty, onDecrement, onIncrement }) {
  return (
    <div className="flex items-center gap-3 mt-4">
      <button
        onClick={onDecrement}
        className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg transition-all"
        style={{ background: '#f4f0e9', color: '#441d37', boxShadow: '3px 3px 6px rgba(0,0,0,0.12), -3px -3px 6px rgba(255,255,255,0.9)' }}
      >−</button>
      <span className="w-8 text-center font-bold text-lg" style={{ color: '#333' }}>{qty}</span>
      <button
        onClick={onIncrement}
        className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg transition-all"
        style={{ background: '#f4f0e9', color: '#441d37', boxShadow: '3px 3px 6px rgba(0,0,0,0.12), -3px -3px 6px rgba(255,255,255,0.9)' }}
      >+</button>
      {qty > 0 && (
        <span className="text-sm font-semibold ml-2" style={{ color: '#264d44' }}>
          ✓ {qty} box{qty > 1 ? 'es' : ''} added
        </span>
      )}
    </div>
  );
}

function PhysicalBoxCard({ box, qty, onDecrement, onIncrement }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold" style={{ color: '#1a1a1a' }}>{box.name}</h3>
        <span className="px-4 py-1.5 rounded-full border text-sm font-semibold" style={{ borderColor: '#441d37', color: '#441d37' }}>
          {box.priceLabel}
        </span>
      </div>

      <div className="rounded-2xl p-4 overflow-hidden" style={{ background: box.bgColor }}>
        <div className="flex gap-3 overflow-x-auto pb-2 flex-wrap">
          {box.items.map((item, i) => (
            <div key={i} className="flex flex-col items-center text-center flex-shrink-0" style={{ width: '90px' }}>
              {item.img ? (
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-white/60 flex items-center justify-center mb-2">
                  <img src={IMG_BASE + item.img} alt={item.name} className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-xl bg-white/60 flex items-center justify-center mb-2">
                  <span className="text-xs text-center font-medium text-gray-600 px-1">Custom Flier</span>
                </div>
              )}
              <p className="text-xs text-center leading-tight text-gray-700">{item.name}</p>
            </div>
          ))}
        </div>
      </div>

      <BoxStepper qty={qty} onDecrement={onDecrement} onIncrement={onIncrement} />
    </div>
  );
}

function DigitalBoxCard({ box, qty, onDecrement, onIncrement }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold" style={{ color: '#1a1a1a' }}>{box.name}</h3>
        <span className="px-4 py-1.5 rounded-full border text-sm font-semibold" style={{ borderColor: '#441d37', color: '#441d37' }}>
          {box.priceLabel}
        </span>
      </div>

      <div className="rounded-2xl p-4" style={{ background: '#f0ebe0', border: '1px solid #e0d8cf' }}>
        <div className="flex gap-4 flex-wrap">
          {box.items.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="flex flex-col items-center text-center flex-shrink-0" style={{ width: '110px' }}>
                <div className="w-24 h-20 rounded-xl bg-white flex items-center justify-center mb-2 shadow-sm">
                  <Icon className="w-10 h-10" style={{ color: '#264d44' }} />
                </div>
                <p className="text-xs text-center leading-tight text-gray-700 whitespace-pre-line">{item.name}</p>
              </div>
            );
          })}
        </div>
      </div>

      <BoxStepper qty={qty} onDecrement={onDecrement} onIncrement={onIncrement} />
    </div>
  );
}

// ─── Existing sample boxes (kept at bottom per user request) ──────────────────
const sampleBoxImages = {
  reduceStress: ['f85466826_HeywellCalmHydrateSparklingLime.png','108912f16_EucalyptusShowerSteamers.png','57730873a_Dreamy_DarkChocolateHotCocoa.png','3ef20e96d_SquishingDumplingStressBall.png','f133641a7_CalmAromatherapyInhalerPatches.png'].map(x => IMG_BASE + x),
  emotionalWellness: ['582be99d3_MindfulnessCards.png','f133641a7_CalmAromatherapyInhalerPatches.png','e5cc21c9f_CalmingTeaHerbalBlend.png','57730873a_Dreamy_DarkChocolateHotCocoa.png','933cd01d1_MindfulnessLavenderRelaxationEyePillows.png'].map(x => IMG_BASE + x),
  relaxationSleep: ['0bf578406_YogasleepSoundMachine.png','f133641a7_CalmAromatherapyInhalerPatches.png','9483b8c12_WeightedAromatherapyEyePillow.png','d696c945f_HerbalBathSalts-Personalizable.png','8d0c5d7c4_SleepGummies.png'].map(x => IMG_BASE + x),
  wintertimeHealthy: ['206d14e8c_MerryMintHolidayCandle.png','e5cc21c9f_CalmingTeaHerbalBlend.png','377fd46e8_SinusReliefRoll-On.png','4cfe0eb01_BreatheCongestionHelpingAromatherapyInhalerPatches.png','f133641a7_CalmAromatherapyInhalerPatches.png'].map(x => IMG_BASE + x),
  newYearFreshStart: ['a022c39d9_LavenderAromatherapyCandle.png','3ef042c0e_GoldUnderEyePatches-CollagenEyeMask.png','f17efc8d4_SkinnyTumbler-18oz.png','582be99d3_MindfulnessCards.png','57730873a_Dreamy_DarkChocolateHotCocoa.png'].map(x => IMG_BASE + x),
};

const bottomSampleBoxes = [
  { id: 'emotionalWellness', name: "Emotional Wellness Box", price: 100, items: ["Mindfulness Cards","Calm Aromatherapy (2-count)","Calming Tea","Dreamy Dark Chocolate Bar","Meditation Cushion","2 Custom Printed Fliers"] },
  { id: 'wintertimeHealthy', name: "Wintertime Stay Healthy Box", price: 100, items: ["Evergreen + Eucalyptus Candle","Calming Tea","Sinus & Headache Relief Roll-On","Breathe Aromatherapy Inhaler Patches (3-count)","Daily Absorbent Vitamin Patch (2 boxes)","2 Custom Printed Fliers"] },
  { id: 'newYearFreshStart', name: "New Year Fresh Start Box", price: 100, items: ["Lavender Aromatherapy Candle","2-count Bright Eyes Collagen Eye Mask","20oz Tumbler","Mind of a Champion Card Deck","Dreamy Dark Chocolate Bar","2 Custom Printed Fliers"] }
];

const wellnessItems = [
  { id: '1', name: "Tumbler Shot Glass with Metal Straw and Lid", price: 9.00, image: IMG_BASE + "b55e1d9df_3ozTumblerShotGlasswithMetalStrawandLid.png" },
  { id: '2', name: "Canvas Gym Bag", price: 20.00, image: IMG_BASE + "c096f72ca_CanvasGymBag.png" },
  { id: '3', name: "Skelcore Dual Wheel Massage Roller", price: 9.00, image: IMG_BASE + "9eb0bd57f_SkelcoreDualWheelMassageRoller.png" },
  { id: '4', name: "Fitbit Inspire Activity Tracker", price: 40.00, image: IMG_BASE + "4ae0637c1_FitbitInspireActivityTracker.png" },
  { id: '5', name: "Bright Eyes Collagen Eye Mask", price: 6.00, image: IMG_BASE + "33181040b_BrightEyesCollagenEyeMask.png" },
  { id: '6', name: "Sweet Dream Drops Bath Bombs", price: 4.00, image: IMG_BASE + "9d9bf38fb_SweetDreamDrops_LavenderMagnesiumBathBombs.png" },
  { id: '7', name: "Custom Printed Cotton Tote Bags", price: 7.00, image: IMG_BASE + "88710e02f_CustomPrintedCottonBagsBulkToteBagsPersonalized.png" },
  { id: '8', name: "Custom Printed Clear Glass Coffee Mug", price: 15.00, image: IMG_BASE + "9e1e19041_CustomPrintedClearGlassCoffeeMugForBusiness-YourLogo.png" },
  { id: '9', name: "Custom Black Lip Ceramic Camper Mug", price: 20.00, image: IMG_BASE + "9dd325f07_YourLogoorArtCustom-BlackLipCeramicCamper13ozMug.png" },
  { id: '10', name: "Private Label Floral Bath Salt Soak", price: 5.00, image: IMG_BASE + "f5ad4a846_PrivateLabelFloralBathSaltSoakinTestTubes.png" },
  { id: '11', name: "Custom Logo Journal", price: 22.00, image: IMG_BASE + "8a7bf4761_CustomLogoJournal-BusinessBrandingNotebook.png" },
  { id: '12', name: "Custom Logo Candles", price: 20.00, image: IMG_BASE + "00d4c4b1b_CustomLogocandle.png" },
  { id: '22', name: "Heywell Calm + Hydrate", price: 7.00, image: IMG_BASE + "f85466826_HeywellCalmHydrateSparklingLime.png" },
  { id: '23', name: "Mindfulness Cards", price: 15.00, image: IMG_BASE + "582be99d3_MindfulnessCards.png" },
  { id: '24', name: "Essential Oil Roller", price: 15.00, image: IMG_BASE + "916a98720_EssentialOilRoller.png" },
  { id: '25', name: "Sleep Gummies", price: 6.00, image: IMG_BASE + "8d0c5d7c4_SleepGummies.png" },
  { id: '26', name: "Calming Tea", price: 7.00, image: IMG_BASE + "e5cc21c9f_CalmingTeaHerbalBlend.png" },
  { id: '27', name: "Eucalyptus Shower Steamers", price: 4.00, image: IMG_BASE + "108912f16_EucalyptusShowerSteamers.png" },
  { id: '28', name: "Squishy Dumpling Stress Ball", price: 5.00, image: IMG_BASE + "3ef20e96d_SquishingDumplingStressBall.png" },
  { id: '31', name: "Calm Aromatherapy Patches", price: 6.00, image: IMG_BASE + "f133641a7_CalmAromatherapyInhalerPatches.png" },
  { id: '36', name: "Weighted Eye Pillow", price: 20.00, image: IMG_BASE + "9483b8c12_WeightedAromatherapyEyePillow.png" },
  { id: '37', name: "Dark Chocolate Hot Cocoa", price: 3.00, image: IMG_BASE + "57730873a_Dreamy_DarkChocolateHotCocoa.png" },
  { id: '46', name: "Gold Eye Patches", price: 3.00, image: IMG_BASE + "3ef042c0e_GoldUnderEyePatches-CollagenEyeMask.png" },
  { id: '50', name: "Cork Massage Balls", price: 6.00, image: IMG_BASE + "538527da8_CorkMassageBalls.png" },
];

export default function WellnessBoxStep({ selections, updateSelections, onNext, onBack }) {
  const [customBoxQuantity, setCustomBoxQuantity] = useState(selections.customBoxQuantity || 0);
  const [customBoxItems, setCustomBoxItems] = useState(selections.customBoxItems || []);
  const [sampleBoxQuantities, setSampleBoxQuantities] = useState(
    selections.sampleBoxQuantities || {
      reduceStress: 0, largeEmotional: 0, relaxationSleep: 0, largeStressReduction: 0,
      stressReductionDigital: 0, beyondBurnoutDigital: 0,
      emotionalWellness: 0, wintertimeHealthy: 0, newYearFreshStart: 0
    }
  );

  const [builderForm, setBuilderForm] = useState({ budget: '', theme: '', preferences: '', quantity: '', purpose: '', contactName: '', contactEmail: '', notes: '' });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSuggestions, setGeneratedSuggestions] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [showAIBuilder, setShowAIBuilder] = useState(false);

  const updateBoxQty = (id, delta) => {
    const newQty = { ...sampleBoxQuantities, [id]: Math.max(0, (sampleBoxQuantities[id] || 0) + delta) };
    setSampleBoxQuantities(newQty);
    updateSelections('sampleBoxQuantities', newQty);
  };

  const handleCustomQuantityChange = (newQuantity) => {
    setCustomBoxQuantity(newQuantity);
    updateSelections('customBoxQuantity', newQuantity);
  };

  const handleCustomBoxChange = (items) => {
    setCustomBoxItems(items);
    updateSelections('customBoxItems', items);
  };

  const generateSuggestions = async () => {
    if (!builderForm.budget || !builderForm.theme) { alert('Please fill in at least Budget and Theme.'); return; }
    setIsGenerating(true);
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a detailed wellness box suggestion with the following criteria:\n- Budget: ${builderForm.budget}\n- Theme: ${builderForm.theme}\n- Preferences: ${builderForm.preferences || 'None specified'}\n- Purpose: ${builderForm.purpose || 'General wellness'}\n\nSuggest 5-8 specific items to include, with estimated costs and brief descriptions.`,
        response_json_schema: { type: 'object', properties: { box_name: { type: 'string' }, total_estimated_cost: { type: 'number' }, items: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, estimated_cost: { type: 'number' } } } }, rationale: { type: 'string' } } }
      });
      setGeneratedSuggestions(response);
    } catch (error) { alert('Failed to generate suggestions.'); } finally { setIsGenerating(false); }
  };

  const handleSendRequest = async () => {
    if (!builderForm.contactName || !builderForm.contactEmail) { alert('Please provide your name and email.'); return; }
    setIsSending(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: 'wellness@example.com',
        subject: `Custom Wellness Box Request - ${builderForm.contactName}`,
        body: `<h2>Custom Wellness Box Request</h2><p><strong>Name:</strong> ${builderForm.contactName}</p><p><strong>Email:</strong> ${builderForm.contactEmail}</p><p><strong>Budget:</strong> ${builderForm.budget}</p><p><strong>Theme:</strong> ${builderForm.theme}</p><p><strong>Quantity:</strong> ${builderForm.quantity || 'Not specified'}</p><p><strong>Purpose:</strong> ${builderForm.purpose || 'Not specified'}</p><p><strong>Preferences:</strong> ${builderForm.preferences || 'None'}</p><p><strong>Notes:</strong> ${builderForm.notes || 'None'}</p>`
      });
      alert("Request sent successfully! We'll be in touch soon.");
      setBuilderForm({ budget: '', theme: '', preferences: '', quantity: '', purpose: '', contactName: '', contactEmail: '', notes: '' });
      setGeneratedSuggestions(null);
      setShowAIBuilder(false);
    } catch (error) { alert('Failed to send request.'); } finally { setIsSending(false); }
  };

  const totalBoxValue = () => {
    let t = 0;
    t += (sampleBoxQuantities.reduceStress || 0) * 60;
    t += (sampleBoxQuantities.largeEmotional || 0) * 100;
    t += (sampleBoxQuantities.relaxationSleep || 0) * 60;
    t += (sampleBoxQuantities.largeStressReduction || 0) * 120;
    t += (sampleBoxQuantities.stressReductionDigital || 0) * 50;
    t += (sampleBoxQuantities.beyondBurnoutDigital || 0) * 100;
    t += (sampleBoxQuantities.emotionalWellness || 0) * 100;
    t += (sampleBoxQuantities.wintertimeHealthy || 0) * 100;
    t += (sampleBoxQuantities.newYearFreshStart || 0) * 100;
    if (customBoxQuantity > 0 && customBoxItems.length > 0) {
      t += customBoxItems.reduce((s, i) => s + i.price, 0) * customBoxQuantity;
    }
    return t;
  };

  const hasAny = totalBoxValue() > 0;

  return (
    <div>
      {/* ── PAGE 30: Custom Wellness Boxes Intro ─────────────────────────── */}
      <div className="mb-10">
        <div className="text-center mb-8">
          <h2 className="text-4xl md:text-5xl font-bold mb-3" style={{ color: '#441d37', fontFamily: 'Georgia, serif' }}>
            Custom Wellness<br />Boxes
          </h2>
          <p className="text-lg text-gray-500">Ordering Wellness Boxes is easy</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          {physicalSteps.map(s => <StepCard key={s.num} {...s} />)}
        </div>

        <div className="rounded-2xl overflow-hidden">
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/0e643c189_Screenshot2026-02-18at32939PM.png"
            alt="Wellness Box"
            className="w-full object-cover"
            style={{ maxHeight: '320px' }}
          />
        </div>
      </div>

      {/* ── PAGES 31-32: Sample Physical Box Ideas ───────────────────────── */}
      <div className="mb-10">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: '#441d37', fontFamily: 'Georgia, serif' }}>
            Sample Wellness Box Ideas
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">Give your employees the gift of wellness by providing them with products that support their emotional well-being.</p>
        </div>

        {physicalBrochureBoxes.map(box => (
          <PhysicalBoxCard
            key={box.id}
            box={box}
            qty={sampleBoxQuantities[box.id] || 0}
            onDecrement={() => updateBoxQty(box.id, -1)}
            onIncrement={() => updateBoxQty(box.id, 1)}
          />
        ))}

        <p className="text-xs text-gray-400 mt-2">*Some of our boxes — custom options available.</p>
        <p className="text-xs text-gray-400">*Travel fees may apply. Recording availability varies.</p>
      </div>

      {/* ── PAGE 33: Digital Wellness Boxes Intro ────────────────────────── */}
      <div className="mb-10">
        <div className="text-center mb-8">
          <h2 className="text-4xl md:text-5xl font-bold mb-3" style={{ color: '#441d37', fontFamily: 'Georgia, serif' }}>
            Digital<br />Wellness Boxes
          </h2>
          <p className="text-lg text-gray-500">Introducing our Global Incentive Solution</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          {digitalSteps.map(s => <StepCard key={s.num} {...s} />)}
        </div>

        <div className="rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center" style={{ height: '240px' }}>
          <div className="text-center p-8" style={{ background: 'linear-gradient(135deg, #264d44, #013f7c)', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px' }}>
            <div className="text-white text-center">
              <div className="text-3xl font-bold mb-2" style={{ fontFamily: 'Georgia, serif' }}>Digital Wellness Box</div>
              <p className="text-white/70">Global incentive solution for remote teams</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── PAGE 34: Sample Digital Box Ideas ───────────────────────────── */}
      <div className="mb-10">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-3" style={{ color: '#441d37', fontFamily: 'Georgia, serif' }}>
            Digital Wellness Boxes
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">Give your employees the gift of wellness by providing them with digital products that support their emotional well-being.</p>
        </div>

        {digitalBrochureBoxes.map(box => (
          <DigitalBoxCard
            key={box.id}
            box={box}
            qty={sampleBoxQuantities[box.id] || 0}
            onDecrement={() => updateBoxQty(box.id, -1)}
            onIncrement={() => updateBoxQty(box.id, 1)}
          />
        ))}
      </div>

      {/* ── AI Builder (collapsible) ─────────────────────────────────────── */}
      <div className="mb-8">
        <button
          onClick={() => setShowAIBuilder(!showAIBuilder)}
          className="w-full flex items-center justify-between px-5 py-4 rounded-xl font-semibold text-white transition-all"
          style={{ background: 'linear-gradient(to right, #264d44, #013f7c)' }}
        >
          <span className="flex items-center gap-2"><Zap className="w-5 h-5" /> AI-Powered Custom Box Builder</span>
          <span>{showAIBuilder ? '▲' : '▼'}</span>
        </button>
        {showAIBuilder && (
          <div className="border-2 border-[#264d44] rounded-b-xl p-5 space-y-4 bg-white">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Budget per Box *</label>
                <Select value={builderForm.budget} onValueChange={(v) => setBuilderForm({...builderForm, budget: v})}>
                  <SelectTrigger><SelectValue placeholder="Select budget range..." /></SelectTrigger>
                  <SelectContent>
                    {['$25-$50','$50-$75','$75-$100','$100-$150','$150+'].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Theme *</label>
                <Select value={builderForm.theme} onValueChange={(v) => setBuilderForm({...builderForm, theme: v})}>
                  <SelectTrigger><SelectValue placeholder="Select theme..." /></SelectTrigger>
                  <SelectContent>
                    {['Mental Health/Stress Relief','Gratitude','Self-Care','Mindfulness','Emotional Resilience','Work-Life Balance','New Year New You'].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Quantity Needed</label>
                <Input type="number" placeholder="How many boxes?" value={builderForm.quantity} onChange={(e) => setBuilderForm({...builderForm, quantity: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Purpose</label>
                <Select value={builderForm.purpose} onValueChange={(v) => setBuilderForm({...builderForm, purpose: v})}>
                  <SelectTrigger><SelectValue placeholder="What's this for?" /></SelectTrigger>
                  <SelectContent>
                    {['Workshop Attendance Incentive','Challenge Completion Prize','Monthly Recognition','Onboarding Gift','Holiday Gift','Other'].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Item Preferences</label>
              <Textarea placeholder="Any specific items you'd like included?" value={builderForm.preferences} onChange={(e) => setBuilderForm({...builderForm, preferences: e.target.value})} rows={2} />
            </div>
            <Button onClick={generateSuggestions} disabled={isGenerating || !builderForm.budget || !builderForm.theme} className="w-full bg-[#770142] hover:bg-[#5a0132]">
              {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : <><Brain className="w-4 h-4 mr-2" />Generate AI Suggestions</>}
            </Button>
            {generatedSuggestions && (
              <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <h3 className="text-lg font-bold text-green-900">{generatedSuggestions.box_name}</h3>
                </div>
                <p className="text-sm text-gray-700 mb-3">{generatedSuggestions.rationale}</p>
                <div className="space-y-2 mb-3">
                  {generatedSuggestions.items.map((item, idx) => (
                    <div key={idx} className="bg-white p-2 rounded border border-green-200">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-semibold text-sm text-gray-800">{item.name}</p>
                        <Badge>${item.estimated_cost}</Badge>
                      </div>
                      <p className="text-xs text-gray-600">{item.description}</p>
                    </div>
                  ))}
                </div>
                <p className="text-right font-bold text-green-900">Total: ${generatedSuggestions.total_estimated_cost}</p>
              </div>
            )}
            <div className="border-t pt-4">
              <h3 className="text-base font-semibold text-gray-800 mb-3">Send This Request</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <Input placeholder="Your Name *" value={builderForm.contactName} onChange={(e) => setBuilderForm({...builderForm, contactName: e.target.value})} />
                <Input type="email" placeholder="Your Email *" value={builderForm.contactEmail} onChange={(e) => setBuilderForm({...builderForm, contactEmail: e.target.value})} />
              </div>
              <Textarea className="mt-3" placeholder="Additional notes..." value={builderForm.notes} onChange={(e) => setBuilderForm({...builderForm, notes: e.target.value})} rows={2} />
              <Button onClick={handleSendRequest} disabled={isSending || !builderForm.contactName || !builderForm.contactEmail} className="w-full mt-3 bg-[#264d44] hover:bg-[#1a3830]">
                {isSending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</> : <><Send className="w-4 h-4 mr-2" />Send Custom Box Request</>}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Build Your Custom Wellness Box (kept per user request) ────────── */}
      <WellnessBoxBuilder
        wellnessItems={wellnessItems}
        customBoxQuantity={customBoxQuantity}
        onQuantityChange={handleCustomQuantityChange}
        onCustomBoxChange={handleCustomBoxChange}
      />

      {/* ── Pre-Designed Sample Boxes (kept per user request) ────────────── */}
      <div className="rounded-2xl p-5 mb-8" style={{ background: 'linear-gradient(135deg, rgba(234,249,149,0.2), rgba(202,229,227,0.2))', border: '2px solid #eaf995' }}>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5" style={{ color: '#264d44' }} />
          <h3 className="text-xl font-bold" style={{ color: '#264d44' }}>Pre-Designed Sample Boxes</h3>
        </div>
        <p className="text-sm mb-6 text-gray-500">Choose from our additional curated wellness box collections</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { id: 'reduceStress', ...physicalBrochureBoxes[0], items: ["Heywell Calm + Hydrate Sparkling Lime","Eucalyptus Shower Steamers","Creamy Milk Chocolate Bar","Squishy Dumpling Stress Ball","Calm Absorbent Vitamin Patch (2 boxes)","2 Custom Printed Fliers"] },
            { id: 'relaxationSleep', ...physicalBrochureBoxes[2], items: ["Yogasleep Travel Sound Machine","Calm Aromatherapy Patches (3-count)","Weighted Aromatherapy Eye Pillow","Herbal Bath Soak","Juna Sleep Gummies","2 Custom Printed Fliers"] },
            ...bottomSampleBoxes
          ].map((box) => (
            <div key={box.id + '_bottom'} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex gap-2 flex-wrap mb-3">
                {(sampleBoxImages[box.id] || []).map((img, i) => (
                  <img key={i} src={img} alt="" className="w-14 h-14 object-cover rounded-lg" />
                ))}
              </div>
              <h4 className="font-bold text-sm mb-1" style={{ color: '#264d44' }}>{box.name}</h4>
              <p className="text-sm font-bold mb-2" style={{ color: '#770142' }}>${box.price}/box</p>
              <ul className="mb-3">
                {box.items.map((item, i) => (
                  <li key={i} className="text-xs text-gray-500 flex items-start gap-1 py-0.5">
                    <span className="text-[#264d44] font-bold mt-0.5">•</span>{item}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-3 mt-3 p-2 rounded-xl" style={{ background: '#f4f0e9', boxShadow: 'inset 3px 3px 6px rgba(0,0,0,0.1), inset -3px -3px 6px rgba(255,255,255,0.8)' }}>
                <button
                  className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-lg"
                  style={{ background: '#f4f0e9', color: '#441d37', boxShadow: '3px 3px 6px rgba(0,0,0,0.12), -3px -3px 6px rgba(255,255,255,0.9)' }}
                  onClick={() => updateBoxQty(box.id, -1)}
                >−</button>
                <span className="flex-1 text-center font-bold">{sampleBoxQuantities[box.id] || 0}</span>
                <button
                  className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-lg"
                  style={{ background: '#f4f0e9', color: '#441d37', boxShadow: '3px 3px 6px rgba(0,0,0,0.12), -3px -3px 6px rgba(255,255,255,0.9)' }}
                  onClick={() => updateBoxQty(box.id, 1)}
                >+</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Cart Total ────────────────────────────────────────────────────── */}
      {hasAny && (
        <div className="rounded-2xl p-5 mb-8 text-white" style={{ background: 'linear-gradient(135deg, #770142, #441d37)' }}>
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-5 h-5" />
            <h3 className="text-lg font-bold">Total Wellness Box Investment</h3>
          </div>
          <div className="flex justify-between items-center pt-3 border-t border-white/20">
            <span className="text-lg font-bold">Total</span>
            <span className="text-2xl font-bold">${totalBoxValue().toLocaleString()}</span>
          </div>
          <p className="text-xs mt-2 text-right opacity-70">(estimated before shipping)</p>
        </div>
      )}

      <StepNavigation onNext={onNext} onBack={onBack} nextLabel="Continue to Review" />
    </div>
  );
}