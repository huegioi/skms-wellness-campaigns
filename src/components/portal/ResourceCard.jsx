import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Video, FileText, ExternalLink, FolderOpen, BookOpen, Presentation,
  Music, Link2, Download, Eye,
} from 'lucide-react';
import { getVideoEmbedUrl } from './videoEmbedUrl';

const resourceConfig = {
  recording: { label: 'Recording', icon: Video, color: 'bg-red-100 text-red-700 border-red-200' },
  presentation: { label: 'Presentation', icon: Presentation, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  handout: { label: 'Handout', icon: FileText, color: 'bg-green-100 text-green-700 border-green-200' },
  guide: { label: 'Guide', icon: BookOpen, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  video: { label: 'Video', icon: Video, color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  audio: { label: 'Audio', icon: Music, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  link: { label: 'Link', icon: Link2, color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  other: { label: 'Resource', icon: FolderOpen, color: 'bg-gray-100 text-gray-700 border-gray-200' },
};

const documentTypes = ['handout', 'guide', 'presentation', 'recording', 'other'];

export default function ResourceCard({ resource }) {
  const type = resource.resource_type || 'other';
  const config = resourceConfig[type] || resourceConfig.other;
  const Icon = config.icon;
  const url = resource.file_url || resource.url;
  const embedUrl = type === 'video' ? getVideoEmbedUrl(url) : null;
  const isDocument = documentTypes.includes(type);

  return (
    <div className="p-4 bg-gray-50 rounded-lg border hover:border-brand-green transition-all">
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${config.color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-800">{resource.title}</p>
          {resource.description && (
            <p className="text-xs text-gray-500 mt-0.5">{resource.description}</p>
          )}
          <Badge className={`text-xs mt-1 ${config.color}`}>{config.label}</Badge>
        </div>
      </div>

      {type === 'video' && embedUrl && (
        <div className="relative w-full mb-3" style={{ paddingBottom: '56.25%' }}>
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full rounded-lg"
            allow="autoplay; encrypted-media"
            allowFullScreen
            title={resource.title}
          />
        </div>
      )}

      {type === 'audio' && (
        <audio controls className="w-full mb-3">
          <source src={url} />
        </audio>
      )}

      <div className="flex gap-2 flex-wrap">
        {type === 'video' && (
          <Button size="sm" variant="outline" onClick={() => window.open(url, '_blank')}>
            <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open
          </Button>
        )}
        {type === 'audio' && (
          <Button size="sm" variant="outline" asChild>
            <a href={url} download>
              <Download className="w-3.5 h-3.5 mr-1" /> Download
            </a>
          </Button>
        )}
        {isDocument && (
          <>
            <Button size="sm" variant="outline" onClick={() => window.open(url, '_blank')}>
              <Eye className="w-3.5 h-3.5 mr-1" /> View
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={url} download>
                <Download className="w-3.5 h-3.5 mr-1" /> Download
              </a>
            </Button>
          </>
        )}
        {type === 'link' && (
          <Button size="sm" variant="outline" onClick={() => window.open(url, '_blank')}>
            <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open link
          </Button>
        )}
      </div>
    </div>
  );
}