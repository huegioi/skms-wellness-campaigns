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

const PORTAL_BLUE = '#013f7c';

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
                className="rounded-full"
                style={{
                  width: 10,
                  height: 10,
                  backgroundColor: filled ? PORTAL_BLUE : '#d1d5db',
                }}
                title={label}
              />
            </div>
            {!isLast && (
              <div
                className="h-0.5 flex-1 mx-1 min-w-[6px]"
                style={{ backgroundColor: stepNum < currentStep ? PORTAL_BLUE : '#d1d5db' }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}