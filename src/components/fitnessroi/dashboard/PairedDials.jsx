import React from 'react';
import JourneyScoreDial from '@/components/fitnessroi/JourneyScoreDial';

export default function PairedDials({ leaderScore, teamScore }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-[#4a2040] font-semibold mb-2">You estimated</p>
        <div className="flex justify-center"><JourneyScoreDial score={leaderScore} size={140} ringColor="#4a2040" /></div>
      </div>
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-[#0f766e] font-semibold mb-2">Your team says</p>
        <div className="flex justify-center"><JourneyScoreDial score={teamScore} size={140} ringColor="#0f766e" /></div>
      </div>
    </div>
  );
}