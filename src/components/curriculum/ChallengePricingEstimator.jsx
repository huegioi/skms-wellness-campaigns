import React, { useState } from 'react';

const TIERS = [
  { min: 40,   max: 49,   price: 27 },
  { min: 50,   max: 59,   price: 25 },
  { min: 60,   max: 99,   price: 24 },
  { min: 100,  max: 149,  price: 22 },
  { min: 150,  max: 199,  price: 20 },
  { min: 200,  max: 249,  price: 18 },
  { min: 250,  max: 299,  price: 15 },
  { min: 300,  max: 349,  price: 14 },
  { min: 350,  max: 399,  price: 13 },
  { min: 400,  max: 499,  price: 12 },
  { min: 500,  max: 999,  price: 10 },
  { min: 1000, max: Infinity, price: 9 },
];

function calcPricing(headcount) {
  if (!headcount || headcount <= 0) return null;
  const baseSlots = Math.round(headcount * 0.3);
  const minimumApplied = baseSlots < 40;
  const targetSlots = minimumApplied ? 40 : baseSlots;
  const tier = TIERS.find(t => targetSlots >= t.min && targetSlots <= t.max);
  const pricePerPerson = tier ? tier.price : 9;
  const totalCost = targetSlots * pricePerPerson;
  return { targetSlots, minimumApplied, pricePerPerson, totalCost };
}

function tierLabel(tier) {
  if (tier.max === Infinity) return `${tier.min.toLocaleString()}+ slots`;
  return `${tier.min}–${tier.max} slots`;
}

export default function ChallengePricingEstimator({ initialHeadcount }) {
  const [headcount, setHeadcount] = useState(initialHeadcount ? String(initialHeadcount) : '');
  const result = calcPricing(parseInt(headcount, 10));
  const activeTier = result
    ? TIERS.find(t => result.targetSlots >= t.min && result.targetSlots <= t.max)
    : null;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mb-8">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100" style={{ background: 'linear-gradient(135deg, #013f7c 0%, #012a54 100%)' }}>
        <h3 className="text-lg font-bold text-white">Challenge Pricing Estimator</h3>
        <p className="text-sm text-blue-200 mt-0.5">Enter headcount to calculate engagement slots and investment</p>
      </div>

      <div className="p-6">
        {/* Input */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Total Company Headcount</label>
          <input
            type="number"
            min="1"
            placeholder="e.g. 150"
            value={headcount}
            onChange={e => setHeadcount(e.target.value)}
            className="w-full max-w-xs border border-gray-300 rounded-lg px-4 py-2.5 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Output Metrics */}
        {result ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">Target Engagement Slots (30%)</p>
              <p className="text-3xl font-bold text-blue-800">{result.targetSlots.toLocaleString()}</p>
              {result.minimumApplied && (
                <p className="text-xs text-blue-500 italic mt-1">(Platform minimum applied)</p>
              )}
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Volume Rate</p>
              <p className="text-3xl font-bold text-emerald-800">${result.pricePerPerson}<span className="text-lg font-normal text-emerald-600"> / person</span></p>
            </div>
            <div className="rounded-xl p-4 border border-gray-200" style={{ background: 'linear-gradient(135deg, #013f7c10, #013f7c05)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#013f7c' }}>Total Challenge Investment</p>
              <p className="text-3xl font-bold" style={{ color: '#013f7c' }}>${result.totalCost.toLocaleString()}</p>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-400 text-sm mb-6">
            Enter a headcount above to see pricing
          </div>
        )}

        {/* Volume Pricing Table */}
        <div>
          <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Challenge Volume Pricing</h4>
          <div className="rounded-xl overflow-hidden border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Engagement Slots</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-gray-600">Price Per Person</th>
                </tr>
              </thead>
              <tbody>
                {TIERS.map((tier, i) => {
                  const isActive = activeTier && tier.min === activeTier.min;
                  return (
                    <tr
                      key={i}
                      className={`border-b border-gray-100 last:border-0 transition-colors ${
                        isActive
                          ? 'bg-blue-50 font-semibold'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-2.5 flex items-center gap-2">
                        {isActive && (
                          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                        )}
                        {!isActive && <span className="inline-block w-2 h-2 flex-shrink-0" />}
                        <span className={isActive ? 'text-blue-800' : 'text-gray-700'}>{tierLabel(tier)}</span>
                      </td>
                      <td className={`px-4 py-2.5 text-right ${isActive ? 'text-blue-800' : 'text-gray-700'}`}>
                        ${tier.price} / person
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export the calc function so ChallengeStep can use the same math
export { calcPricing };