import React from 'react';
import { TrendingUp, FileText, PhoneMissed, Clock, Handshake, CheckCircle2 } from 'lucide-react';

/**
 * Structured sales snapshot — deals still being WON.
 * Mirrors DeliverySection's visual language. Informational only (rows are not checkable);
 * the actionable versions live in Follow-Ups as persistent MayaReminder records.
 *
 * The hard line: nothing here has an accepted proposal. The moment a proposal is accepted
 * the client moves to Delivery.
 */

const money = (n) => {
  const v = Number(n) || 0;
  if (!v) return '';
  return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

const STATUS_LABEL = {
  draft: 'never sent',
  sent: 'no reply',
  viewed: 'opened, went quiet',
};

function Row({ icon: Icon, tone = 'default', children }) {
  const toneClass = {
    default: 'text-gray-400',
    warn: 'text-amber-500',
    hot: 'text-[#770142]',
  }[tone] || 'text-gray-400';
  return (
    <div className="flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${toneClass}`} />
      <span className="text-sm text-gray-700 leading-snug">{children}</span>
    </div>
  );
}

export default function SalesSection({ snapshot }) {
  if (!snapshot) return null;

  const stalled = snapshot.stalledProposals || [];
  const meetings = snapshot.meetingsNoFollowUp || [];
  const leads = snapshot.overdueLeads || [];
  const partners = snapshot.quietPartners || [];
  const openCount = snapshot.openProposalCount || 0;
  const openValue = snapshot.openPipelineValue || 0;
  const stalledValue = snapshot.stalledValue || 0;

  const rowCount = stalled.length + meetings.length + leads.length + partners.length;

  const header = (count, extra) => (
    <div className="flex items-center gap-2 mb-2 flex-wrap">
      <TrendingUp className="w-3.5 h-3.5 text-[#770142]" />
      <h3 className="text-xs font-bold uppercase tracking-widest text-[#770142]">Sales</h3>
      <span className="rounded-full bg-gray-100 text-gray-500 text-[10px] px-1.5 py-0.5 font-medium">{count}</span>
      {extra}
    </div>
  );

  if (rowCount === 0) {
    return (
      <div className="pt-3">
        {header(0, openCount > 0 ? (
          <span className="text-[11px] text-gray-400">{openCount} open · {money(openValue)}</span>
        ) : null)}
        <div className="space-y-0.5">
          <Row icon={CheckCircle2} tone="default">
            <span className="text-gray-600">Nothing is sitting still — every open deal has moved recently.</span>
          </Row>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-3">
      {header(rowCount, (
        <span className="text-[11px] text-gray-400">
          {openCount} open · {money(openValue)}
          {stalledValue > 0 && <span className="text-[#770142] font-medium"> · {money(stalledValue)} stalled</span>}
        </span>
      ))}

      <div className="space-y-0.5">
        {stalled.map((p, i) => (
          <Row key={`p${i}`} icon={FileText} tone="hot">
            <strong className="font-semibold">{p.client}</strong>
            {p.amount > 0 && <span className="text-gray-500"> {money(p.amount)}</span>}
            {' — proposal '}
            {STATUS_LABEL[p.status] || p.status}
            {', idle '}
            <strong className="font-semibold">{p.idleDays} days</strong>
          </Row>
        ))}

        {meetings.map((m, i) => (
          <Row key={`m${i}`} icon={PhoneMissed} tone="warn">
            <strong className="font-semibold">{m.client || m.title}</strong>
            {' — met '}{m.daysAgo} days ago, nothing logged since
          </Row>
        ))}

        {leads.map((l, i) => (
          <Row key={`l${i}`} icon={Clock} tone="warn">
            <strong className="font-semibold">{l.who}</strong>
            {' — follow-up '}
            <strong className="font-semibold">{l.overdueDays}d overdue</strong>
            {l.status ? <span className="text-gray-500"> ({String(l.status).replace(/_/g, ' ')})</span> : null}
          </Row>
        ))}

        {partners.map((p, i) => (
          <Row key={`rp${i}`} icon={Handshake} tone="default">
            <strong className="font-semibold">{p.who}</strong>
            {' — '}{p.count} referral{p.count === 1 ? '' : 's'}
            {p.quietDays === null ? ', no date on the last one' : `, last ${p.quietDays} days ago`}
          </Row>
        ))}
      </div>
    </div>
  );
}
