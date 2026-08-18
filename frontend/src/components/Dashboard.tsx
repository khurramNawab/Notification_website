import React, { useEffect, useState } from 'react';
import { request } from '../utils/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface DashboardData {
  kpis: {
    total_revenue_this_month: number;
    total_pending: number;
    total_clients: number;
    overdue_count: number;
  };
  revenue_trend: Array<{ month: string; amount: number }>;
  status_breakdown: Array<{ name: string; value: number; color: string }>;
  follow_ups: {
    overdue: Array<any>;
    due_this_week: Array<any>;
    upcoming: Array<any>;
  };
  recent_transactions: Array<any>;
}

interface DashboardProps {
  searchTerm: string;
  triggerNewPayment: (txId: number) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ searchTerm, triggerNewPayment }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reminderSending, setReminderSending] = useState<number | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await request('/api/dashboard');
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const sendReminder = async (tx: any) => {
    try {
      setReminderSending(tx.id);
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
      alert('Failed to send reminder: ' + err.message);
    } finally {
      setReminderSending(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <span className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 p-6 bg-slate-50">
        <div className="p-4 bg-error-container text-on-error-container border border-error/20 rounded-xl">
          Error loading dashboard: {error}
        </div>
      </div>
    );
  }

  // Filter recent transactions if search term is active
  const filteredRecentTx = data.recent_transactions.filter((tx) =>
    tx.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.service_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group all pending items that are overdue or due this week for follow-up today list
  const todaysFollowUps = [...data.follow_ups.overdue, ...data.follow_ups.due_this_week].slice(0, 3);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Page Title */}
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-on-surface">Dashboard Overview</h1>
            <p className="text-xs md:text-sm text-on-surface-variant mt-1">Welcome back. Here is the summary of your financials.</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-white border border-outline-variant/50 rounded-lg p-1 shadow-sm">
            <button className="px-3 py-1.5 rounded bg-surface-container-low text-primary font-bold text-xs">Today</button>
            <button className="px-3 py-1.5 rounded hover:bg-slate-50 text-on-surface-variant font-medium text-xs transition-colors" onClick={fetchDashboardData}>Sync</button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {/* Total Revenue */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-outline-variant/30 hover:border-outline-variant transition-colors relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-bl-full group-hover:bg-primary/10 transition-colors"></div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Total Revenue (Month)</span>
              <span className="material-symbols-outlined text-primary bg-primary/10 p-1.5 rounded-lg text-lg">account_balance_wallet</span>
            </div>
            <div className="text-2xl font-bold text-on-surface mb-2 font-mono">
              ₹{data.kpis.total_revenue_this_month.toLocaleString()}
            </div>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-xs text-primary font-bold">trending_up</span>
              <span className="text-xs text-primary font-semibold">Cash collected</span>
            </div>
          </div>

          {/* Total Pending */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-outline-variant/30 hover:border-outline-variant transition-colors relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-20 h-20 bg-tertiary/5 rounded-bl-full group-hover:bg-tertiary/10 transition-colors"></div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Total Outstanding</span>
              <span className="material-symbols-outlined text-tertiary bg-tertiary/10 p-1.5 rounded-lg text-lg">pending_actions</span>
            </div>
            <div className="text-2xl font-bold text-on-surface mb-2 font-mono">
              ₹{data.kpis.total_pending.toLocaleString()}
            </div>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-xs text-tertiary font-bold">hourglass_empty</span>
              <span className="text-xs text-tertiary font-semibold">Awaiting payment</span>
            </div>
          </div>

          {/* Total Clients */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-outline-variant/30 hover:border-outline-variant transition-colors relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-20 h-20 bg-secondary/5 rounded-bl-full group-hover:bg-secondary/10 transition-colors"></div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Total Clients</span>
              <span className="material-symbols-outlined text-secondary bg-secondary-container/30 p-1.5 rounded-lg text-lg">groups</span>
            </div>
            <div className="text-2xl font-bold text-on-surface mb-2 font-mono">{data.kpis.total_clients}</div>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-xs text-primary font-bold">check_circle</span>
              <span className="text-xs text-on-surface-variant">Active engagements</span>
            </div>
          </div>

          {/* Overdue */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-outline-variant/30 hover:border-outline-variant transition-colors relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-20 h-20 bg-error/5 rounded-bl-full group-hover:bg-error/10 transition-colors"></div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Overdue Accounts</span>
              <span className="material-symbols-outlined text-error bg-error-container/50 p-1.5 rounded-lg text-lg">warning</span>
            </div>
            <div className="text-2xl font-bold text-error mb-2 font-mono">{data.kpis.overdue_count}</div>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-xs text-error font-bold">schedule</span>
              <span className="text-xs text-error font-semibold">&gt; 30 days pending</span>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Trend Column Chart */}
          <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-outline-variant/50 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-sm font-semibold text-on-surface uppercase tracking-wider">Revenue Trend (Last 6 Months)</h2>
              <span className="text-xs text-on-surface-variant bg-slate-100 px-2.5 py-1 rounded-md font-semibold">Collections</span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.revenue_trend} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#3d4947' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#3d4947' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value: any) => [`₹${value.toLocaleString()}`, 'Revenue']} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="amount" fill="#0D9488" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Payment Status Donut Chart */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-outline-variant/50 flex flex-col">
            <h2 className="text-sm font-semibold text-on-surface uppercase tracking-wider mb-6">Payment Status (Engagements)</h2>
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="relative w-40 h-40 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.status_breakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {data.status_breakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute text-center">
                  <div className="text-[10px] uppercase font-bold text-on-surface-variant">Breakdown</div>
                  <div className="text-xl font-bold text-on-surface">Ratio</div>
                </div>
              </div>
              
              {/* Custom Legend */}
              <div className="w-full space-y-2.5 mt-6 border-t border-outline-variant/30 pt-4">
                {data.status_breakdown.map((item, idx) => {
                  const total = data.status_breakdown.reduce((sum, current) => sum + current.value, 0);
                  const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
                  return (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-on-surface-variant font-medium">{item.name} ({item.value})</span>
                      </div>
                      <span className="font-mono font-bold text-on-surface">{percentage}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row: Follow-ups & Recent Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Follow-ups List */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-outline-variant/50 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-semibold text-on-surface uppercase tracking-wider">Follow-ups Today</h2>
              <span className="bg-error-container text-on-error-container font-bold text-[10px] px-2 py-0.5 rounded-full">
                {todaysFollowUps.length} Pending
              </span>
            </div>
            
            <div className="space-y-4 mt-2 flex-1 overflow-y-auto">
              {todaysFollowUps.length === 0 ? (
                <div className="text-center py-8 text-xs text-on-surface-variant">No follow-ups due today. Great job!</div>
              ) : (
                todaysFollowUps.map((tx) => (
                  <div key={tx.id} className="flex flex-col gap-2 p-3 rounded-lg border border-outline-variant/30 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-on-surface text-sm leading-snug">{tx.company_name}</div>
                        <div className="text-[10px] text-on-surface-variant mt-0.5">{tx.service_type} • {tx.age_days} Days ago</div>
                      </div>
                      <div className="text-xs font-mono font-bold text-error">₹{tx.pending_amount.toLocaleString()}</div>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => triggerNewPayment(tx.id)}
                        className="flex-1 bg-primary-container/20 hover:bg-primary-container/40 text-primary font-semibold text-[10px] py-1.5 rounded transition-colors text-center"
                      >
                        Record Paid
                      </button>
                      <button
                        disabled={reminderSending === tx.id}
                        onClick={() => sendReminder(tx)}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-on-surface-variant font-semibold text-[10px] py-1.5 rounded transition-colors flex items-center justify-center gap-1"
                      >
                        {reminderSending === tx.id ? (
                          <span className="animate-spin h-3.5 w-3.5 border-2 border-primary border-t-transparent rounded-full"></span>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-xs">send</span>
                            <span>WhatsApp</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-outline-variant/50 flex flex-col overflow-hidden">
            <div className="p-5 border-b border-outline-variant/30 flex justify-between items-center">
              <h2 className="text-sm font-semibold text-on-surface uppercase tracking-wider">Recent Engagements</h2>
              <span className="text-xs text-on-surface-variant font-semibold">Latest updates</span>
            </div>
            
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-outline-variant/30 font-semibold text-on-surface-variant">
                    <th className="p-3">Date</th>
                    <th className="p-3">Company</th>
                    <th className="p-3">Service</th>
                    <th className="p-3 text-right">Pending (₹)</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredRecentTx.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-on-surface-variant">No matches found.</td>
                    </tr>
                  ) : (
                    filteredRecentTx.map((tx) => {
                      let statusBadge = '';
                      if (tx.status === 'complete') {
                        statusBadge = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                      } else if (tx.status === 'partial') {
                        statusBadge = 'bg-amber-100 text-amber-800 border-amber-200';
                      } else if (tx.status === 'overdue') {
                        statusBadge = 'bg-rose-100 text-rose-800 border-rose-200';
                      } else {
                        statusBadge = 'bg-slate-100 text-slate-700 border-slate-200';
                      }

                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-3 text-on-surface-variant font-mono">{tx.date}</td>
                          <td className="p-3 font-semibold text-on-surface">{tx.company_name}</td>
                          <td className="p-3 text-on-surface-variant">{tx.service_type}</td>
                          <td className="p-3 text-right font-mono font-bold text-on-surface">
                            ₹{tx.pending_amount.toLocaleString()}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${statusBadge}`}>
                              {tx.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
