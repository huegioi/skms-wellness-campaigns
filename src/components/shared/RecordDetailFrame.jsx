import React from 'react';
import { DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useIsWide } from '@/hooks/useMediaQuery';

/**
 * Responsive shell for record popups and working dialogs (client, partner,
 * brokerage, calendar event, proposal, invoice, …).
 *
 * Sizing follows the window instead of a fixed Tailwind max-width:
 *   - phones:  bottom sheet up to 94dvh tall (inherits the mobile behavior of
 *              DialogContent)
 *   - sm+:     centered, 94vw wide up to `maxWidth`, up to 90vh tall
 *   - lg+:     the body splits into a main column and a right rail that
 *              scroll independently, so a wide window shows more at once.
 *
 *   <RecordDetailContent maxWidth fill>        — the DialogContent
 *     <RecordDetailFrame header rail footer>   — sticky header / body / sticky footer
 *       {main}
 *
 * `fill` (default true) pins the dialog at full height — right for large
 * records that always scroll. `fill={false}` lets the dialog hug its content
 * and only caps it, for forms and shorter popups.
 *
 * `rail` is rendered ONCE: in the right column on wide windows; on narrow ones
 * above the main content (`railFirstOnNarrow`, default) or below it.
 * `footer` stays pinned under the body — use it for Save / Cancel so the
 * primary action never scrolls out of reach.
 */
export function RecordDetailContent({ className, maxWidth = '1180px', fill = true, style, children, ...props }) {
  return (
    <DialogContent
      // Radix warns when no Description is linked; these dialogs label
      // themselves with a DialogTitle, so opt out explicitly unless a caller
      // passes its own.
      aria-describedby={undefined}
      {...props}
      className={cn(
        // Mobile bottom sheet. p-0: the frame owns all padding.
        'p-0 gap-0 flex flex-col overflow-hidden rounded-t-2xl max-h-[94dvh]',
        fill && 'h-[94dvh]',
        // Desktop: track the window. sm:p-0 removes the base sm:p-6 so the
        // header rule and the rail run flush to the dialog's edges.
        'sm:p-0 sm:w-[94vw] sm:max-h-[90vh] sm:rounded-xl',
        fill && 'sm:h-[90vh]',
        className
      )}
      // Inline style beats the base sm:max-w-lg utility, so any px/rem cap works.
      style={{ maxWidth, ...style }}
    >
      {children}
    </DialogContent>
  );
}

export function RecordDetailFrame({
  header,
  rail,
  footer,
  railFirstOnNarrow = true,
  railWidthClass = 'lg:w-[21rem] xl:w-[23rem]',
  headerClassName = '',
  mainClassName = '',
  railClassName = '',
  children,
}) {
  const isWide = useIsWide();
  const railBlock = rail ? <div className="space-y-4">{rail}</div> : null;

  return (
    <>
      {/* Sticky header. pr-14 keeps clear of the dialog's close button. */}
      {header && (
        <div className={cn('flex-shrink-0 border-b bg-white pl-4 pr-14 pt-5 pb-3 sm:pl-6 sm:pt-6 sm:pb-4', headerClassName)}>
          {header}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div
          className={cn(
            'flex-1 min-w-0 min-h-0 overflow-y-auto overscroll-contain px-4 pt-4 sm:px-6 sm:pt-5',
            // Room for the iOS home indicator when nothing is pinned below.
            footer ? 'pb-4 sm:pb-5' : 'pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-5',
            mainClassName
          )}
        >
          {!isWide && railBlock && railFirstOnNarrow && <div className="mb-5">{railBlock}</div>}
          {children}
          {!isWide && railBlock && !railFirstOnNarrow && <div className="mt-6">{railBlock}</div>}
        </div>
        {isWide && railBlock && (
          <aside className={cn('shrink-0 min-h-0 overflow-y-auto overscroll-contain border-l bg-gray-50/70 px-4 py-5', railWidthClass, railClassName)}>
            {railBlock}
          </aside>
        )}
      </div>

      {/* Sticky footer — primary actions stay in reach however long the body is. */}
      {footer && (
        <div className="flex-shrink-0 border-t bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-3">
          {footer}
        </div>
      )}
    </>
  );
}

/** Small labeled number tile for rails / stat rows. */
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
        <div className="flex items-center justify-between gap-2 mb-2">
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

/** Titled block for the main column (lighter than RailSection — no card). */
export function FrameSection({ title, icon: Icon, action, children, className = '' }) {
  return (
    <section className={cn('space-y-2.5', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-1.5">
            {Icon && <Icon className="w-3.5 h-3.5" />} {title}
          </h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Read-only label/value pair for rails and summaries. */
export function FieldRow({ label, children, className = '' }) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-[10px] uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-800 break-words">{children}</dd>
    </div>
  );
}

export default RecordDetailFrame;
