import React from 'react';
import { MoreVertical, StickyNote, ExternalLink, BookOpen, Trash2, GripVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { OwnerChip } from '@/components/shared/inline/OwnerChip';
import { FollowUpDatePill } from '@/components/shared/inline/FollowUpDatePill';
import { StageControl } from '@/components/shared/inline/StageControl';
import { InlineTagEditor } from '@/components/shared/InlineTagEditor';

export function PipelineCard({
  record,
  provided,
  snapshot,
  title,
  subtitle,
  stages,
  stageValue,
  onStageChange,
  onOwnerChange,
  onTagsChange,
  onFollowUpDateChange,
  onLogNote,
  onOpenDetail,
  onViewPlaybook,
  onDelete,
  alertBadges,
  activityStrip,
  extraActions,
  accentColor = '#264d44',
}) {
  const isDragging = snapshot?.isDragging;

  return (
    <div
      ref={provided?.innerRef}
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
      className={`group bg-white rounded-lg border p-3 shadow-sm transition-shadow select-none cursor-grab active:cursor-grabbing ${
        isDragging ? 'shadow-lg rotate-1' : 'border-gray-200 hover:shadow-md'
      }`}
      style={isDragging ? { borderColor: accentColor, borderWidth: '2px', boxShadow: `0 4px 16px ${accentColor}33` } : undefined}
      onClick={() => !isDragging && onOpenDetail?.(record)}
    >
      {/* Line 1: Title + overflow menu */}
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm leading-tight truncate" style={{ color: accentColor }}>{title}</p>
          {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
        </div>
        <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0 flex items-center gap-0.5">
          {extraActions}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="gap-2" onClick={() => onLogNote(record)}>
                <StickyNote className="w-4 h-4" /> Log Note
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => onOpenDetail(record)}>
                <ExternalLink className="w-4 h-4" /> Open Detail
              </DropdownMenuItem>
              {onViewPlaybook && (
                <DropdownMenuItem className="gap-2" onClick={() => onViewPlaybook(record)}>
                  <BookOpen className="w-4 h-4" /> View Playbook
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 text-red-600 focus:text-red-600"
                onClick={() => {
                  if (window.confirm(`Delete ${title}? This cannot be undone.`)) {
                    onDelete(record.id);
                  }
                }}
              >
                <Trash2 className="w-4 h-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Line 2: Owner + Follow-up date (or activity strip when provided) */}
      {activityStrip ? (
        <div className="space-y-1 mb-1" onClick={(e) => e.stopPropagation()}>
          {activityStrip}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 mb-1" onClick={(e) => e.stopPropagation()}>
          <OwnerChip value={record.owner} onSave={(v) => onOwnerChange(record.id, v)} />
          <FollowUpDatePill value={record.follow_up_due_date} onSave={(v) => onFollowUpDateChange(record.id, v)} />
        </div>
      )}

      {/* Line 3: Tags */}
      <div className="mb-1" onClick={(e) => e.stopPropagation()}>
        <InlineTagEditor
          value={record.tags || []}
          onChange={(tags) => onTagsChange(record.id, tags)}
        />
      </div>

      {/* Alert badges (passed from parent) */}
      {alertBadges}

      {/* Footer: Stage control */}
      <div className="mt-2 pt-2 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
        <StageControl stages={stages} value={stageValue} onSave={(newKey) => onStageChange(record.id, newKey)} />
      </div>

      {/* Drag hint — hover only */}
      {!isDragging && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5 mt-1.5 text-[10px] text-gray-300">
          <GripVertical className="w-2.5 h-2.5" /> drag to move stage
        </div>
      )}
    </div>
  );
}

export default PipelineCard;