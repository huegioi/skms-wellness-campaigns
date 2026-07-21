export async function copyToClipboard(text) {
  try {
    window.focus();
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    // Fallback: hidden textarea + execCommand
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e2) {
      return false;
    }
  }
}