import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, ExternalLink, Upload, Loader2, FileText, File, BookOpen, Presentation, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';

const resourceTypeConfig = {
  handout: { label: 'Handout', color: 'bg-green-100 text-green-700', icon: FileText },
  presentation: { label: 'Presentation', color: 'bg-blue-100 text-blue-700', icon: Presentation },
  recording: { label: 'Recording', color: 'bg-red-100 text-red-700', icon: File },
  guide: { label: 'Guide', color: 'bg-purple-100 text-purple-700', icon: BookOpen },
  other: { label: 'Other', color: 'bg-gray-100 text-gray-700', icon: FolderOpen },
};

export default function ServiceResourceManager({ resources = [], onChange }) {
  const [uploading, setUploading] = useState(false);
  const [newResource, setNewResource] = useState({ title: '', resource_type: 'handout', description: '' });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!newResource.title.trim()) {
      toast.error('Please enter a title before uploading');
      return;
    }

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const resource = {
        title: newResource.title.trim(),
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
      toast.error('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeResource = (index) => {
    onChange(resources.filter((_, i) => i !== index));
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
            return (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{r.title}</p>
                  {r.description && <p className="text-xs text-gray-500 truncate">{r.description}</p>}
                  <Badge className={`text-xs mt-1 ${config.color}`}>{config.label}</Badge>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.open(r.file_url, '_blank')}>
                    <ExternalLink className="w-3 h-3" />
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
            <SelectItem value="other">📁 Other</SelectItem>
          </SelectContent>
        </Select>
        <div>
          <label className={`flex items-center gap-2 cursor-pointer justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-[#264d44] transition-colors ${!newResource.title.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {uploading ? (
              <><Loader2 className="w-4 h-4 animate-spin text-[#264d44]" /><span className="text-sm text-gray-600">Uploading...</span></>
            ) : (
              <><Upload className="w-4 h-4 text-gray-400" /><span className="text-sm text-gray-600">Click to choose file (PDF, PPT, etc.)</span></>
            )}
            <input
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading || !newResource.title.trim()}
              accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.mp4,.mov"
            />
          </label>
          {!newResource.title.trim() && (
            <p className="text-xs text-gray-400 mt-1 text-center">Enter a title above before uploading</p>
          )}
        </div>
      </div>
    </div>
  );
}