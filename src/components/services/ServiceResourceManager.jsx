import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, ExternalLink, Upload, Loader2, FileText, File, BookOpen, Presentation, FolderOpen, Video, Music, Link2, Pencil, Check, X, ChevronUp, ChevronDown, Eye } from 'lucide-react';
import { toast } from 'sonner';

const resourceTypeConfig = {
  handout: { label: 'Handout', color: 'bg-green-100 text-green-700', icon: FileText },
  presentation: { label: 'Presentation', color: 'bg-blue-100 text-blue-700', icon: Presentation },
  recording: { label: 'Recording', color: 'bg-red-100 text-red-700', icon: File },
  guide: { label: 'Guide', color: 'bg-purple-100 text-purple-700', icon: BookOpen },
  video: { label: 'Video', color: 'bg-indigo-100 text-indigo-700', icon: Video },
  audio: { label: 'Audio', color: 'bg-amber-100 text-amber-700', icon: Music },
  link: { label: 'Link', color: 'bg-cyan-100 text-cyan-700', icon: Link2 },
  other: { label: 'Other', color: 'bg-gray-100 text-gray-700', icon: FolderOpen },
};

const isUrlType = (type) => type === 'video' || type === 'link';

const getAccept = (type) => {
  switch (type) {
    case 'audio': return '.mp3,.wav,.m4a';
    case 'handout':
    case 'guide':
    case 'presentation': return '.pdf,.ppt,.pptx,.doc,.docx';
    case 'recording': return '.mp4,.mov,.webm';
    default: return '';
  }
};

