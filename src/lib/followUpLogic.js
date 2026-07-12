import { AlertTriangle, Leaf, Snowflake, Mail, Phone, MessageSquare, Linkedin, Video, StickyNote } from 'lucide-react';

export const CHANNEL_ICONS = {
  email: Mail,
  call: Phone,
  text: MessageSquare,
  linkedin: Linkedin,
  meeting: Video,
  other: StickyNote,
};

export const CHANNEL_LABELS = {
  email: 'Email',
  call: 'Call',
  text: 'Text',
  linkedin: 'LinkedIn',
  meeting: 'Meeting',
  other: 'Note',
};

export function getFollowUpReason(client) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-indexed

  // April check-in: trigger in March & April if not done this year
  if ([3, 4].includes(currentMonth) && client.april_checkin_year !== currentYear) {
    return { label: 'April Check-in Due', icon: Leaf, color: 'text-green-600', bg: 'bg-green-50 border-green-200' };
  }

  // November check-in: trigger in October & November if not done this year
  if ([10, 11].includes(currentMonth) && client.november_checkin_year !== currentYear) {
    return { label: 'November Check-in Due', icon: Snowflake, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' };
  }

  // 90-day rolling window
  if (client.last_service_date) {
    const windowDays = client.follow_up_window_days || 90;
    const lastService = new Date(client.last_service_date);
    const dueDate = new Date(lastService);
    dueDate.setDate(dueDate.getDate() + windowDays);
    const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
    if (dueDate <= today) {
      return {
        label: daysOverdue === 0 ? 'Follow-up Due Today' : `${daysOverdue}d Overdue`,
        icon: AlertTriangle,
        color: daysOverdue > 14 ? 'text-red-600' : 'text-amber-600',
        bg: daysOverdue > 14 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
      };
    }
  }

  return null;
}

export function needsFollowUp(client) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  // Skip if snoozed
  if (client.follow_up_status === 'snoozed' && client.snooze_until) {
    if (new Date(client.snooze_until) > today) return false;
  }

  // April check-in
  if ([3, 4].includes(currentMonth) && client.april_checkin_year !== currentYear) return true;

  // November check-in
  if ([10, 11].includes(currentMonth) && client.november_checkin_year !== currentYear) return true;

  // Rolling window
  if (client.last_service_date) {
    const windowDays = client.follow_up_window_days || 90;
    const dueDate = new Date(client.last_service_date);
    dueDate.setDate(dueDate.getDate() + windowDays);
    if (dueDate <= today && client.follow_up_status !== 'booked') return true;
  }

  return false;
}