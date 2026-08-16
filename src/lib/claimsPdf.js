import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Paged PDF generator for the Claims Insight report: each entry in
 * `pagesHtml` becomes its own PDF page (the report is deliberately paged —
 * the referral boundary gets a page of its own).
 *
 * Same rendering pipeline as proposalPdf.js (hidden iframe → html2canvas →
 * jsPDF), but page-by-page instead of one tall canvas, so the 16,384px
 * canvas ceiling is never a concern.
 */
export async function htmlPagesToPdfDownload(pagesHtml, filename, headHtml = '') {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = '1000px';
  iframe.style.height = '1px';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8">${headHtml}</head><body style="margin:0">`
      + pagesHtml.map((h, i) => `<div id="claims-pdf-page-${i}" style="width:1000px">${h}</div>`).join('')
      + '</body></html>');
    doc.close();

    await new Promise(resolve => setTimeout(resolve, 800));

    const pageWidth = 595; // A4 width, pt
    let pdf = null;

    for (let i = 0; i < pagesHtml.length; i++) {
      const el = doc.getElementById(`claims-pdf-page-${i}`);
      const h = el.scrollHeight;
      const canvas = await html2canvas(el, {
        scale: 2, useCORS: true, width: 1000, height: h,
        windowWidth: 1000, windowHeight: h,
      });
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      if (!pdf) {
        pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [pageWidth, imgHeight] });
      } else {
        pdf.addPage([pageWidth, imgHeight], 'portrait');
      }
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, imgHeight);
    }

    pdf.save(filename);
  } finally {
    if (iframe.parentNode) document.body.removeChild(iframe);
  }
}
