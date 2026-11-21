'use client';
import { SakugaButton } from './SakugaButton';

import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, LoaderCircle, X } from 'lucide-react';
import { FinanceKind, FinanceTransaction, loadTransactionsForExport } from './financeService';

type Period = 'all' | 'current' | 'previous' | 'custom';
type TypeFilter = 'all' | FinanceKind;
type ExportFormat = 'xlsx' | 'csv' | 'pdf';
type ExportRow = {
  date: string;
  description: string;
  category: string;
  type: string;
  paymentMethod: string;
  amount: number;
  notes: string;
};

function pad(value: number) { return String(value).padStart(2, '0'); }
function monthBounds(shift: number) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit',
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const first = new Date(Date.UTC(year, month - 1 + shift, 1));
  const y = first.getUTCFullYear();
  const m = first.getUTCMonth() + 1;
  const end = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(end)}` };
}

function selectedRange(period: Period, customFrom: string, customTo: string) {
  if (period === 'all') return { from: undefined, to: undefined, label: 'All transactions' };
  if (period === 'current' || period === 'previous') {
    const bounds = monthBounds(period === 'current' ? 0 : -1);
    const date = new Date(`${bounds.from}T12:00:00Z`);
    const label = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
    return { ...bounds, label };
  }
  return {
    from: customFrom,
    to: customTo,
    label: `${customFrom} to ${customTo}`,
  };
}

function buildRows(transactions: FinanceTransaction[]): ExportRow[] {
  return transactions.map((transaction) => ({
    date: transaction.transaction_date,
    description: transaction.description || transaction.category?.name || 'Transaction',
    category: transaction.category?.name || 'Other',
    type: transaction.kind === 'income' ? 'Income' : 'Expense',
    paymentMethod: transaction.payment_method?.name || 'Other',
    amount: Number(transaction.amount),
    notes: transaction.notes ?? '',
  }));
}

function buildSummary(rows: ExportRow[]) {
  const totalIncome = rows.filter((row) => row.type === 'Income').reduce((total, row) => total + row.amount, 0);
  const totalExpenses = rows.filter((row) => row.type === 'Expense').reduce((total, row) => total + row.amount, 0);
  const categories = new Map<string, number>();
  rows.filter((row) => row.type === 'Expense').forEach((row) => {
    categories.set(row.category, (categories.get(row.category) ?? 0) + row.amount);
  });
  return {
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
    transactionCount: rows.length,
    categories: [...categories].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
  };
}

function safeFilename(label: string, format: ExportFormat) {
  const period = label === 'All transactions'
    ? 'All_Transactions'
    : label.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `Moneta_Expenses_${period || 'Report'}.${format}`;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give browsers with a Save As dialog time to consume the object URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function csvCell(value: string | number) {
  let text = String(value ?? '');
  if (typeof value === 'string' && /^[\s]*[=+@\-\t\r]/.test(value)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv(rows: ExportRow[], summary: ReturnType<typeof buildSummary>, label: string, filename: string) {
  const lines: string[] = [
    [csvCell('Moneta Expense Report')].join(','),
    [csvCell('Reporting period'), csvCell(label)].join(','),
    '',
    [csvCell('Financial Summary')].join(','),
    [csvCell('Metric'), csvCell('Value (INR)')].join(','),
    [csvCell('Total income'), csvCell(summary.totalIncome.toFixed(2))].join(','),
    [csvCell('Total expenses'), csvCell(summary.totalExpenses.toFixed(2))].join(','),
    [csvCell('Net balance'), csvCell(summary.balance.toFixed(2))].join(','),
    [csvCell('Number of transactions'), csvCell(summary.transactionCount)].join(','),
    '',
    [csvCell('Category-wise expense breakdown')].join(','),
    [csvCell('Category'), csvCell('Expenses (INR)')].join(','),
    ...summary.categories.map((item) => [csvCell(item.category), csvCell(item.amount.toFixed(2))].join(',')),
    '',
    ['Date', 'Description', 'Category', 'Type', 'Payment method', 'Amount (INR)', 'Notes'].map(csvCell).join(','),
    ...rows.map((row) => [
      row.date, row.description, row.category, row.type, row.paymentMethod, row.amount.toFixed(2), row.notes,
    ].map(csvCell).join(',')),
  ];
  download(new Blob(['\uFEFF', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), filename);
}

async function exportXlsx(rows: ExportRow[], summary: ReturnType<typeof buildSummary>, label: string, filename: string) {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Moneta';
  workbook.subject = 'Personal finance export';
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.columns = [{ width: 34 }, { width: 28 }, { width: 22 }];
  summarySheet.mergeCells('A1:C1');
  summarySheet.getCell('A1').value = 'MONETA  /  FINANCIAL REPORT';
  summarySheet.getCell('A1').font = { name: 'Space Grotesk', size: 18, bold: true, color: { argb: 'FF1A1A1A' } };
  summarySheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC00' } };
  summarySheet.getRow(1).height = 34;
  summarySheet.addRow(['Reporting period', label]);
  summarySheet.addRow([]);
  const summaryHeader = summarySheet.addRow(['Financial summary', 'Amount (INR)']);
  summaryHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  summaryHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A1A' } };
  summarySheet.addRows([
    ['Total income', summary.totalIncome],
    ['Total expenses', summary.totalExpenses],
    ['Net balance', summary.balance],
    ['Number of transactions', summary.transactionCount],
  ]);
  for (const rowNumber of [5, 6, 7]) summarySheet.getCell(`B${rowNumber}`).numFmt = '"₹" #,##0.00;[Red]("₹" #,##0.00)';
  summarySheet.getCell('B8').numFmt = '0';
  summarySheet.addRow([]);
  const categoryHeader = summarySheet.addRow(['Category-wise expense breakdown', 'Expenses (INR)']);
  categoryHeader.font = { bold: true, color: { argb: 'FF1A1A1A' } };
  categoryHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCC00' } };
  for (const item of summary.categories) {
    const row = summarySheet.addRow([item.category, item.amount]);
    row.getCell(2).numFmt = '"₹" #,##0.00;[Red]("₹" #,##0.00)';
  }

  const transactionSheet = workbook.addWorksheet('Transactions', { views: [{ state: 'frozen', ySplit: 1 }] });
  transactionSheet.columns = [
    { header: 'Date', key: 'date', width: 16 },
    { header: 'Description', key: 'description', width: 34 },
    { header: 'Category', key: 'category', width: 22 },
    { header: 'Type', key: 'type', width: 14 },
    { header: 'Payment method', key: 'paymentMethod', width: 22 },
    { header: 'Amount (INR)', key: 'amount', width: 18 },
    { header: 'Notes', key: 'notes', width: 42 },
  ];
  transactionSheet.autoFilter = { from: 'A1', to: 'G1' };
  transactionSheet.getRow(1).height = 28;
  transactionSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  transactionSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A1A' } };
  transactionSheet.addRows(rows.map((row) => ({
    ...row,
    date: new Date(`${row.date}T12:00:00Z`),
  })));
  transactionSheet.getColumn('date').numFmt = 'dd mmm yyyy';
  transactionSheet.getColumn('amount').numFmt = '"₹" #,##0.00;[Red]("₹" #,##0.00)';
  transactionSheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) row.border = { bottom: { style: 'hair', color: { argb: 'FFD6D1C7' } } };
  });
  const buffer = await workbook.xlsx.writeBuffer();
  download(new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

async function exportPdf(rows: ExportRow[], summary: ReturnType<typeof buildSummary>, label: string, filename: string) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFillColor(255, 204, 0);
  doc.rect(0, 0, 297, 7, 'F');
  doc.setTextColor(26, 26, 26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  doc.text('MONETA', 14, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('PERSONAL FINANCE  /  EXPENSE REPORT', 14, 28);
  doc.setFontSize(9);
  doc.text(`Reporting period: ${label}`, 14, 35);

  const metrics = [
    ['TOTAL INCOME', summary.totalIncome],
    ['TOTAL EXPENSES', summary.totalExpenses],
    ['NET BALANCE', summary.balance],
    ['TRANSACTIONS', summary.transactionCount],
  ];
  metrics.forEach(([title, value], index) => {
    const x = 14 + index * 68;
    doc.setDrawColor(26, 26, 26);
    doc.setLineWidth(0.65);
    doc.setFillColor(248, 245, 237);
    doc.rect(x, 41, 62, 19, 'FD');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(String(title), x + 3, 47);
    doc.setFontSize(10);
    doc.text(index === 3 ? String(value) : `INR ${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, x + 3, 55);
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('CATEGORY-WISE EXPENSE BREAKDOWN', 14, 68);
  autoTable(doc, {
    startY: 72,
    head: [['Category', 'Expenses (INR)']],
    body: summary.categories.length
      ? summary.categories.map((item) => [item.category, `INR ${item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`])
      : [['No expense records', 'INR 0.00']],
    theme: 'grid',
    margin: { left: 14, right: 14, bottom: 18 },
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5, textColor: [26, 26, 26], lineColor: [26, 26, 26] },
    headStyles: { fillColor: [255, 204, 0], textColor: [26, 26, 26], fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' } },
  });

  const lastTable = (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable;
  const transactionStart = Math.min((lastTable?.finalY ?? 90) + 8, 175);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TRANSACTIONS', 14, transactionStart);
  autoTable(doc, {
    startY: transactionStart + 4,
    head: [['Date', 'Description', 'Category', 'Type', 'Payment method', 'Amount (INR)', 'Notes']],
    body: rows.map((row) => [
      row.date, row.description, row.category, row.type, row.paymentMethod,
      `INR ${row.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, row.notes,
    ]),
    theme: 'grid',
    margin: { left: 14, right: 14, bottom: 18 },
    showHead: 'everyPage',
    styles: { font: 'helvetica', fontSize: 7, cellPadding: 2, overflow: 'linebreak', textColor: [26, 26, 26], lineColor: [190, 185, 175] },
    headStyles: { fillColor: [26, 26, 26], textColor: [255, 204, 0], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 23 }, 1: { cellWidth: 54 }, 2: { cellWidth: 32 }, 3: { cellWidth: 20 }, 4: { cellWidth: 37 }, 5: { cellWidth: 32 } },
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text('Moneta  /  Generated from your finance records', 14, 204);
    doc.text(`Page ${page} of ${pages}`, 283, 204, { align: 'right' });
  }
  download(doc.output('blob'), filename);
}

export function ExportExpensesDialog({ userId, notesAvailable, onClose }: { userId: string; notesAvailable: boolean; onClose: () => void }) {
  const [period, setPeriod] = useState<Period>('current');
  const current = monthBounds(0);
  const [customFrom, setCustomFrom] = useState(current.from);
  const [customTo, setCustomTo] = useState(current.to);
  const [kind, setKind] = useState<TypeFilter>('all');
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const runExport = async () => {
    setError('');
    setMessage('');
    const range = selectedRange(period, customFrom, customTo);
    if (period === 'custom' && (!range.from || !range.to || range.from > range.to)) {
      setError('Choose a valid start and end date.');
      return;
    }
    setBusy(true);
    try {
      const transactions = await loadTransactionsForExport(userId, {
        from: range.from,
        to: range.to,
        kind: kind === 'all' ? undefined : kind,
      });
      const rows = buildRows(transactions);
      const summary = buildSummary(rows);
      const filename = safeFilename(range.label, format);
      if (format === 'csv') exportCsv(rows, summary, range.label, filename);
      else if (format === 'xlsx') await exportXlsx(rows, summary, range.label, filename);
      else await exportPdf(rows, summary, range.label, filename);
      setMessage(rows.length
        ? `Download started: ${filename} with ${rows.length.toLocaleString()} Supabase transactions. Your browser may ask where to save it.`
        : `Empty report download started for ${range.label}; no matching Supabase transactions were found.`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Could not generate the export.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ft-modal-scrim ft-export-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="ft-modal ft-export-modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <div className="ft-modal-head">
          <div><span className="ft-eyebrow">DOWNLOAD REPORT</span><h2 id="export-title">Export expenses</h2></div>
          <button type="button" className="ft-icon-button" aria-label="Close" onClick={onClose} disabled={busy}><X size={19}/></button>
        </div>
        <p className="ft-export-intro">Build a report from your actual Moneta records. Totals and category breakdowns use only the selected date and type filters.</p>
        <div className="ft-export-grid">
          <label className="ft-field">
            <span>REPORTING PERIOD</span>
            <select value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
              <option value="all">All transactions</option>
              <option value="current">Current month</option>
              <option value="previous">Previous month</option>
              <option value="custom">Custom date range</option>
            </select>
          </label>
          {period === 'custom' && (
            <>
              <label className="ft-field"><span>FROM DATE</span><input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)}/></label>
              <label className="ft-field"><span>TO DATE</span><input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)}/></label>
            </>
          )}
          <fieldset className="ft-export-type">
            <legend>TRANSACTION TYPE</legend>
            {([
              ['all', 'All transactions'],
              ['expense', 'Expenses only'],
              ['income', 'Income only'],
            ] as const).map(([value, label]) => (
              <label key={value}><input type="radio" name="export-kind" checked={kind === value} onChange={() => setKind(value)}/><span>{label}</span></label>
            ))}
          </fieldset>
        </div>
        <div className="ft-export-formats" role="group" aria-label="Export format">
          {([
            ['xlsx', 'Excel', FileSpreadsheet, 'XLSX'],
            ['csv', 'CSV', FileText, 'CSV'],
            ['pdf', 'PDF', FileText, 'PDF'],
          ] as const).map(([value, label, Icon, extension]) => (
            <button key={value} type="button" className={format === value ? 'selected' : ''} aria-pressed={format === value} onClick={() => setFormat(value)}>
              <Icon size={17}/><span>{label}</span><small>.{extension.toLowerCase()}</small>
            </button>
          ))}
        </div>
        <p className="ft-export-notes">Columns include Date, Description, Category, Type, Payment method, Amount (INR) and Notes. {notesAvailable ? 'Older transactions have blank notes unless you add one.' : 'The notes migration is pending, so Notes cells will be blank until it is applied.'}</p>
        {error && <div className="ft-form-error" role="alert">{error}</div>}
        {message && <p className="ft-export-feedback" role="status">{message}</p>}
        <div className="ft-modal-actions">
          <SakugaButton type="button" className="ft-button ft-secondary" onClick={onClose} disabled={busy}>Cancel</SakugaButton>
          <SakugaButton type="button" className="ft-button ft-primary" onClick={() => void runExport()} disabled={busy}>
            {busy ? <><LoaderCircle size={16} className="ft-spin"/> Preparing export…</> : <><Download size={16}/> Export {format.toUpperCase()}</>}
          </SakugaButton>
        </div>
      </section>
    </div>
  );
}
