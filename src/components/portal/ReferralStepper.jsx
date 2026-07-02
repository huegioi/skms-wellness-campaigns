import React from 'react';

const STEPS = ['Under Review', 'Contacted', 'Converted', 'Purchased', 'Commission Paid'];

const STATUS_TO_STEP = {
  pending_review: 1,
  submitted: 1,
  contacted: 2,
  converted_to_client: 3,
  purchased: 4,
  commission_paid: 5,
};

export default function ReferralStepper({ status }) {
  const currentStep = STATUS_TO_STEP[status];
  if (!currentStep) return null; // not_eligible etc. — no stepper

  return (
    <div className="flex items-center w-full mt-2">
      {STEPS.map((label, i) => {
        const stepNum = i + 1;
        const filled = stepNum <= currentStep;
        const isLast = i === STEPS.length - 1;
        return (
          <React.Fragment key={label}>
            <div className="flex items-center shrink-0">
              <span
                className={`rounded-full ${filled ? 'bg-brand-navy' : 'bg-gray-300'}`}
                style={{
                  width: 10,
                  height: 10,
                }}
                title={label}
              />
            </div>
            {!isLast && (
              <div
                className={`h-0.5 flex-1 mx-1 min-w-[6px] ${stepNum < currentStep ? 'bg-brand-navy' : 'bg-gray-300'}`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}