import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Check, Package, X } from 'lucide-react';

const IMG_BASE = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6911f6f4a9d8505805b51a3b/';

const COLLAGE_IMAGES = [
  '582be99d3_MindfulnessCards.png',
  '9483b8c12_WeightedAromatherapyEyePillow.png',
  'e5cc21c9f_CalmingTeaHerbalBlend.png',
  '916a98720_EssentialOilRoller.png',
].map(x => IMG_BASE + x);

export default function QuickBuilderWellnessBoxStep({ value, onChange, onBack, onNext }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-800">Wellness box incentives</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Physical or digital curated boxes that reward participation and reinforce program takeaways.
        </p>
      </div>

      {/* Collage */}
      <div className="grid grid-cols-4 gap-2 max-w-xs">
        {COLLAGE_IMAGES.map((img, i) => (
          <img key={i} src={img} alt="" className="w-full aspect-square object-cover rounded-lg" />
        ))}
      </div>

      {/* Toggle buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
            value === true
              ? 'border-brand-green bg-green-50 ring-2 ring-brand-green/20'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <Package className="w-6 h-6 text-brand-green flex-shrink-0" />
          <span className="font-semibold text-sm text-gray-800 text-left">Yes, include wellness boxes</span>
          {value === true && <Check className="w-5 h-5 text-brand-green ml-auto flex-shrink-0" />}
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
            value === false
              ? 'border-gray-400 bg-gray-50 ring-2 ring-gray-300/20'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <X className="w-6 h-6 text-gray-400 flex-shrink-0" />
          <span className="font-semibold text-sm text-gray-800 text-left">Not right now</span>
          {value === false && <Check className="w-5 h-5 text-gray-500 ml-auto flex-shrink-0" />}
        </button>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <Button onClick={onNext} className="bg-brand-navy hover:bg-[#012d5a] gap-2">
          Continue <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}