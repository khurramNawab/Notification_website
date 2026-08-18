import React, { useState } from 'react';
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

export const Reports: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<RowPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err: any) {
      setError(err.message || 'Failed to commit imported records');
    } finally {
      setImporting(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      const blob = await request('/api/transactions/export');
      const url = window.URL.createObjectURL(blob as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'PayTrack_CRM_Ledger.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to export ledger: ' + err.message);
    }
  };

  const totalValid = previewRows.filter((r) => r.isValid).length;
  const totalInvalid = previewRows.length - totalValid;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-on-background">Reports &amp; Data Tools</h1>
          <p className="text-xs md:text-sm text-on-surface-variant mt-1">Export transaction logs to Excel, or bulk import historical spreadsheets.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card 1: Export Reports */}
          <div className="bg-white p-6 rounded-xl border border-outline-variant/30 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined">download</span>
              <span>Spreadsheet Export</span>
            </h2>
            <p className="text-xs text-on-surface-variant">
              Download the entire client database and billing ledger in Excel format. The columns are formatted to match the standard CA office structure:
            </p>
            <div className="text-[10px] bg-slate-50 p-2.5 rounded border border-outline-variant/30 font-mono text-on-surface-variant">
              Date, Company Name, Client Name, Number, Service, Client/Cons, Quotation, Govt Fees, Prof Fees, Advance, Pending Amount, Payment Received, Remark
            </div>
            <button
              onClick={handleExportExcel}
              className="w-full bg-primary hover:bg-primary/95 text-white font-semibold py-2.5 px-4 rounded-lg shadow-xs flex items-center justify-center gap-2 transition-colors text-xs"
            >
              <span className="material-symbols-outlined text-base">download_for_offline</span>
              <span>Export Ledger (.xlsx)</span>
            </button>
          </div>

          {/* Card 2: Bulk Import */}
          <div className="bg-white p-6 rounded-xl border border-outline-variant/30 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined">upload_file</span>
              <span>Bulk Excel Import</span>
            </h2>
            <p className="text-xs text-on-surface-variant">
              Upload an existing client list. The system will auto-match company names, validate monetary inputs, and prepare a staging preview before saving to database.
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

        {error && (
          <div className="p-4 bg-error-container text-on-error-container border border-error/25 rounded-xl text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">warning</span>
            <span>{error}</span>
          </div>
        )}

        {/* Staging Preview Area */}
        {previewRows.length > 0 && (
          <div className="bg-white rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden flex flex-col">
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
    </div>
  );
};
