import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { FileWarning, ExternalLink } from 'lucide-react';
import { isInternalOrganizer } from '@/lib/meetingNoteAccess';

export default function MeetingNotesReviewCard() {
  const { data: inaccessible = [] } = useQuery({
    queryKey: ['meeting-notes-inaccessible'],
    queryFn: () => base44.entities.MeetingNote.filter({ access_status: 'inaccessible' }, '-captured_at', 50),
  });

  // Only surface notes whose organizer is in-house — an external organizer's
  // Meet Recordings folder isn't ours to ask for. External-organized notes still
  // surface on the profile Activity timeline (InteractionTimeline), just not here.
  const actionable = inaccessible.filter(n => isInternalOrganizer(n.organizer_email));

  if (actionable.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 mb-3">
          <FileWarning className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-amber-800">
            Unshared Meeting Notes ({actionable.length})
          </h3>
        </div>
        <p className="text-xs text-amber-700 mb-3">
          These meeting-notes docs couldn't be accessed by the connected Google account. Ask the organizer to share their Meet Recordings folder.
        </p>
        <div className="space-y-2">
          {actionable.map(note => (
            <div key={note.id} className="bg-white rounded-lg border border-amber-100 p-3 text-xs">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="font-medium text-gray-800 truncate">{note.meeting_title || 'Untitled meeting'}</p>
                <span className="text-gray-400 flex-shrink-0">
                  {note.meeting_date ? new Date(note.meeting_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                </span>
              </div>
              {note.doc_title && <p className="text-gray-500 truncate">📄 {note.doc_title}</p>}
              {note.organizer_email && (
                <p className="text-amber-600 mt-1">
                  Ask <strong>{note.organizer_email}</strong> to share their Meet Recordings folder.
                </p>
              )}
              {note.doc_url && (
                <a href={note.doc_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline mt-1 inline-flex items-center gap-0.5">
                  <ExternalLink className="w-3 h-3" /> Try opening doc
                </a>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}