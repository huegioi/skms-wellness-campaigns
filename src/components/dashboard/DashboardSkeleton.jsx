import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Reusable skeleton loading card for dashboard sections.
 * Height matches chart height (h-64) for visual consistency.
 */
export default function DashboardSkeleton({ title, rows = 4 }) {
  return (
    <Card>
      {title && (
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
      )}
      <CardContent className="pt-0">
        <div className="h-64 flex flex-col justify-center gap-4">
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}