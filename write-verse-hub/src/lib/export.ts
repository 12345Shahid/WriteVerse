import jsPDF from 'jspdf';

export function exportTxt(filename: string, content: string) {
  try {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('[Export] TXT export failed', e);
    alert('Export failed. See console for details.');
  }
}

export function exportCsv(filename: string, rows: Array<Record<string, any>>) {
  try {
    const headerSet = new Set<string>();
    rows.forEach((row) => Object.keys(row).forEach((k) => headerSet.add(k)));
    const headers = Array.from(headerSet);
    const esc = (v: any) => {
      const s = String(v ?? '');
      if (s.includes('"') || s.includes(',') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const lines = [headers.join(',')].concat(
      rows.map((row) => headers.map((h) => esc(row[h])).join(','))
    );
    exportTxt(filename, lines.join('\n'));
  } catch (e) {
    console.error('[Export] CSV export failed', e);
    alert('Export failed. See console for details.');
  }
}

export function exportPdf(filename: string, title: string, blocks: Array<{ heading?: string; lines: string[] }>) {
  try {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const marginX = 48;
    let y = 56;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(title, marginX, y);
    y += 20;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    const pageHeight = doc.internal.pageSize.getHeight();

    const addLine = (text: string) => {
      const lines = doc.splitTextToSize(text, doc.internal.pageSize.getWidth() - marginX * 2);
      lines.forEach((ln: string) => {
        if (y > pageHeight - 56) {
          doc.addPage();
          y = 56;
        }
        doc.text(ln, marginX, y);
        y += 16;
      });
    };

    blocks.forEach((b, idx) => {
      if (b.heading) {
        y += idx === 0 ? 8 : 16;
        doc.setFont('helvetica', 'bold');
        doc.text(b.heading, marginX, y);
        y += 14;
        doc.setFont('helvetica', 'normal');
      }
      b.lines.forEach((line) => addLine(line));
    });

    doc.save(filename);
  } catch (e) {
    console.error('[Export] PDF export failed', e);
    alert('Export failed. See console for details.');
  }
}
