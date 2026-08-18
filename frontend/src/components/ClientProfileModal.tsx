import React, { useEffect, useState } from 'react';
import { request } from '../utils/api';

interface ClientProfileModalProps {
  clientId: number;
  onClose: () => void;
}

export const ClientProfileModal: React.FC<ClientProfileModalProps> = ({
  clientId,
  onClose
}) => {
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'engagements' | 'payments'>('engagements');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const data = await request(`/api/clients/${clientId}`);
        setProfile(data);
      } catch (err) {
        console.error('Failed to load client profile ledger:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [clientId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs">
        <div className="bg-white p-6 rounded-xl flex items-center gap-3">
          <span className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></span>
          <span className="text-xs font-semibold text-on-surface">Loading client ledger...</span>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
        <div className="bg-white p-6 rounded-xl text-center max-w-sm space-y-4">
          <span className="material-symbols-outlined text-3xl text-error">warning</span>
          <h3 className="font-bold text-on-surface">Client Profile Not Found</h3>
          <button onClick={onClose} className="bg-primary text-white text-xs px-4 py-2 rounded-lg">Close</button>
        </div>
      </div>
    );
  }

  const { client, transactions, summary, payments } = profile;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl shadow-level-2 border border-outline-variant/30 flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-slate-50 shrink-0">
          <div>
            <h2 className="text-base font-bold text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-lg">account_balance</span>
              <span>{client.company_name}</span>
            </h2>
            <p className="text-[10px] text-on-surface-variant">Ledger: {client.client_name} • {client.phone_number || 'No contact phone'}</p>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors p-1">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Summary KPI grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 p-4 rounded-lg border border-outline-variant/20 flex flex-col justify-between">
              <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Lifetime Billed</span>
              <span className="text-lg font-bold font-mono text-on-surface mt-1">₹{summary.total_billed.toLocaleString()}</span>
            </div>
            <div className="bg-emerald-50/40 p-4 rounded-lg border border-emerald-100 flex flex-col justify-between">
              <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-wider">Lifetime Collected</span>
              <span className="text-lg font-bold font-mono text-emerald-700 mt-1">₹{summary.total_received.toLocaleString()}</span>
            </div>
            <div className="bg-rose-50/40 p-4 rounded-lg border border-rose-100 flex flex-col justify-between">
              <span className="text-[9px] font-bold text-rose-800 uppercase tracking-wider font-semibold">Total Outstanding Due</span>
              <span className="text-lg font-bold font-mono text-rose-700 mt-1">₹{summary.total_pending.toLocaleString()}</span>
            </div>
          </div>

          {/* Navigation Tab Bar */}
          <div className="flex border-b border-outline-variant/30 shrink-0">
            <button
              onClick={() => setActiveTab('engagements')}
              className={`px-4 py-2 text-xs font-semibold transition-all border-b-2 ${
                activeTab === 'engagements'
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Services Log ({transactions.length})
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`px-4 py-2 text-xs font-semibold transition-all border-b-2 ${
                activeTab === 'payments'
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Payments Received ({payments.length})
            </button>
          </div>

          {/* Tab 1: Engagements */}
          {activeTab === 'engagements' ? (
            <div className="border border-outline-variant/25 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[10px] min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-outline-variant/30 text-on-surface-variant font-semibold">
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Service Type</th>
                      <th className="p-2.5 text-right">Quotation</th>
                      <th className="p-2.5 text-right">Govt Fees</th>
                      <th className="p-2.5 text-right">Prof Fees</th>
                      <th className="p-2.5 text-right">Advance</th>
                      <th className="p-2.5 text-right">Received</th>
                      <th className="p-2.5 text-right font-bold text-tertiary">Pending</th>
                      <th className="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-on-surface">
                    {transactions.map((t: any) => (
                      <tr key={t.id}>
                        <td className="p-2 font-mono text-on-surface-variant">{t.date}</td>
                        <td className="p-2 font-bold uppercase">{t.service_type}</td>
                        <td className="p-2 text-right font-mono">₹{t.quotation_amount.toLocaleString()}</td>
                        <td className="p-2 text-right font-mono text-on-surface-variant">₹{t.govt_fees.toLocaleString()}</td>
                        <td className="p-2 text-right font-mono text-on-surface-variant">₹{t.prof_fees.toLocaleString()}</td>
                        <td className="p-2 text-right font-mono text-on-surface-variant">₹{t.advance_amount.toLocaleString()}</td>
                        <td className="p-2 text-right font-mono text-on-surface-variant">₹{t.payment_received.toLocaleString()}</td>
                        <td className="p-2 text-right font-mono font-bold text-tertiary">₹{t.pending_amount.toLocaleString()}</td>
                        <td className="p-2 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                            t.status === 'complete' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                            t.status === 'partial' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                            t.status === 'overdue' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                            'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {transactions.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center py-6 text-on-surface-variant font-medium">No service records found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Tab 2: Payments received (Audit timeline) */
            <div className="space-y-4">
              {payments.length === 0 ? (
                <div className="text-center py-12 text-xs text-on-surface-variant font-medium">No payment history recorded.</div>
              ) : (
                <div className="relative pl-6 border-l border-outline-variant/50 space-y-6">
                  {payments.map((p: any) => (
                    <div key={p.id} className="relative">
                      {/* Timeline Dot */}
                      <div className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white ring-2 ring-emerald-500/10"></div>
                      
                      <div className="bg-slate-50 p-4 rounded-lg border border-outline-variant/20 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                        <div>
                          <div className="text-xs font-bold text-on-surface">
                            Payment Logged for <span className="uppercase text-primary">{p.service_type}</span>
                          </div>
                          <div className="text-[10px] text-on-surface-variant mt-0.5">
                            Receipt Date: {p.payment_date} • Mode: <span className="capitalize font-semibold">{p.payment_mode}</span>
                          </div>
                          {p.note && <div className="text-[10px] text-on-surface-variant italic mt-1 bg-white px-2 py-0.5 rounded border border-slate-100 inline-block">Note: {p.note}</div>}
                        </div>
                        <div className="text-sm font-bold font-mono text-emerald-600 self-start sm:self-auto">
                          + ₹{p.amount.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
