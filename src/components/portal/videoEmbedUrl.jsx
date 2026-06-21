/**
 * Converts a hosted video share URL into an embeddable iframe URL.
 * Supports Google Drive, YouTube, and Vimeo.
 * Returns null if the URL doesn't match a known pattern.
 */
export function getVideoEmbedUrl(url) {
  if (!url) return null;

  // Google Drive: /file/d/FILE_ID/view?usp=sharing
  let match = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/);
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;

  // Google Drive: /open?id=FILE_ID
  if (url.includes('drive.google.com')) {
    match = url.match(/[?&]id=([^&]+)/);
    if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
  }

  // YouTube: youtube.com/watch?v=VIDEO_ID
  match = url.match(/youtube\.com\/watch\?v=([^&?]+)/);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;

  // YouTube: youtu.be/VIDEO_ID
  match = url.match(/youtu\.be\/([^&?]+)/);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;

  // Vimeo: vimeo.com/VIDEO_ID
  match = url.match(/vimeo\.com\/(\d+)/);
  if (match) return `https://player.vimeo.com/video/${match[1]}`;

  return null;
}