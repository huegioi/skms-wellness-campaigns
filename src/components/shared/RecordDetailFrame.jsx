import React from 'react';
import { DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useIsWide } from '@/hooks/useMediaQuery';

/**
 * Responsive shell for record "popup previews" (client, partner lead,
 * referral partner, …).
 *
 * Sizing follows the window instead of a fixed Tailwind max-width:
 *   - phones:  bottom sheet, 94dvh tall (inherits the mobile behaviour of
 *              DialogContent)
 *   - sm+:     centered, 94vw wide up to `maxWidth`, 90vh tall
 *   - lg+:     the body splits into a main column (tabs / sections) and a
 *              right rail (stats, contacts, at-a-glance) that scroll
 *              independently, so a wide window shows more without paging.
 *
 * Structure:
 *   <RecordDetailContent>          — the DialogContent with responsive classes
 *     <RecordDetailFrame header rail>  — sticky header, body columns
 *       {main}
 *
 * `rail` is rendered ONCE: in the right column on wide windows, above the
 * main content on narrow ones (no duplicate mounts, no duplicate queries).
 */
export function RecordDetailContent({ className, maxWidth = '1180px', children, ...props }) {
  return (
    <DialogContent
      className={cn(
        // Mobile bottom sheet: taller than the default 85dvh so the tab body has room.
        'max-h-[94dvh] h-[94dvh] overflow-hidden overflow-y-hidden p-0 gap-0 flex flex-col rounded-t-2xl',
        // Desktop: track the window. sm:max-w-* overrides the base sm:max-w-lg.
        'sm:w-[94vw] sm:h-[90vh] sm:max-h-[90vh] sm:rounded-xl',
        className
      )}
      style={{ ['--record-dialog-max']: maxWidth }}
      {...props}
    >
      {/* max-width via CSS var so callers can pass any px/rem value */}
      <style>{`[data-record-dialog]{max-width:var(--record-dialog-max)}`}</style>
      <div data-record-dialog className="contents" />
      {children}
    </DialogContent>
  );
}

export function RecordDetailFrame({
  header,
  rail,
  railWidthClass = 'lg:w-[21rem] xl:w-[23rem]',
  mainClassName = '',
  railClassName = '',
  children,
}) {
  const isWide = useIsWide();

  return (
    <>
      {/* Sticky header — snapshot, actions. Never scrolls away. */}
      {header && (
        <div className="flex-shrink-0 border-b bg-white px-4 pt-5 pb-3 sm:px-6 sm:pt-6 sm:pb-4">
          {header}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div className={cn('flex-1 min-w-0 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5', mainClassName)}>
          {/* Narrow windows: the rail content sits above the main content. */}
          {!isWide && rail && <div className="mb-5 space-y-4">{rail}</div>}
          {children}
        </div>
        {isWide && rail && (
          <aside className={cn('shrink-0 min-h-0 overflow-y-auto overscroll-contain border-l bg-gray-50/70 px-4 py-5 space-y-4', railWidthClass, railClassName)}>
            {rail}
          </aside>
        )}
      </div>
    </>
  );
}

/** Small labelled number tile for rails / stat rows. */
export function StatTile({ label, value, sub, color = '#013f7c', className = '' }) {
  return (
    <div className={cn('bg-white border border-gray-200 rounded-lg px-3 py-2.5 min-w-0', className)}>
      <p className="text-[11px] uppercase tracking-wide text-gray-500 truncate">{label}</p>
      <p className="text-xl font-bold leading-tight truncate" style={{ color }}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{sub}</p>}
    </div>
  );
}

/** Section wrapper for the rail — a titled card. */
export function RailSection({ title, icon: Icon, action, children, className = '' }) {
  return (
    <section className={cn('bg-white border border-gray-200 rounded-lg p-3', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
            {Icon && <Icon className="w-3.5 h-3.5" />} {title}
          </h4>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export default RecordDetailFrame;
