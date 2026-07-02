import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function RecentActivity({ activities = [] }) {
  if (activities.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="w-5 h-5 text-brand-navy" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.map((a) => (
            <div key={a.id} className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-brand-navy mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700">{a.message}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDistanceToNow(new Date(a.activity_date), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}