export default function ServiceResourceManager({ resources = [], onChange }) {
  const [uploading, setUploading] = useState(false);
  const [newResource, setNewResource] = useState({ title: '', resource_type: 'handout', description: '' });
  const [urlValue, setUrlValue] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editResource, setEditResource] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  const handleUrlAdd = () => {
    if (!newResource.title.trim()) {
      toast.error('Please enter a title before adding');
      return;
    }
    if (!urlValue.trim()) {
      toast.error('Please enter a URL');
      return;
    }
    const resource = {
      title: newResource.title.trim(),
      file_url: urlValue.trim(),
      resource_type: newResource.resource_type,
      description: newResource.description.trim(),
      uploaded_date: new Date().toISOString(),
    };
    onChange([...resources, resource]);
    setNewResource({ title: '', resource_type: 'handout', description: '' });
    setUrlValue('');
    toast.success('Resource added!');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Default title to the file name (without extension) if none entered
    const title = newResource.title.trim() || file.name.replace(/\.[^/.]+$/, '');

    setUploading(true);
    setUploadError(null);

    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      const file_url = result?.file_url;
      if (!file_url) {
        throw new Error('Upload completed but no file URL was returned.');
      }
      const resource = {
        title,
        file_url,
        resource_type: newResource.resource_type,
        description: newResource.description.trim(),
        uploaded_date: new Date().toISOString(),
      };
      onChange([...resources, resource]);
      setNewResource({ title: '', resource_type: 'handout', description: '' });
      e.target.value = '';
      toast.success('Resource uploaded!');
    } catch (err) {
      console.error('File upload failed:', err);
      const msg = err?.message || 'Unknown upload error';
      setUploadError(msg);
      toast.error('Upload failed: ' + msg);
    } finally {
      setUploading(false);
    }
  };

  const removeResource = (index) => {
    onChange(resources.filter((_, i) => i !== index));
  };

  const moveResource = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= resources.length) return;
    const updated = [...resources];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onChange(updated);
  };

  const startEdit = (index) => {
    setEditingIndex(index);
    setEditResource({ ...resources[index] });
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditResource(null);
  };

  const handleEditSave = () => {
    if (!editResource.title.trim()) {
      toast.error('Title cannot be empty');
      return;
    }
    const updated = [...resources];
    updated[editingIndex] = {
      ...editResource,
      title: editResource.title.trim(),
      description: editResource.description.trim(),
    };
    onChange(updated);
    setEditingIndex(null);
    setEditResource(null);
    toast.success('Resource updated');
  };

  return (
    <div className="space-y-4">
      {/* Existing Resources */}
      {resources.length === 0 ? (
        <p className="text-sm text-gray-400 italic text-center py-4">No resources attached yet.</p>
      ) : (
        <div className="space-y-2">
          {resources.map((r, i) => {
            const config = resourceTypeConfig[r.resource_type] || resourceTypeConfig.other;
            const Icon = config.icon;
            if (editingIndex === i && editResource) {
              return (
                <div key={i} className="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
                  <Input
                    placeholder="Resource title"
                    value={editResource.title}
                    onChange={(e) => setEditResource({ ...editResource, title: e.target.value })}
                  />
                  <Input
                    placeholder="Description (optional)"
                    value={editResource.description}
                    onChange={(e) => setEditResource({ ...editResource, description: e.target.value })}
                  />
                  <Select value={editResource.resource_type} onValueChange={(v) => setEditResource({ ...editResource, resource_type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="handout">📄 Handout</SelectItem>
                      <SelectItem value="presentation">📊 Presentation</SelectItem>
                      <SelectItem value="recording">🎥 Recording</SelectItem>
                      <SelectItem value="guide">📖 Guide</SelectItem>
                      <SelectItem value="video">🎬 Video</SelectItem>
                      <SelectItem value="audio">🎵 Audio</SelectItem>
                      <SelectItem value="link">🔗 Link</SelectItem>
                      <SelectItem value="other">📁 Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={cancelEdit}>
                      <X className="w-3.5 h-3.5 mr-1" /> Cancel
                    </Button>
                    <Button size="sm" className="bg-[#264d44] hover:bg-[#1a3830] text-white" onClick={handleEditSave}>
                      <Check className="w-3.5 h-3.5 mr-1" /> Save
                    </Button>
                  </div>
                </div>
              );
            }
            return (
              <div key={i} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border">
                <div className="flex flex-col flex-shrink-0">
                  <Button size="icon" variant="ghost" className="h-5 w-5" disabled={i === 0} onClick={() => moveResource(i, -1)}>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-5 w-5" disabled={i === resources.length - 1} onClick={() => moveResource(i, 1)}>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{r.title}</p>
                  {r.description && <p className="text-xs text-gray-500 truncate">{r.description}</p>}
                  <Badge className={`text-xs mt-1 ${config.color}`}>{config.label}</Badge>
                </div>
                <div className="flex gap-1 flex-shrink-0 items-center">
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => window.open(r.file_url, '_blank')} title="Open this resource in a new tab">
                    <Eye className="w-3 h-3 mr-1" /> View
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(i)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => removeResource(i)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload New Resource */}
      <div className="border-t pt-4 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Upload New Resource</p>
        <Input
          placeholder="Resource title (e.g. Stress Workshop Handout)"
          value={newResource.title}
          onChange={(e) => setNewResource({ ...newResource, title: e.target.value })}
        />
        <Input
          placeholder="Description (optional)"
          value={newResource.description}
          onChange={(e) => setNewResource({ ...newResource, description: e.target.value })}
        />
        <Select value={newResource.resource_type} onValueChange={(v) => setNewResource({ ...newResource, resource_type: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="handout">📄 Handout</SelectItem>
            <SelectItem value="presentation">📊 Presentation</SelectItem>
            <SelectItem value="recording">🎥 Recording</SelectItem>
            <SelectItem value="guide">📖 Guide</SelectItem>
            <SelectItem value="video">🎬 Video</SelectItem>
            <SelectItem value="audio">🎵 Audio</SelectItem>
            <SelectItem value="link">🔗 Link</SelectItem>
            <SelectItem value="other">📁 Other</SelectItem>
          </SelectContent>
        </Select>
        {isUrlType(newResource.resource_type) ? (
          <div className="space-y-2">
            <Input
              type="url"
              placeholder={newResource.resource_type === 'video' ? 'https://drive.google.com/... or YouTube/Vimeo URL' : 'https://...'}
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
            />
            {newResource.resource_type === 'video' && (
              <p className="text-xs text-gray-400">Paste a Google Drive share link (set Drive sharing to &lsquo;Anyone with the link can view&rsquo;), or a YouTube/Vimeo URL.</p>
            )}
            <Button
              onClick={handleUrlAdd}
              disabled={!newResource.title.trim() || !urlValue.trim()}
              className="w-full bg-[#264d44] hover:bg-[#1a3830] text-white"
            >
              Add {newResource.resource_type === 'video' ? 'Video' : 'Link'}
            </Button>
            {!newResource.title.trim() && (
              <p className="text-xs text-gray-400 text-center">Enter a title above before adding</p>
            )}
          </div>
        ) : (
          <div>
            <div
              className="flex items-center gap-2 cursor-pointer justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-[#264d44] transition-colors"
              onClick={() => { if (!uploading) fileInputRef.current?.click(); }}
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 animate-spin text-[#264d44]" /><span className="text-sm text-gray-600">Uploading...</span></>
              ) : (
                <><Upload className="w-4 h-4 text-gray-400" /><span className="text-sm text-gray-600">Click to choose file</span></>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept={getAccept(newResource.resource_type)}
              />
            </div>
            {!newResource.title.trim() && (
              <p className="text-xs text-gray-400 mt-1 text-center">Title will default to the file name if left blank</p>
            )}
            {uploadError && (
              <p className="text-xs text-red-600 mt-1 text-center font-medium">Upload error: {uploadError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}