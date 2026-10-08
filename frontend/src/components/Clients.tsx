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
  const [limit] = useState(25); // Show more per page for better daily grouping
  const [serviceFilter, setServiceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState(''); // 'YYYY-MM-DD' or ''
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchTransactions = async () => {
    try {
      let endpoint = `/api/transactions?page=${page}&limit=${limit}`;
      if (searchTerm) endpoint += `&search=${encodeURIComponent(searchTerm)}`;
      if (serviceFilter && serviceFilter !== 'all') endpoint += `&service_type=${encodeURIComponent(serviceFilter)}`;
      if (statusFilter) endpoint += `&status=${encodeURIComponent(statusFilter)}`;
      if (dateFilter) endpoint += `&date=${encodeURIComponent(dateFilter)}`;

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
  }, [page, searchTerm, serviceFilter, statusFilter, dateFilter, refreshTrigger]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, serviceFilter, statusFilter, dateFilter]);

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

  // Group transactions by date for unified day-wise display
  const groupedTransactions: { [date: string]: Transaction[] } = {};
  transactions.forEach((tx) => {
    const d = tx.date || 'Undated';
    if (!groupedTransactions[d]) {
      groupedTransactions[d] = [];
    }
    groupedTransactions[d].push(tx);
  });

  const formatDateHeader = (dateStr: string) => {
    if (!dateStr || dateStr === 'Undated') return 'Undated Engagements';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const formatted = d.toLocaleDateString('default', { day: '2-digit', month: 'short', year: 'numeric' });
        if (dateStr === todayStr) {
          return `${formatted} (Today)`;
        }
        return formatted;
      }
    } catch (_) {}
    return dateStr;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 flex flex-col">
      <div className="max-w-7xl mx-auto w-full space-y-6 flex-1 flex flex-col">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-on-background">Clients &amp; Transactions</h2>
            <p className="text-xs text-on-surface-variant">Daily grouped billing, fee allocations, and collection logs.</p>
          </div>
          <button
            onClick={openNewEntryModal}
            className="bg-primary hover:bg-primary/95 text-white font-semibold text-xs px-5 py-2.5 rounded-lg shadow-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Add New Entry</span>
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white rounded-xl border border-outline-variant/30 p-4 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
            
            {/* Services Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Services</span>
              <div className="flex flex-wrap gap-1">
                {['All Services', 'GST', 'Income Tax', 'Audit', 'ROC'].map((srv) => {
                  const val = srv.toLowerCase() === 'all services' ? 'all' : srv;
                  return (
                    <button
                      key={srv}
                      onClick={() => setServiceFilter(val)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
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

            {/* Status Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Status</span>
              <div className="flex flex-wrap gap-1">
                {[
                  { value: '', label: 'All' },
                  { value: 'complete', label: 'Complete' },
                  { value: 'partial', label: 'Partial' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'overdue', label: 'Overdue' }
                ].map((st) => (
                  <button
                    key={st.value}
                    onClick={() => setStatusFilter(st.value)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
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

            <div className="hidden lg:block w-px h-6 bg-outline-variant/30"></div>

            {/* Date Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Date</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setDateFilter(dateFilter === todayStr ? '' : todayStr)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    dateFilter === todayStr
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-outline-variant/50 hover:bg-slate-50 text-on-surface-variant bg-white'
                  }`}
                >
                  Today's Entries
                </button>
                {dateFilter && dateFilter !== todayStr && (
                  <button
                    onClick={() => setDateFilter('')}
                    className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-on-surface-variant flex items-center gap-1"
                  >
                    <span>{dateFilter}</span>
                    <span className="material-symbols-outlined text-xs">close</span>
                  </button>
                )}
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="text-xs bg-slate-50 border border-outline-variant/50 rounded-lg px-2 py-1 text-on-surface focus:outline-none focus:border-primary"
                  title="Filter by specific date"
                />
              </div>
            </div>

          </div>
        </div>

        {/* Grouped Table View */}
        <div className="bg-white rounded-xl border border-outline-variant/30 shadow-xs overflow-hidden flex flex-col flex-1">
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
                    <td colSpan={11} className="text-center py-12 text-on-surface-variant">
                      No engagements found for selected filters.
                    </td>
                  </tr>
                ) : (
                  Object.keys(groupedTransactions).map((dateKey) => {
                    const dayTxs = groupedTransactions[dateKey];
                    const dayQuotation = dayTxs.reduce((sum, t) => sum + (parseFloat(t.quotation_amount as any) || 0), 0);
                    const dayAdvance = dayTxs.reduce((sum, t) => sum + (parseFloat(t.advance_amount as any) || 0), 0);
                    const dayPending = dayTxs.reduce((sum, t) => sum + (parseFloat(t.pending_amount as any) || 0), 0);
                    const isToday = dateKey === todayStr;

                    return (
                      <React.Fragment key={dateKey}>
                        {/* Daily Section Header: All entries of this day are unified here */}
                        <tr className={`${isToday ? 'bg-primary/5' : 'bg-slate-100/70'} border-y border-outline-variant/30`}>
                          <td colSpan={11} className="py-2.5 px-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span className={`material-symbols-outlined text-sm ${isToday ? 'text-primary' : 'text-on-surface-variant'}`}>
                                  calendar_today
                                </span>
                                <span className="font-bold text-xs text-on-surface">
                                  {formatDateHeader(dateKey)}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isToday ? 'bg-primary text-white' : 'bg-slate-200 text-slate-800'
                                }`}>
                                  {dayTxs.length} {dayTxs.length === 1 ? 'Entry' : 'Entries'}
                                </span>
                              </div>

                              {/* Day Totals Summary */}
                              <div className="flex items-center gap-4 text-[11px] font-mono">
                                <div className="text-on-surface-variant">
                                  Day Total: <span className="font-bold text-on-surface">₹{dayQuotation.toLocaleString()}</span>
                                </div>
                                <div className="text-emerald-700">
                                  Advance: <span className="font-bold">₹{dayAdvance.toLocaleString()}</span>
                                </div>
                                <div className="text-error">
                                  Pending: <span className="font-bold">₹{dayPending.toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Individual Entries for this date */}
                        {dayTxs.map((tx) => (
                          <tr key={tx.id} className="hover:bg-teal-50/20 transition-colors">
                            <td className="py-3 px-4 font-mono text-on-surface-variant text-[11px]">{tx.date}</td>
                            <td className="py-3 px-4">
                              <button
                                onClick={() => openClientProfile(tx.client_id)}
                                className="font-bold text-primary hover:underline text-left"
                              >
                                {tx.company_name}
                              </button>
                            </td>
                            <td className="py-3 px-4 text-on-surface-variant">{tx.client_name}</td>
                            <td className="py-3 px-4">
                              <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] text-on-surface-variant border border-outline-variant/30 font-semibold uppercase font-sans">
                                {tx.service_type}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold">{tx.quotation_amount.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right font-mono text-violet-700">{tx.prof_fees.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right font-mono text-blue-700">{tx.govt_fees.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right font-mono text-emerald-700">{tx.advance_amount.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-error">{tx.pending_amount.toLocaleString()}</td>
                            <td className="py-3 px-4 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                tx.status === 'complete' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                tx.status === 'partial' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                tx.status === 'overdue' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                                'bg-slate-100 text-slate-700 border-slate-200'
                              }`}>
                                {tx.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={(e) => {
                                  if (activeMenuId === tx.id) {
                                    setActiveMenuId(null);
                                  } else {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const dropdownHeight = 180;
                                    let calculatedTop = rect.bottom + 4;
                                    if (calculatedTop + dropdownHeight > window.innerHeight) {
                                      calculatedTop = rect.top - dropdownHeight - 4;
                                    }
                                    setMenuPos({ top: calculatedTop, left: rect.right - 144 });
                                    setActiveMenuId(tx.id);
                                  }
                                }}
                                className="text-outline-variant hover:text-primary transition-colors p-1 rounded-full hover:bg-slate-100"
                              >
                                <span className="material-symbols-outlined text-[18px]">more_vert</span>
                              </button>
                              {activeMenuId === tx.id && (
                                <>
                                  <div 
                                    onClick={() => setActiveMenuId(null)} 
                                    onWheel={() => setActiveMenuId(null)}
                                    onTouchMove={() => setActiveMenuId(null)}
                                    className="fixed inset-0 z-40" 
                                  />
                                  <div 
                                    className="fixed bg-white rounded-lg shadow-level-2 border border-outline-variant/30 w-36 py-1 z-50 text-left"
                                    style={{ top: menuPos.top, left: menuPos.left }}
                                  >
                                    <button
                                      onClick={() => { openMarkPaidModal(tx.id); setActiveMenuId(null); }}
                                      className="w-full px-3 py-1.5 hover:bg-slate-50 text-left font-semibold text-on-surface flex items-center gap-1.5 text-xs"
                                    >
                                      <span className="material-symbols-outlined text-sm text-primary">check_circle</span>
                                      Log Payment
                                    </button>
                                    <button
                                      onClick={() => { handleDownloadInvoice(tx.id); setActiveMenuId(null); }}
                                      className="w-full px-3 py-1.5 hover:bg-slate-50 text-left font-semibold text-on-surface flex items-center gap-1.5 text-xs"
                                    >
                                      <span className="material-symbols-outlined text-sm text-primary">download</span>
                                      PDF Invoice
                                    </button>
                                    <button
                                      onClick={() => { handleWhatsAppReminder(tx); setActiveMenuId(null); }}
                                      className="w-full px-3 py-1.5 hover:bg-slate-50 text-left font-semibold text-emerald-700 flex items-center gap-1.5 text-xs"
                                    >
                                      <span className="material-symbols-outlined text-sm text-emerald-600">forum</span>
                                      WhatsApp Alert
                                    </button>
                                    <button
                                      onClick={() => { setTriggerEditId(tx.id); setActiveMenuId(null); }}
                                      className="w-full px-3 py-1.5 hover:bg-slate-50 text-left font-semibold text-on-surface flex items-center gap-1.5 text-xs"
                                    >
                                      <span className="material-symbols-outlined text-sm text-primary">edit</span>
                                      Edit Entry
                                    </button>
                                    {user?.role === 'admin' && (
                                      <button
                                        onClick={() => { handleDelete(tx.id); setActiveMenuId(null); }}
                                        className="w-full px-3 py-1.5 hover:bg-slate-50 text-left font-semibold text-error flex items-center gap-1.5 border-t border-slate-100 text-xs"
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
                        ))}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
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
