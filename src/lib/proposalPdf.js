import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Shared PDF generator: hidden iframe → html2canvas → single tall jsPDF page.
// Used by both EditProposal.jsx and Proposals.jsx so every download path
// produces a real PDF with the same rendering pipeline.
export async function htmlToPdfDownload(html, filename) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = '1000px';
  iframe.style.height = '1px';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    await new Promise(resolve => setTimeout(resolve, 800));

    const body = iframeDoc.body;
    const fullHeight = body.scrollHeight;
    iframe.style.height = fullHeight + 'px';

    const canvas = await html2canvas(body, {
      scale: 2,
      useCORS: true,
      width: 1000,
      height: fullHeight,
      windowWidth: 1000,
      windowHeight: fullHeight
    });

    // Use a single tall page sized to fit all content — avoids any mid-element cuts
    const pageWidth = 595; // A4 width in pt
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * pageWidth) / canvas.width;

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [pageWidth, imgHeight] });
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

    pdf.save(filename);
  } finally {
    if (iframe.parentNode) document.body.removeChild(iframe);
  }
}

// Filename: company name + download date.
// Strips characters that break filenames on some systems (commas, periods,
// slashes in names like "OSG Ship Management, Inc.").
export function proposalFilename(proposal) {
  const name = (proposal.company || proposal.client_name || 'Proposal').trim();
  const safe = name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 60);
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `Proposal-${safe}-${stamp}.pdf`;
}