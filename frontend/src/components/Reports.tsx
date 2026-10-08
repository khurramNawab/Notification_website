import React, { useEffect, useState } from 'react';
import { request } from '../utils/api';

interface RowPreview {
  rowNum: number;
  data: {
    company_name: string;
    client_name: string;
    phone_number: string;
    date: string;
    service_type: string;
    client_or_consultant: string;
    quotation_amount: number;
    govt_fees: number;
    prof_fees: number;
    advance_amount: number;
    payment_received: number;
    remark: string;
  };
  isValid: boolean;
  errors: string[];
}

interface MonthlyReportData {
  month: string;
  current_month: string;
  kpis: {
    total_entries: number;
    total_quotation: number;
    total_govt_fees: number;
    total_prof_fees: number;
    total_advance: number;
    total_payment_received: number;
    total_pending: number;
    complete_count: number;
    partial_count: number;
    pending_count: number;
    overdue_count: number;
  };
  transactions: Array<{
    id: number;
    client_id: number;
    date: string;
    service_type: string;
    client_or_consultant: 'client' | 'consultant';
    quotation_amount: number;
    govt_fees: number;
    prof_fees: number;
    advance_amount: number;
    payment_received: number;
    pending_amount: number;
    status: 'complete' | 'partial' | 'pending' | 'overdue';
    remark: string;
    company_name: string;
    client_name: string;
    phone_number: string;
  }>;
  available_months: string[];
}

