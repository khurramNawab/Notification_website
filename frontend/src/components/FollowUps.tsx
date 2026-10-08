import React, { useEffect, useState } from 'react';
import { request } from '../utils/api';

interface FollowUpsProps {
  openMarkPaidModal: (txId: number) => void;
  refreshTrigger: number;
  setRefreshTrigger: React.Dispatch<React.SetStateAction<number>>;
}

export const FollowUps: React.FC<FollowUpsProps> = ({
  openMarkPaidModal,
  refreshTrigger,
  setRefreshTrigger
}) => {
  const [columns, setColumns] = useState<{
    overdue: any[];
    due_this_week: any[];
    upcoming: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifyingId, setNotifyingId] = useState<number | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchFollowUps = async () => {
    try {
      setLoading(true);
      const res = await request('/api/dashboard');
      setColumns(res.follow_ups);
    } catch (err) {
      console.error('Failed to fetch follow-ups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowUps();
  }, [refreshTrigger]);

  const handleCallClient = (clientName: string, phone: string) => {
    if (!phone) {
      showToast(`No contact number logged for ${clientName}`);
      return;
    }
    const cleaned = phone.replace(/[^0-9+]/g, '');
    window.location.href = `tel:${cleaned}`;
  };

  const handleSendReminder = async (tx: any, channel: 'whatsapp' | 'email') => {
    try {
      setNotifyingId(tx.id);
      await request(`/api/transactions/${tx.id}/reminders`, {
        method: 'POST',
        body: JSON.stringify({
          channel,
          reminder_date: new Date().toISOString().split('T')[0]
        })
      });
      
      if (channel === 'whatsapp') {
        const message = `Dear ${tx.client_name}, this is a payment reminder from PayTrack CRM for the ${tx.service_type} engagement at ${tx.company_name}. Outstanding Balance: Rs. ${tx.pending_amount.toLocaleString()}. Please process the payment at your earliest convenience. Thank you!`;
        let cleanedPhone = (tx.phone_number || '').replace(/[^0-9]/g, '');
        if (cleanedPhone.length === 10) {
          cleanedPhone = '91' + cleanedPhone;
        }
        if (cleanedPhone) {
          const waUrl = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(message)}`;
          window.open(waUrl, '_blank');
        } else {
          showToast(`Reminder logged. (No phone number available for ${tx.company_name})`);
        }
      } else {
        showToast(`Email reminder logged for ${tx.company_name}`);
      }
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      showToast('Failed to trigger reminder: ' + err.message);
    } finally {
      setNotifyingId(null);
    }
  };

  const handleSendBulkReminders = async () => {
    const overdueList = columns?.overdue || [];
    if (overdueList.length === 0) {
      showToast('No overdue accounts to remind at this time.');
      return;
    }

    if (!window.confirm(`Broadcast payment reminders to ${overdueList.length} overdue client accounts?`)) {
      return;
    }

    setBulkSending(true);
    try {
      const txIds = overdueList.map((tx) => tx.id);
      await request('/api/transactions/reminders/bulk', {
        method: 'POST',
        body: JSON.stringify({
          transaction_ids: txIds,
          channel: 'whatsapp'
        })
      });

      showToast(`Successfully dispatched and logged ${txIds.length} reminders!`);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      showToast('Bulk reminder failed: ' + err.message);
    } finally {
      setBulkSending(false);
    }
  };

  // Filter column lists by search term
  const filterList = (list: any[] = []) => {
    if (!searchTerm) return list;
    const term = searchTerm.toLowerCase();
    return list.filter((tx) => 
      tx.company_name?.toLowerCase().includes(term) ||
      tx.client_name?.toLowerCase().includes(term) ||
      tx.service_type?.toLowerCase().includes(term) ||
      tx.phone_number?.includes(term)
    );
  };

  const overdueFiltered = filterList(columns?.overdue);
  const dueThisWeekFiltered = filterList(columns?.due_this_week);
  const upcomingFiltered = filterList(columns?.upcoming);

  // Financial totals
  const overdueTotal = (columns?.overdue || []).reduce((sum, tx) => sum + (parseFloat(tx.pending_amount) || 0), 0);
  const dueThisWeekTotal = (columns?.due_this_week || []).reduce((sum, tx) => sum + (parseFloat(tx.pending_amount) || 0), 0);
  const upcomingTotal = (columns?.upcoming || []).reduce((sum, tx) => sum + (parseFloat(tx.pending_amount) || 0), 0);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <span className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 flex flex-col">
      <div className="max-w-7xl mx-auto w-full space-y-6 flex-1 flex flex-col">
        
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-lg border border-slate-700 flex items-center gap-2 animate-bounce">
            <span className="material-symbols-outlined text-emerald-400 text-sm">info</span>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-on-background">Payment Follow-ups</h1>
            <p className="text-xs md:text-sm text-on-surface-variant mt-0.5">
              Live automated aging ledger, overdue alerts, and direct client communications.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap self-stretch sm:self-auto">
            <div className="relative flex-1 sm:w-60">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-sm">search</span>
              <input
                type="text"
                placeholder="Search follow-ups..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-outline-variant/40 rounded-lg pl-8 pr-3 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary transition-all shadow-xs"
              />
            </div>

            <button
              onClick={handleSendBulkReminders}
              disabled={bulkSending || (columns?.overdue || []).length === 0}
              className="bg-primary text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-xs flex items-center gap-1.5 hover:bg-primary/95 transition-all disabled:opacity-50"
            >
              {bulkSending ? (
                <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full"></span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">broadcast_on_home</span>
                  <span>Broadcast Reminders ({columns?.overdue.length || 0})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Top Summary Stat Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-outline-variant/30 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-error uppercase tracking-wider block">Overdue Collections</span>
              <div className="text-lg font-bold text-error font-mono mt-0.5">₹{overdueTotal.toLocaleString()}</div>
            </div>
            <span className="bg-error/10 text-error font-bold text-xs px-2.5 py-1 rounded-full">
              {columns?.overdue.length || 0} Accounts
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-outline-variant/30 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-tertiary uppercase tracking-wider block">Due This Week</span>
              <div className="text-lg font-bold text-tertiary font-mono mt-0.5">₹{dueThisWeekTotal.toLocaleString()}</div>
            </div>
            <span className="bg-tertiary/10 text-tertiary font-bold text-xs px-2.5 py-1 rounded-full">
              {columns?.due_this_week.length || 0} Accounts
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-outline-variant/30 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">Upcoming Due</span>
              <div className="text-lg font-bold text-on-surface font-mono mt-0.5">₹{upcomingTotal.toLocaleString()}</div>
            </div>
            <span className="bg-slate-100 text-on-surface-variant font-bold text-xs px-2.5 py-1 rounded-full">
              {columns?.upcoming.length || 0} Accounts
            </span>
          </div>
        </div>

        {/* Dynamic Kanban Board */}
        <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-y-auto pb-4">
          
          {/* Column 1: Overdue */}
          <div className="flex-1 flex flex-col bg-slate-100 rounded-xl p-3 border border-outline-variant/30 min-h-[400px]">
            <div className="flex justify-between items-center px-2 pb-3 border-b border-outline-variant/30 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-error animate-pulse shadow-sm"></span>
                <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider">Overdue</h2>
                <span className="bg-error-container text-on-error-container font-mono text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {overdueFiltered.length}
                </span>
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar max-h-[600px] pr-1">
              {overdueFiltered.map((tx) => (
                <div key={tx.id} className="bg-white rounded-lg p-4 shadow-xs border-l-4 border-error relative hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-on-surface text-sm">{tx.company_name}</h3>
                      <p className="text-[10px] text-on-surface-variant">{tx.service_type} • Contact: {tx.client_name}</p>
                    </div>
                    <span className="bg-error/10 text-error font-bold text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">warning</span>
                      {tx.age_days} Days Old
                    </span>
                  </div>
                  <div className="text-lg font-bold font-mono text-error mb-4">₹{tx.pending_amount.toLocaleString()}</div>
                  <div className="border-t border-outline-variant/30 pt-3 flex justify-between items-center text-xs">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleCallClient(tx.client_name, tx.phone_number)}
                        className="w-7 h-7 rounded-full bg-slate-50 hover:bg-slate-100 text-on-surface-variant flex items-center justify-center transition-colors"
                        title={tx.phone_number ? `Call ${tx.phone_number}` : 'No phone number logged'}
                      >
                        <span className="material-symbols-outlined text-base">call</span>
                      </button>
                      <button
                        disabled={notifyingId === tx.id}
                        onClick={() => handleSendReminder(tx, 'whatsapp')}
                        className="w-7 h-7 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition-colors"
                        title="Direct WhatsApp Payment Reminder"
                      >
                        {notifyingId === tx.id ? (
                          <span className="animate-spin h-3.5 w-3.5 border-2 border-emerald-600 border-t-transparent rounded-full"></span>
                        ) : (
                          <span className="material-symbols-outlined text-base">forum</span>
                        )}
                      </button>
                    </div>
                    <button
                      onClick={() => openMarkPaidModal(tx.id)}
                      className="text-primary font-bold text-[10px] hover:bg-primary-container/20 px-2 py-1 rounded transition-colors flex items-center gap-1 border border-primary/20"
                    >
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Mark Paid
                    </button>
                  </div>
                </div>
              ))}
              {overdueFiltered.length === 0 && (
                <div className="text-center py-12 text-xs text-on-surface-variant font-medium">
                  {searchTerm ? 'No matching overdue accounts.' : 'No overdue accounts. All clear!'}
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Due This Week */}
          <div className="flex-1 flex flex-col bg-slate-100 rounded-xl p-3 border border-outline-variant/30 min-h-[400px]">
            <div className="flex justify-between items-center px-2 pb-3 border-b border-outline-variant/30 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-tertiary shadow-sm"></span>
                <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider">Due This Week</h2>
                <span className="bg-tertiary-container text-on-tertiary-container font-mono text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {dueThisWeekFiltered.length}
                </span>
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar max-h-[600px] pr-1">
              {dueThisWeekFiltered.map((tx) => (
                <div key={tx.id} className="bg-white rounded-lg p-4 shadow-xs border-l-4 border-tertiary relative hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-on-surface text-sm">{tx.company_name}</h3>
                      <p className="text-[10px] text-on-surface-variant">{tx.service_type} • Contact: {tx.client_name}</p>
                    </div>
                    <span className="bg-tertiary-container/30 text-tertiary font-bold text-[9px] px-1.5 py-0.5 rounded">
                      {tx.days_left !== undefined ? `${tx.days_left} Days Left` : `${tx.age_days} Days`}
                    </span>
                  </div>
                  <div className="text-lg font-bold font-mono text-tertiary mb-4">₹{tx.pending_amount.toLocaleString()}</div>
                  <div className="border-t border-outline-variant/30 pt-3 flex justify-between items-center text-xs">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleCallClient(tx.client_name, tx.phone_number)}
                        className="w-7 h-7 rounded-full bg-slate-50 hover:bg-slate-100 text-on-surface-variant flex items-center justify-center transition-colors"
                        title={tx.phone_number ? `Call ${tx.phone_number}` : 'No phone number logged'}
                      >
                        <span className="material-symbols-outlined text-base">call</span>
                      </button>
                      <button
                        disabled={notifyingId === tx.id}
                        onClick={() => handleSendReminder(tx, 'whatsapp')}
                        className="w-7 h-7 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition-colors"
                        title="Direct WhatsApp Payment Reminder"
                      >
                        {notifyingId === tx.id ? (
                          <span className="animate-spin h-3.5 w-3.5 border-2 border-emerald-600 border-t-transparent rounded-full"></span>
                        ) : (
                          <span className="material-symbols-outlined text-base">forum</span>
                        )}
                      </button>
                    </div>
                    <button
                      onClick={() => openMarkPaidModal(tx.id)}
                      className="text-primary font-bold text-[10px] hover:bg-primary-container/20 px-2 py-1 rounded transition-colors flex items-center gap-1 border border-primary/20"
                    >
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Mark Paid
                    </button>
                  </div>
                </div>
              ))}
              {dueThisWeekFiltered.length === 0 && (
                <div className="text-center py-12 text-xs text-on-surface-variant font-medium">
                  {searchTerm ? 'No matching accounts.' : 'No accounts due this week.'}
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Upcoming */}
          <div className="flex-1 flex flex-col bg-slate-100 rounded-xl p-3 border border-outline-variant/30 min-h-[400px]">
            <div className="flex justify-between items-center px-2 pb-3 border-b border-outline-variant/30 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shadow-sm"></span>
                <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider">Upcoming</h2>
                <span className="bg-slate-200 text-on-surface-variant font-mono text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {upcomingFiltered.length}
                </span>
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar max-h-[600px] pr-1">
              {upcomingFiltered.map((tx) => (
                <div key={tx.id} className="bg-white rounded-lg p-4 shadow-xs border-l-4 border-slate-400 relative hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-on-surface text-sm">{tx.company_name}</h3>
                      <p className="text-[10px] text-on-surface-variant">{tx.service_type} • Contact: {tx.client_name}</p>
                    </div>
                    <span className="bg-slate-100 text-on-surface-variant font-bold text-[9px] px-1.5 py-0.5 rounded font-mono">
                      {tx.date}
                    </span>
                  </div>
                  <div className="text-lg font-bold font-mono text-on-surface-variant mb-4">₹{tx.pending_amount.toLocaleString()}</div>
                  <div className="border-t border-outline-variant/30 pt-3 flex justify-between items-center text-xs">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleCallClient(tx.client_name, tx.phone_number)}
                        className="w-7 h-7 rounded-full bg-slate-50 hover:bg-slate-100 text-on-surface-variant flex items-center justify-center transition-colors"
                        title={tx.phone_number ? `Call ${tx.phone_number}` : 'No phone number logged'}
                      >
                        <span className="material-symbols-outlined text-base">call</span>
                      </button>
                    </div>
                    <span className="text-[10px] text-on-surface-variant font-medium italic">Active Engagement</span>
                  </div>
                </div>
              ))}
              {upcomingFiltered.length === 0 && (
                <div className="text-center py-12 text-xs text-on-surface-variant font-medium">
                  {searchTerm ? 'No matching upcoming billings.' : 'No upcoming billings.'}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
