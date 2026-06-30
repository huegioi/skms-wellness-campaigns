import React, { useState } from 'react';
import { Check, Plus, X, Search, Settings } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTags } from '@/hooks/useTags';
import { TAG_PALETTE } from '@/lib/tag-palette';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const TagSelector = ({ value = [], onChange, onManageTags }) => {
  const { tags, tagMap } = useTags();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const normalizedSearch = search.trim().toLowerCase();
  const filteredTags = tags.filter(t =>
    t.name.toLowerCase().includes(normalizedSearch)
  );
  const showCreate = search.trim() && !tagMap[normalizedSearch];

  const handleToggle = (tagName) => {
    const next = value.includes(tagName)
      ? value.filter(v => v !== tagName)
      : [...value, tagName];
    onChange(next);
  };

  const handleRemove = (e, tagName) => {
    e.stopPropagation();
    handleToggle(tagName);
  };

  const handleCreate = async () => {
    const name = search.trim();
    if (!name) return;
    const color = TAG_PALETTE[tags.length % TAG_PALETTE.length];
    const newTag = await base44.entities.Tag.create({ name, color });
    queryClient.invalidateQueries({ queryKey: ['tags'] });
    handleToggle(newTag.name);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start gap-1 h-auto min-h-9 py-1.5 px-2 flex-wrap"
        >
          {value.length === 0 && (
            <span className="text-muted-foreground font-normal text-sm">Select tags...</span>
          )}
          {value.map(tagName => {
            const tag = tagMap[tagName.toLowerCase()];
            const color = tag?.color || '#94a3b8';
            return (
              <span
                key={tagName}
                className="rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none flex items-center gap-0.5"
                style={{ backgroundColor: `${color}15`, borderColor: color, color }}
              >
                {tagName}
                <X
                  className="w-2.5 h-2.5 cursor-pointer hover:opacity-70"
                  onClick={(e) => handleRemove(e, tagName)}
                />
              </span>
            );
          })}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="flex items-center gap-2 border-b pb-2 mb-2">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Search or create..."
            className="h-8 border-0 p-0 focus-visible:ring-0"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && showCreate) {
                e.preventDefault();
                handleCreate();
              }
            }}
          />
        </div>

        <div className="space-y-0.5 max-h-48 overflow-y-auto">
          {filteredTags.map(tag => (
            <div
              key={tag.id}
              className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-accent text-sm"
              onClick={() => handleToggle(tag.name)}
            >
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
              <span className="flex-1 truncate">{tag.name}</span>
              {value.includes(tag.name) && <Check className="w-4 h-4 shrink-0" />}
            </div>
          ))}

          {filteredTags.length === 0 && !showCreate && (
            <p className="text-xs text-muted-foreground p-2 text-center">No tags found</p>
          )}

          {showCreate && (
            <div
              className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-accent text-sm text-primary"
              onClick={handleCreate}
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Create '{search.trim()}'</span>
            </div>
          )}
        </div>

        <div className="border-t pt-2 mt-2">
          <Button
            variant="link"
            className="text-xs h-auto p-0 text-muted-foreground gap-1"
            onClick={onManageTags}
          >
            <Settings className="w-3 h-3" />
            Manage tags…
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default TagSelector;