export const Reports: React.FC = () => {
  // Tabs: 'monthly' | 'import'
  const [activeTab, setActiveTab] = useState<'monthly' | 'import'>('monthly');

  // Helper to get current 'YYYY-MM' dynamically based on today's date
  const getCurrentMonthKey = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  };

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey());
  const [reportData, setReportData] = useState<MonthlyReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Import State
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<RowPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Format YYYY-MM to Human Readable (e.g. 'October 2026')
  const formatMonthName = (monthKey: string) => {
    if (!monthKey || !monthKey.includes('-')) return monthKey;
    const [year, month] = monthKey.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  // Fetch Monthly Report from Backend
  const fetchMonthlyReport = async (monthKey: string) => {
    try {
      setReportLoading(true);
      setError(null);
      const res = await request(`/api/transactions/monthly-report?month=${monthKey}`);
      setReportData(res);
    } catch (err: any) {
      console.error('Error fetching monthly report:', err);
      setError(err.message || 'Failed to load monthly report');
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlyReport(selectedMonth);
  }, [selectedMonth]);

  // Navigate between months
  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const yyyy = prevDate.getFullYear();
    const mm = String(prevDate.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${yyyy}-${mm}`);
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(year, month, 1);
    const yyyy = nextDate.getFullYear();
    const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${yyyy}-${mm}`);
  };

  // Export Excel for current selected month
  const handleExportMonthExcel = async () => {
    try {
      const blob = await request(`/api/transactions/export?month=${selectedMonth}`);
      const url = window.URL.createObjectURL(blob as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `PayTrack_Monthly_Report_${selectedMonth}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to export monthly report: ' + err.message);
    }
  };

  // Export Full All-Time Ledger
  const handleExportAllExcel = async () => {
    try {
      const blob = await request('/api/transactions/export');
      const url = window.URL.createObjectURL(blob as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'PayTrack_CRM_Ledger_All.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to export ledger: ' + err.message);
    }
  };

  // Import handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreviewRows([]);
      setError(null);
    }
  };

  const handleUploadPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await request('/api/transactions/import-preview', {
        method: 'POST',
        body: formData
      });
      setPreviewRows(res.rows);
    } catch (err: any) {
      setError(err.message || 'Failed to upload and parse file');
    } finally {
      setLoading(false);
    }
  };

  const handleCommitImport = async () => {
    const validRows = previewRows.filter((r) => r.isValid);
    if (validRows.length === 0) return;

    setImporting(true);
    setError(null);
    try {
      await request('/api/transactions/import-commit', {
        method: 'POST',
        body: JSON.stringify({ rows: validRows })
      });
      alert(`Successfully imported ${validRows.length} client engagements!`);
      setPreviewRows([]);
      setFile(null);
      fetchMonthlyReport(selectedMonth);
    } catch (err: any) {
      setError(err.message || 'Failed to commit imported records');
    } finally {
      setImporting(false);
    }
  };

  const totalValid = previewRows.filter((r) => r.isValid).length;
  const totalInvalid = previewRows.length - totalValid;

  // Filter month transactions
  const filteredTxs = (reportData?.transactions || []).filter((tx) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      tx.company_name?.toLowerCase().includes(term) ||
      tx.client_name?.toLowerCase().includes(term) ||
      tx.service_type?.toLowerCase().includes(term) ||
      tx.phone_number?.includes(term) ||
      tx.date?.includes(term)
    );
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 flex flex-col">
      <div className="max-w-7xl mx-auto w-full space-y-6 flex-1 flex flex-col">
        
        {/* Header with Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-on-background">Reports &amp; Data Tools</h1>
            <p className="text-xs md:text-sm text-on-surface-variant mt-0.5">
              Monthly breakdown, automated Excel export, and bulk historical tools.
            </p>
          </div>

          <div className="flex bg-white p-1 rounded-xl border border-outline-variant/40 shadow-xs self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('monthly')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'monthly'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-sm">calendar_month</span>
              <span>Monthly Report</span>
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'import'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-sm">upload_file</span>
              <span>Bulk Import &amp; Tools</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3.5 bg-error-container text-on-error-container border border-error/25 rounded-xl text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">warning</span>
            <span>{error}</span>
          </div>
        )}

        {/* TAB 1: MONTHLY REPORT */}
        {activeTab === 'monthly' && (
          <div className="space-y-6 flex-1 flex flex-col">
            
            {/* Month Selector Bar */}
            <div className="bg-white p-4 rounded-xl border border-outline-variant/30 shadow-xs flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
              
              {/* Month Navigation */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevMonth}
                  className="p-2 rounded-lg border border-outline-variant/40 hover:bg-slate-50 text-on-surface-variant transition-colors flex items-center justify-center"
                  title="Previous Month"
                >
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-white border border-outline-variant/50 text-on-surface text-xs font-bold py-2 px-3.5 rounded-lg focus:ring-1 focus:ring-primary focus:outline-none transition-all shadow-xs"
                  >
                    {reportData?.available_months?.map((m) => (
                      <option key={m} value={m}>
                        {formatMonthName(m)} {m === getCurrentMonthKey() ? '(Current)' : ''}
                      </option>
                    ))}
                    {/* If selectedMonth not in available list */}
                    {reportData?.available_months && !reportData.available_months.includes(selectedMonth) && (
                      <option value={selectedMonth}>
                        {formatMonthName(selectedMonth)}
                      </option>
                    )}
                  </select>

                  {selectedMonth !== getCurrentMonthKey() && (
                    <button
                      onClick={() => setSelectedMonth(getCurrentMonthKey())}
                      className="px-2.5 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 text-[11px] font-bold transition-colors"
                    >
                      Jump to Current Month
                    </button>
                  )}
                </div>

                <button
                  onClick={handleNextMonth}
                  className="p-2 rounded-lg border border-outline-variant/40 hover:bg-slate-50 text-on-surface-variant transition-colors flex items-center justify-center"
                  title="Next Month"
                >
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 sm:w-64">
                  <span className="material-symbols-outlined absolute left-3 top-2 text-on-surface-variant text-sm">search</span>
                  <input
                    type="text"
                    placeholder="Search in this month..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 border border-outline-variant/40 rounded-lg pl-8 pr-3 py-1.5 text-xs text-on-surface focus:bg-white focus:outline-none focus:border-primary transition-all"
                  />
                </div>

                <button
                  onClick={handleExportMonthExcel}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  <span>Export {formatMonthName(selectedMonth)} (.xlsx)</span>
                </button>
              </div>
            </div>

            {/* Monthly KPI Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4">
              {/* Card 1: Total Quotation */}
              <div className="bg-white p-3.5 rounded-xl border border-outline-variant/30 shadow-xs">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                  Total Quotation
                </span>
                <div className="text-lg font-bold text-on-surface font-mono">
                  ₹{(reportData?.kpis.total_quotation || 0).toLocaleString()}
                </div>
                <span className="text-[10px] text-on-surface-variant font-medium mt-0.5 block">
                  Billed in {formatMonthName(selectedMonth).split(' ')[0]}
                </span>
              </div>

              {/* Card 2: Professional Fees */}
              <div className="bg-white p-3.5 rounded-xl border border-outline-variant/30 shadow-xs">
                <span className="text-[10px] font-bold text-violet-700 uppercase tracking-wider block mb-1">
                  Prof. Fees
                </span>
                <div className="text-lg font-bold text-violet-800 font-mono">
                  ₹{(reportData?.kpis.total_prof_fees || 0).toLocaleString()}
                </div>
                <span className="text-[10px] text-violet-600 font-medium mt-0.5 block">
                  Consultancy fees
                </span>
              </div>

              {/* Card 3: Govt Fees */}
              <div className="bg-white p-3.5 rounded-xl border border-outline-variant/30 shadow-xs">
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block mb-1">
                  Govt. Fees
                </span>
                <div className="text-lg font-bold text-blue-800 font-mono">
                  ₹{(reportData?.kpis.total_govt_fees || 0).toLocaleString()}
                </div>
                <span className="text-[10px] text-blue-600 font-medium mt-0.5 block">
                  Official charges
                </span>
              </div>

              {/* Card 4: Advance Collected */}
              <div className="bg-white p-3.5 rounded-xl border border-outline-variant/30 shadow-xs">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">
                  Advance Collected
                </span>
                <div className="text-lg font-bold text-emerald-800 font-mono">
                  ₹{(reportData?.kpis.total_advance || 0).toLocaleString()}
                </div>
                <span className="text-[10px] text-emerald-600 font-medium mt-0.5 block">
                  Upfront cash
                </span>
              </div>

              {/* Card 5: Pending Balance */}
              <div className="bg-white p-3.5 rounded-xl border border-outline-variant/30 shadow-xs">
                <span className="text-[10px] font-bold text-error uppercase tracking-wider block mb-1">
                  Outstanding
                </span>
                <div className="text-lg font-bold text-error font-mono">
                  ₹{(reportData?.kpis.total_pending || 0).toLocaleString()}
                </div>
                <span className="text-[10px] text-error/80 font-medium mt-0.5 block">
                  Pending balance
                </span>
              </div>

              {/* Card 6: Total Engagements */}
              <div className="bg-white p-3.5 rounded-xl border border-outline-variant/30 shadow-xs">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-1">
                  Engagements
                </span>
                <div className="text-lg font-bold text-on-surface font-mono">
                  {reportData?.kpis.total_entries || 0}
                </div>
                <div className="flex gap-1 mt-0.5">
                  <span className="text-[9px] px-1 py-0.2 bg-emerald-100 text-emerald-800 font-bold rounded">
                    {reportData?.kpis.complete_count || 0} Paid
                  </span>
                  <span className="text-[9px] px-1 py-0.2 bg-amber-100 text-amber-800 font-bold rounded">
                    {(reportData?.kpis.pending_count || 0) + (reportData?.kpis.partial_count || 0)} Pending
                  </span>
                </div>
              </div>
            </div>

            {/* Monthly Report Data Table */}
            <div className="bg-white rounded-xl border border-outline-variant/30 shadow-xs overflow-hidden flex flex-col flex-1">
              <div className="p-3.5 bg-slate-50 border-b border-outline-variant/30 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">table_chart</span>
                  <h3 className="text-xs font-bold text-on-surface">
                    {formatMonthName(selectedMonth)} Detailed Billing Ledger
                  </h3>
                  <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {filteredTxs.length} records
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto flex-1 font-sans">
                {reportLoading ? (
                  <div className="p-12 text-center">
                    <span className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full inline-block mb-2"></span>
                    <p className="text-xs text-on-surface-variant">Loading {formatMonthName(selectedMonth)} report...</p>
                  </div>
                ) : filteredTxs.length === 0 ? (
                  <div className="p-12 text-center space-y-2">
                    <span className="material-symbols-outlined text-4xl text-outline-variant">folder_open</span>
                    <h4 className="text-sm font-bold text-on-surface">No entries for {formatMonthName(selectedMonth)}</h4>
                    <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                      There are no client service engagements logged for this month yet. Entries created on {selectedMonth} dates will automatically appear here.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse min-w-[1050px] text-xs">
                    <thead>
                      <tr className="bg-slate-100/60 border-b border-outline-variant/30 font-semibold text-on-surface-variant">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Company Name</th>
                        <th className="py-2.5 px-3">Contact</th>
                        <th className="py-2.5 px-3">Service</th>
                        <th className="py-2.5 px-3">Tag</th>
                        <th className="py-2.5 px-3 text-right">Quotation (₹)</th>
                        <th className="py-2.5 px-3 text-right">Govt Fees (₹)</th>
                        <th className="py-2.5 px-3 text-right">Prof Fees (₹)</th>
                        <th className="py-2.5 px-3 text-right">Advance (₹)</th>
                        <th className="py-2.5 px-3 text-right">Pending (₹)</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3">Remark</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-on-surface">
                      {filteredTxs.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-on-surface-variant">{tx.date}</td>
                          <td className="py-2.5 px-3 font-bold text-on-surface">{tx.company_name}</td>
                          <td className="py-2.5 px-3 text-on-surface-variant">
                            <div>{tx.client_name}</div>
                            {tx.phone_number && <div className="text-[10px] text-slate-400 font-mono">{tx.phone_number}</div>}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] text-on-surface-variant border border-outline-variant/30 font-semibold uppercase">
                              {tx.service_type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-on-surface-variant capitalize">{tx.client_or_consultant}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-on-surface">
                            {tx.quotation_amount.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-on-surface-variant">
                            {tx.govt_fees.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-violet-700 font-semibold">
                            {tx.prof_fees.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-700 font-semibold">
                            {tx.advance_amount.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-error">
                            {tx.pending_amount.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${
                              tx.status === 'complete' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                              tx.status === 'partial' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                              tx.status === 'overdue' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                              'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {tx.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-on-surface-variant text-[11px] max-w-xs truncate" title={tx.remark}>
                            {tx.remark || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {/* Summary Footer */}
                    <tfoot>
                      <tr className="bg-slate-100 border-t-2 border-outline-variant/50 font-bold text-on-surface">
                        <td colSpan={5} className="py-3 px-3 text-right font-bold text-xs uppercase tracking-wider text-on-surface-variant">
                          Monthly Summary Total:
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-xs">
                          ₹{(reportData?.kpis.total_quotation || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-xs text-blue-800">
                          ₹{(reportData?.kpis.total_govt_fees || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-xs text-violet-800">
                          ₹{(reportData?.kpis.total_prof_fees || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-xs text-emerald-800">
                          ₹{(reportData?.kpis.total_advance || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-xs text-error">
                          ₹{(reportData?.kpis.total_pending || 0).toLocaleString()}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: BULK IMPORT & FULL LEDGER TOOLS */}
        {activeTab === 'import' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Full Ledger Export Card */}
              <div className="bg-white p-6 rounded-xl border border-outline-variant/30 shadow-xs space-y-4">
                <h2 className="text-base font-bold text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined">download</span>
                  <span>All-Time Ledger Export</span>
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Download the complete client database and historical billing records across all months in Excel format:
                </p>
                <div className="text-[10px] bg-slate-50 p-2.5 rounded border border-outline-variant/30 font-mono text-on-surface-variant">
                  Date, Company Name, Client Name, Number, Service, Client/Cons, Quotation, Govt Fees, Prof Fees, Advance, Pending Amount, Payment Received, Status, Remark
                </div>
                <button
                  onClick={handleExportAllExcel}
                  className="w-full bg-primary hover:bg-primary/95 text-white font-semibold py-2.5 px-4 rounded-lg shadow-xs flex items-center justify-center gap-2 transition-colors text-xs"
                >
                  <span className="material-symbols-outlined text-base">download_for_offline</span>
                  <span>Export All-Time Ledger (.xlsx)</span>
                </button>
              </div>

              {/* Bulk Import Card */}
              <div className="bg-white p-6 rounded-xl border border-outline-variant/30 shadow-xs space-y-4">
                <h2 className="text-base font-bold text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined">upload_file</span>
                  <span>Bulk Excel Import</span>
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Upload an existing spreadsheet. The system will auto-match company names, validate monetary inputs, and prepare a staging preview before saving to database.
                </p>
                <form onSubmit={handleUploadPreview} className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileChange}
                    className="flex-1 text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary-container/20 file:text-primary hover:file:bg-primary-container/30"
                  />
                  <button
                    type="submit"
                    disabled={!file || loading}
                    className="bg-primary hover:bg-primary/95 text-white font-semibold py-2 px-4 rounded-lg text-xs disabled:opacity-50 transition-colors"
                  >
                    {loading ? 'Analyzing...' : 'Preview'}
                  </button>
                </form>
              </div>
            </div>

            {/* Staging Preview Area */}
            {previewRows.length > 0 && (
              <div className="bg-white rounded-xl border border-outline-variant/30 shadow-xs overflow-hidden flex flex-col">
                <div className="p-4 bg-slate-50 border-b border-outline-variant/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-on-background">Spreadsheet Import Preview</h3>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">
                      Verify validation checks before writing to database. Invalid rows will be skipped.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-emerald-600">✓ {totalValid} Valid</span>
                    {totalInvalid > 0 && <span className="text-xs font-bold text-error">✗ {totalInvalid} Invalid</span>}
                    <button
                      onClick={handleCommitImport}
                      disabled={totalValid === 0 || importing}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2 px-4 rounded-lg shadow-sm disabled:opacity-50 transition-all flex items-center gap-1"
                    >
                      {importing ? (
                        'Saving...'
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          <span>Commit {totalValid} Entries</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left border-collapse text-[11px] min-w-[1000px]">
                    <thead>
                      <tr className="bg-slate-100/50 border-b border-outline-variant/30 text-on-surface-variant font-semibold">
                        <th className="p-2.5 w-12 text-center">Row</th>
                        <th className="p-2.5">Company Name</th>
                        <th className="p-2.5">Client Name</th>
                        <th className="p-2.5">Service</th>
                        <th className="p-2.5 text-right">Quotation</th>
                        <th className="p-2.5 text-right">Advance</th>
                        <th className="p-2.5 text-right">Received</th>
                        <th className="p-2.5 text-center">Status</th>
                        <th className="p-2.5">Validation Checks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-on-surface">
                      {previewRows.map((row) => (
                        <tr key={row.rowNum} className={`hover:bg-slate-50/50 ${!row.isValid ? 'bg-red-50/20' : ''}`}>
                          <td className="p-2 text-center font-mono text-on-surface-variant">{row.rowNum}</td>
                          <td className="p-2 font-bold">{row.data.company_name || '-'}</td>
                          <td className="p-2 text-on-surface-variant">{row.data.client_name || '-'}</td>
                          <td className="p-2 text-on-surface-variant">{row.data.service_type || '-'}</td>
                          <td className="p-2 text-right font-mono">{row.data.quotation_amount.toLocaleString()}</td>
                          <td className="p-2 text-right font-mono">{row.data.advance_amount.toLocaleString()}</td>
                          <td className="p-2 text-right font-mono">{row.data.payment_received.toLocaleString()}</td>
                          <td className="p-2 text-center">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              row.isValid ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {row.isValid ? 'Passed' : 'Error'}
                            </span>
                          </td>
                          <td className="p-2 text-xs text-error font-medium">
                            {row.isValid ? (
                              <span className="text-emerald-600 flex items-center gap-1 text-[10px]">
                                <span className="material-symbols-outlined text-xs">check</span> Ready
                              </span>
                            ) : (
                              row.errors.join('; ')
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
