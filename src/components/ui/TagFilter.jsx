import React, { useState } from 'react';
import { Check, Filter, X } from 'lucide-react';
import { useTags } from '@/hooks/useTags';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

export default function TagFilter({ selected = [], onChange, matchAll = false, onMatchAllChange }) {
  const { tags } = useTags();
  const [open, setOpen] = useState(false);

  if (tags.length === 0) return null;

  const toggle = (name) => {
    if (selected.includes(name)) {
      onChange(selected.filter(t => t !== name));
    } else {
      onChange([...selected, name]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={selected.length > 0 ? 'default' : 'outline'}
          className={`gap-2 h-9 ${selected.length > 0 ? 'bg-[#264d44] hover:bg-[#1a3830]' : ''}`}
        >
          <Filter className="w-4 h-4" />
          Tags
          {selected.length > 0 && (
            <span className="bg-white/20 rounded-full px-1.5 py-0.5 text-xs font-bold">{selected.length}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        {selected.length > 0 && (
          <div className="flex items-center justify-between border-b pb-2 mb-2 px-1">
            <button
              className="text-xs text-gray-500 hover:text-gray-700"
              onClick={() => onMatchAllChange?.(!matchAll)}
            >
              {matchAll ? '☑ Match all (AND)' : '☐ Match all (AND)'}
            </button>
            <button
              className="text-xs text-red-500 hover:text-red-700"
              onClick={() => onChange([])}
            >
              Clear
            </button>
          </div>
        )}
        <div className="space-y-0.5 max-h-48 overflow-y-auto">
          {tags.map(tag => (
            <div
              key={tag.id}
              className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-accent text-sm"
              onClick={() => toggle(tag.name)}
            >
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
              <span className="flex-1 truncate">{tag.name}</span>
              {selected.includes(tag.name) && <Check className="w-4 h-4 shrink-0" />}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}