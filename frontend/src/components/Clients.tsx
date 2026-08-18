import React, { useEffect, useState } from 'react';
import { request } from '../utils/api';
import { useAuth } from '../context/AuthContext';

interface Transaction {
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
}

interface ClientsProps {
  searchTerm: string;
  setTriggerEditId: (id: number | null) => void;
  openNewEntryModal: () => void;
  openMarkPaidModal: (txId: number) => void;
  openClientProfile: (clientId: number) => void;
  refreshTrigger: number;
  setRefreshTrigger: React.Dispatch<React.SetStateAction<number>>;
}

export const Clients: React.FC<ClientsProps> = ({
  searchTerm,
  setTriggerEditId,
  openNewEntryModal,
  openMarkPaidModal,
  openClientProfile,
  refreshTrigger,
  setRefreshTrigger
}) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const [limit] = useState(10);
  const [serviceFilter, setServiceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  const fetchTransactions = async () => {
    try {
      let endpoint = `/api/transactions?page=${page}&limit=${limit}`;
      if (searchTerm) endpoint += `&search=${encodeURIComponent(searchTerm)}`;
      if (serviceFilter && serviceFilter !== 'all') endpoint += `&service_type=${encodeURIComponent(serviceFilter)}`;
      if (statusFilter) endpoint += `&status=${encodeURIComponent(statusFilter)}`;

      const data = await request(endpoint);
      setTransactions(data.transactions);
      setTotalPages(data.pagination.pages || 1);
      setTotalEntries(data.pagination.total || 0);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [page, searchTerm, serviceFilter, statusFilter, refreshTrigger]);

  useEffect(() => { setPage(1); }, [searchTerm, serviceFilter, statusFilter]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Archive this engagement?')) return;
    try {
      await request(`/api/transactions/${id}`, { method: 'DELETE' });
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDownloadInvoice = async (txId: number) => {
    try {
      const blob = await request(`/api/transactions/${txId}/invoice`);
      const url = window.URL.createObjectURL(blob as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice_#INV-${1000 + txId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleWhatsAppReminder = async (tx: any) => {
    try {
      await request(`/api/transactions/${tx.id}/reminders`, {
        method: 'POST',
        body: JSON.stringify({
          channel: 'whatsapp',
          reminder_date: new Date().toISOString().split('T')[0],
        }),
      });
      const message = `Dear ${tx.client_name}, this is a payment reminder from PayTrack CRM for the ${tx.service_type} engagement at ${tx.company_name}. Outstanding Balance: Rs. ${tx.pending_amount.toLocaleString()}. Please process the payment at your earliest convenience. Thank you!`;
      let cleanedPhone = (tx.phone_number || '').replace(/[^0-9]/g, '');
      if (cleanedPhone.length === 10) {
        cleanedPhone = '91' + cleanedPhone;
      }
      const waUrl = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');
    } catch (err: any) {
      alert('Failed to trigger reminder: ' + err.message);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 flex flex-col">
      <div className="max-w-7xl mx-auto w-full space-y-6 flex-1 flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-on-background">Clients &amp; Transactions</h2>
            <p className="text-xs text-on-surface-variant">Track billing, professional fees, and collection logs.</p>
          </div>
          <button
            onClick={openNewEntryModal}
            className="bg-primary hover:bg-primary/95 text-white font-semibold text-xs px-5 py-2.5 rounded-lg shadow-sm flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Add New Entry</span>
          </button>
        </div>

        <div className="bg-white rounded-xl border border-outline-variant/30 p-4 shadow-xs">
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Services</span>
              <div className="flex flex-wrap gap-1.5">
                {['All Services', 'GST', 'Income Tax', 'Audit', 'ROC'].map((srv) => {
                  const val = srv.toLowerCase() === 'all services' ? 'all' : srv;
                  return (
                    <button
                      key={srv}
                      onClick={() => setServiceFilter(val)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                        serviceFilter === val
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-outline-variant/50 hover:bg-slate-50 text-on-surface-variant bg-white'
                      }`}
                    >
                      {srv}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="hidden lg:block w-px h-6 bg-outline-variant/30"></div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Status</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { value: '', label: 'All Statuses' },
                  { value: 'complete', label: 'Complete' },
                  { value: 'partial', label: 'Partial' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'overdue', label: 'Overdue' }
                ].map((st) => (
                  <button
                    key={st.value}
                    onClick={() => setStatusFilter(st.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                      statusFilter === st.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-outline-variant/50 hover:bg-slate-50 text-on-surface-variant bg-white'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden flex flex-col flex-1">
          <div className="overflow-x-auto flex-1 font-sans">
            <table className="w-full text-left border-collapse min-w-[1100px] text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-outline-variant/30 font-semibold text-on-surface-variant">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Client Name</th>
                  <th className="py-3 px-4">Service Type</th>
                  <th className="py-3 px-4 text-right">Quotation (₹)</th>
                  <th className="py-3 px-4 text-right">Prof Fees (₹)</th>
                  <th className="py-3 px-4 text-right">Govt Fees (₹)</th>
                  <th className="py-3 px-4 text-right">Advance (₹)</th>
                  <th className="py-3 px-4 text-right">Pending (₹)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-on-surface">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-12 text-on-surface-variant">No engagements found.</td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-teal-50/20 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-on-surface-variant">{tx.date}</td>
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => openClientProfile(tx.client_id)}
                          className="font-bold text-primary hover:underline text-left"
                        >
                          {tx.company_name}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-on-surface-variant">{tx.client_name}</td>
                      <td className="py-3.5 px-4">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] text-on-surface-variant border border-outline-variant/30 font-semibold uppercase font-sans">
                          {tx.service_type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono">{tx.quotation_amount.toLocaleString()}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-on-surface-variant">{tx.prof_fees.toLocaleString()}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-on-surface-variant">{tx.govt_fees.toLocaleString()}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-on-surface-variant">{tx.advance_amount.toLocaleString()}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-tertiary">{tx.pending_amount.toLocaleString()}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          tx.status === 'complete' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                          tx.status === 'partial' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                          tx.status === 'overdue' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                          'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center relative">
                        <button
                          onClick={() => setActiveMenuId(activeMenuId === tx.id ? null : tx.id)}
                          className="text-outline-variant hover:text-primary transition-colors p-1 rounded-full hover:bg-slate-100"
                        >
                          <span className="material-symbols-outlined text-[18px]">more_vert</span>
                        </button>
                        {activeMenuId === tx.id && (
                          <>
                            <div onClick={() => setActiveMenuId(null)} className="fixed inset-0 z-10" />
                            <div className="absolute right-4 mt-1 bg-white rounded-lg shadow-level-2 border border-outline-variant/30 w-36 py-1 z-20 text-left">
                              <button
                                onClick={() => { openMarkPaidModal(tx.id); setActiveMenuId(null); }}
                                className="w-full px-3 py-1.5 hover:bg-slate-50 text-left font-semibold text-on-surface flex items-center gap-1.5"
                              >
                                <span className="material-symbols-outlined text-sm text-primary">check_circle</span>
                                Log Payment
                              </button>
                              <button
                                onClick={() => { handleDownloadInvoice(tx.id); setActiveMenuId(null); }}
                                className="w-full px-3 py-1.5 hover:bg-slate-50 text-left font-semibold text-on-surface flex items-center gap-1.5"
                              >
                                <span className="material-symbols-outlined text-sm text-primary">download</span>
                                PDF Invoice
                              </button>
                              <button
                                onClick={() => { handleWhatsAppReminder(tx); setActiveMenuId(null); }}
                                className="w-full px-3 py-1.5 hover:bg-slate-50 text-left font-semibold text-emerald-700 flex items-center gap-1.5"
                              >
                                <span className="material-symbols-outlined text-sm text-emerald-600">forum</span>
                                WhatsApp Alert
                              </button>
                              <button
                                onClick={() => { setTriggerEditId(tx.id); setActiveMenuId(null); }}
                                className="w-full px-3 py-1.5 hover:bg-slate-50 text-left font-semibold text-on-surface flex items-center gap-1.5"
                              >
                                <span className="material-symbols-outlined text-sm text-primary">edit</span>
                                Edit Entry
                              </button>
                              {user?.role === 'admin' && (
                                <button
                                  onClick={() => { handleDelete(tx.id); setActiveMenuId(null); }}
                                  className="w-full px-3 py-1.5 hover:bg-slate-50 text-left font-semibold text-error flex items-center gap-1.5 border-t border-slate-100"
                                >
                                  <span className="material-symbols-outlined text-sm">archive</span>
                                  Archive
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-white border-t border-outline-variant/50 p-3.5 flex items-center justify-between">
            <span className="text-[11px] text-on-surface-variant pl-2 font-medium">
              Showing {totalEntries > 0 ? (page - 1) * limit + 1 : 0}-{Math.min(page * limit, totalEntries)} of {totalEntries} entries
            </span>
            <div className="flex items-center gap-1 pr-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-1 rounded text-on-surface-variant hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              {Array.from({ length: totalPages }).map((_, idx) => (
                <button
                  key={idx + 1}
                  onClick={() => setPage(idx + 1)}
                  className={`w-6.5 h-6.5 rounded font-mono text-[11px] flex items-center justify-center transition-colors ${
                    page === idx + 1 ? 'bg-primary text-white font-bold' : 'text-on-surface-variant hover:bg-slate-50'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="p-1 rounded text-on-surface-variant hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
