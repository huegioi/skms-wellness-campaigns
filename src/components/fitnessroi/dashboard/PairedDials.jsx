import React from 'react';
import JourneyScoreDial from '@/components/fitnessroi/JourneyScoreDial';

export default function PairedDials({ leaderScore, teamScore }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-mf-plum font-semibold mb-2">You estimated</p>
        <div className="flex justify-center"><JourneyScoreDial score={leaderScore} size={140} ringColor="#441D37" /></div>
      </div>
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-mf-plum font-semibold mb-2">Your team says</p>
        <div className="flex justify-center"><JourneyScoreDial score={teamScore} size={140} ringColor="#441D37" /></div>
      </div>
    </div>
  );
}