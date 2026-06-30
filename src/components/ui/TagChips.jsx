import React from 'react';
import { useTags } from '@/hooks/useTags';
import { cn } from '@/lib/utils';

export const TagChips = ({ tags = [], size = 'sm' }) => {
  const { tagMap } = useTags();

  if (!tags || tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tagName) => {
        const tag = tagMap[tagName.toLowerCase()];
        const color = tag?.color || '#94a3b8';

        return (
          <span
            key={tagName}
            className={cn(
              "rounded-full border font-medium leading-none",
              size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'
            )}
            style={{
              backgroundColor: `${color}15`,
              borderColor: color,
              color: color,
            }}
          >
            {tagName}
          </span>
        );
      })}
    </div>
  );
};

export default TagChips;