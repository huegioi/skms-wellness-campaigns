import React, { useState, useEffect } from 'react';
import { MoreVertical, StickyNote, ExternalLink, BookOpen, Trash2, GripVertical, Linkedin, Check, Loader2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { OwnerChip } from '@/components/shared/inline/OwnerChip';
import { FollowUpDatePill } from '@/components/shared/inline/FollowUpDatePill';
import { StageControl } from '@/components/shared/inline/StageControl';
import { InlineTagEditor } from '@/components/shared/InlineTagEditor';
import { ChannelIndicators } from '@/components/shared/ChannelIndicators';
import { DemoOrInternalBadge } from '@/components/shared/DemoBadge';

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
  linkedinUrl,
  onLogLinkedinTouch,
  channelSummary,
}) {
  const isDragging = snapshot?.isDragging;

  // ── LinkedIn touch state ──
  const [liLogged, setLiLogged] = useState(false);
  const [liLogging, setLiLogging] = useState(false);
  const [showLiConfirm, setShowLiConfirm] = useState(false);
  const [showLiNote, setShowLiNote] = useState(false);
  const [liNoteText, setLiNoteText] = useState('');

  // 60-second auto-dismiss for the open-and-confirm banner
  useEffect(() => {
    if (!showLiConfirm) return;
    const t = setTimeout(() => setShowLiConfirm(false), 60000);
    return () => clearTimeout(t);
  }, [showLiConfirm]);

  const doLogLi = async (note) => {
    setLiLogging(true);
    try {
      await onLogLinkedinTouch?.(note);
      setLiLogged(true);
      setTimeout(() => setLiLogged(false), 2000);
    } finally {
      setLiLogging(false);
    }
  };

  const handleProfileClick = (e) => {
    e.stopPropagation();
    setShowLiConfirm(true);
  };

  const handleConfirmYes = (e) => {
    e.stopPropagation();
    setShowLiConfirm(false);
    doLogLi();
  };

  const handleConfirmNo = (e) => {
    e.stopPropagation();
    setShowLiConfirm(false);
  };

  const handleLiNoteSave = () => {
    setShowLiNote(false);
    doLogLi(liNoteText.trim() || undefined);
    setLiNoteText('');
  };

  return (
    <>
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
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="font-semibold text-sm leading-tight truncate" style={{ color: accentColor }}>{title}</p>
            {(record.is_demo || record.is_internal) && <DemoOrInternalBadge record={record} />}
          </div>
          {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
        </div>
        <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0 flex items-center gap-1 sm:gap-0.5">
          {extraActions}
          {onLogLinkedinTouch && (
            <button
              onClick={(e) => { e.stopPropagation(); doLogLi(); }}
              disabled={liLogging}
              className="flex items-center justify-center min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 sm:p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-[#0a66c2] transition-colors disabled:opacity-50"
              title="Log LinkedIn touch"
            >
              {liLogged ? <Check className="w-3.5 h-3.5 text-green-600" /> : liLogging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Linkedin className="w-3.5 h-3.5" />}
            </button>
          )}
          {linkedinUrl && (
            <a
              href={linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleProfileClick}
              className="flex items-center justify-center min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 sm:p-0.5 rounded hover:bg-gray-100 text-[#0a66c2] transition-colors"
              title="Open LinkedIn profile"
            >
              <Linkedin className="w-3.5 h-3.5" />
            </a>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="Card actions" className="flex items-center justify-center min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 sm:p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="gap-2" onClick={() => onLogNote(record)}>
                <StickyNote className="w-4 h-4" /> Log Note
              </DropdownMenuItem>
              {onLogLinkedinTouch && (
                <DropdownMenuItem className="gap-2" onClick={() => setShowLiNote(true)}>
                  <Linkedin className="w-4 h-4" /> LinkedIn message + note
                </DropdownMenuItem>
              )}
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

      {/* LinkedIn open-and-confirm banner (60s auto-dismiss) */}
      {showLiConfirm && (
        <div className="mb-1.5 rounded-md bg-[#0a66c2]/5 border border-[#0a66c2]/20 px-2.5 py-1.5" onClick={(e) => e.stopPropagation()}>
          <p className="text-[11px] text-gray-600 mb-1">Did you message them?</p>
          <div className="flex gap-1.5">
            <button
              onClick={handleConfirmYes}
              disabled={liLogging}
              className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#0a66c2] text-white hover:bg-[#005182] disabled:opacity-50"
            >
              {liLogging ? '...' : 'Yes, log it'}
            </button>
            <button
              onClick={handleConfirmNo}
              className="text-[11px] font-medium px-2 py-0.5 rounded text-gray-500 hover:bg-gray-100"
            >
              No
            </button>
          </div>
        </div>
      )}

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

      {/* Channel indicators */}
      {channelSummary && (
        <div className="mb-1" onClick={(e) => e.stopPropagation()}>
          <ChannelIndicators summary={channelSummary} />
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

    {/* LinkedIn message + note dialog */}
    <Dialog open={showLiNote} onOpenChange={(v) => !v && setShowLiNote(false)}>
      <DialogContent className="max-w-sm w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Linkedin className="w-4 h-4 text-[#0a66c2]" /> LinkedIn message + note
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <Textarea
            placeholder="What did you say? (optional)"
            rows={3}
            value={liNoteText}
            onChange={(e) => setLiNoteText(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <Button className="flex-1 bg-[#0a66c2] hover:bg-[#005182]" onClick={handleLiNoteSave} disabled={liLogging}>
              {liLogging ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Log Touch
            </Button>
            <Button variant="outline" onClick={() => setShowLiNote(false)}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

export default PipelineCard;