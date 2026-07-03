import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Star, Loader2, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';

export default function ServiceImagesManager({ images = [], onChange }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      const url = res.file_url;
      onChange([...images, { url }]);
      toast.success('Image added');
    } catch (err) {
      toast.error('Upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (index) => {
    onChange(images.filter((_, i) => i !== index));
  };

  const makePrimary = (index) => {
    if (index === 0) return;
    const arr = [...images];
    const [img] = arr.splice(index, 1);
    arr.unshift(img);
    onChange(arr);
  };

  const updateCaption = (index, caption) => {
    const arr = [...images];
    arr[index] = { ...arr[index], caption };
    onChange(arr);
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="gap-2"
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
        {uploading ? 'Uploading...' : 'Add Image'}
      </Button>

      {images.length === 0 ? (
        <p className="text-sm text-gray-400">No images yet. The first image added becomes the primary image.</p>
      ) : (
        <div className="space-y-3">
          {images.map((img, idx) => (
            <div key={idx} className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
              <div className="relative shrink-0">
                <img
                  src={img.url}
                  alt={img.caption || `Image ${idx + 1}`}
                  className="w-20 h-20 rounded-lg object-cover border"
                />
                {idx === 0 && (
                  <span className="absolute -top-1 -left-1 bg-amber-400 text-white rounded-full p-0.5">
                    <Star className="w-3 h-3 fill-white" />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <Input
                  value={img.caption || ''}
                  onChange={(e) => updateCaption(idx, e.target.value)}
                  placeholder="Caption (optional)"
                  className="text-sm"
                />
                {idx === 0 ? (
                  <p className="text-xs text-amber-600 font-medium mt-1 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-400" /> Primary image
                  </p>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => makePrimary(idx)}
                    className="mt-1 gap-1 text-xs"
                  >
                    <Star className="w-3 h-3" /> Make primary
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}