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
    alert(`Simulating phone call connection to ${clientName} at ${phone || '[No Phone Logged]'}`);
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
        const waUrl = `https://wa.me/${cleanedPhone}?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');
      } else {
        alert('Email reminder logged and simulated successfully!');
      }
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      alert('Failed to trigger reminder: ' + err.message);
    } finally {
      setNotifyingId(null);
    }
  };

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
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-on-background">Payment Follow-ups</h1>
            <p className="text-xs text-on-surface-variant">Manage pending collections and client communications.</p>
          </div>
          <button
            onClick={() => alert('Simulating bulk reminder broadcasts for all overdue accounts!')}
            className="bg-primary text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-sm flex items-center gap-1.5 self-start sm:self-auto hover:bg-primary/95 transition-colors"
          >
            <span className="material-symbols-outlined text-base">send</span>
            <span>Send Bulk Reminders</span>
          </button>
        </div>

        {/* Kanban Board Container */}
        <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-y-auto pb-4">
          
          {/* Column 1: Overdue */}
          <div className="flex-1 flex flex-col bg-slate-100 rounded-xl p-3 border border-outline-variant/30 min-h-[400px]">
            <div className="flex justify-between items-center px-2 pb-3 border-b border-outline-variant/30 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-error animate-pulse shadow-sm"></span>
                <h2 className="text-xs font-bold text-on-surface uppercase tracking-wider">Overdue</h2>
                <span className="bg-error-container text-on-error-container font-mono text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {columns?.overdue.length || 0}
                </span>
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar max-h-[600px] pr-1">
              {columns?.overdue.map((tx) => (
                <div key={tx.id} className="bg-white rounded-lg p-4 shadow-xs border-l-4 border-error relative hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-on-surface text-sm">{tx.company_name}</h3>
                      <p className="text-[10px] text-on-surface-variant">{tx.service_type}</p>
                    </div>
                    <span className="bg-error/10 text-error font-bold text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">warning</span>
                      {tx.age_days} Days
                    </span>
                  </div>
                  <div className="text-lg font-bold font-mono text-on-background mb-4">₹{tx.pending_amount.toLocaleString()}</div>
                  <div className="border-t border-outline-variant/30 pt-3 flex justify-between items-center text-xs">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleCallClient(tx.client_name, tx.phone_number)}
                        className="w-7 h-7 rounded-full bg-slate-50 hover:bg-slate-100 text-on-surface-variant flex items-center justify-center transition-colors"
                        title="Call Client"
                      >
                        <span className="material-symbols-outlined text-base">call</span>
                      </button>
                      <button
                        disabled={notifyingId === tx.id}
                        onClick={() => handleSendReminder(tx, 'whatsapp')}
                        className="w-7 h-7 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition-colors"
                        title="WhatsApp Reminder"
                      >
                        <span className="material-symbols-outlined text-base">forum</span>
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
              {columns?.overdue.length === 0 && (
                <div className="text-center py-12 text-xs text-on-surface-variant font-medium">No overdue invoices.</div>
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
                  {columns?.due_this_week.length || 0}
                </span>
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar max-h-[600px] pr-1">
              {columns?.due_this_week.map((tx) => (
                <div key={tx.id} className="bg-white rounded-lg p-4 shadow-xs border-l-4 border-tertiary relative hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-on-surface text-sm">{tx.company_name}</h3>
                      <p className="text-[10px] text-on-surface-variant">{tx.service_type}</p>
                    </div>
                    <span className="bg-tertiary-container/30 text-on-tertiary-fixed-variant font-bold text-[9px] px-1.5 py-0.5 rounded">
                      {30 - tx.age_days} Days Left
                    </span>
                  </div>
                  <div className="text-lg font-bold font-mono text-on-background mb-4">₹{tx.pending_amount.toLocaleString()}</div>
                  <div className="border-t border-outline-variant/30 pt-3 flex justify-between items-center text-xs">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleCallClient(tx.client_name, tx.phone_number)}
                        className="w-7 h-7 rounded-full bg-slate-50 hover:bg-slate-100 text-on-surface-variant flex items-center justify-center transition-colors"
                        title="Call Client"
                      >
                        <span className="material-symbols-outlined text-base">call</span>
                      </button>
                      <button
                        disabled={notifyingId === tx.id}
                        onClick={() => handleSendReminder(tx, 'whatsapp')}
                        className="w-7 h-7 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition-colors"
                        title="WhatsApp Reminder"
                      >
                        <span className="material-symbols-outlined text-base">forum</span>
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
              {columns?.due_this_week.length === 0 && (
                <div className="text-center py-12 text-xs text-on-surface-variant font-medium">No accounts due this week.</div>
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
                  {columns?.upcoming.length || 0}
                </span>
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar max-h-[600px] pr-1">
              {columns?.upcoming.map((tx) => (
                <div key={tx.id} className="bg-white rounded-lg p-4 shadow-xs border-l-4 border-slate-400 relative hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-on-surface text-sm">{tx.company_name}</h3>
                      <p className="text-[10px] text-on-surface-variant">{tx.service_type}</p>
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
                        title="Call Client"
                      >
                        <span className="material-symbols-outlined text-base">call</span>
                      </button>
                    </div>
                    <span className="text-[10px] text-on-surface-variant font-medium italic">Engagement Active</span>
                  </div>
                </div>
              ))}
              {columns?.upcoming.length === 0 && (
                <div className="text-center py-12 text-xs text-on-surface-variant font-medium">No upcoming billings.</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
