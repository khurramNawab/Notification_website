import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { request } from '../utils/api';

interface HeaderProps {
  toggleSidebar: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  toggleSidebar,
  searchTerm,
  setSearchTerm
}) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await request('/api/dashboard');
      const items = [
        ...(res.follow_ups?.overdue || []).map((x: any) => ({ ...x, type: 'overdue' })),
        ...(res.follow_ups?.due_this_week || []).map((x: any) => ({ ...x, type: 'due_soon' }))
      ];
      setNotifications(items);
    } catch (err) {
      console.error('Failed to load notifications in header:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const sendReminder = async (tx: any) => {
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
      alert('Failed to send reminder: ' + err.message);
    }
  };

  return (
    <header className="bg-white h-16 flex justify-between items-center px-6 border-b border-outline-variant shrink-0 z-10">
      {/* Left: Mobile Menu Toggle & Title / Search */}
      <div className="flex items-center gap-4 flex-1">
        <button
          onClick={toggleSidebar}
          className="md:hidden text-on-surface hover:bg-slate-50 p-2 rounded-full transition-colors"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        
        {/* Search Input */}
        <div className="relative max-w-xs w-full hidden sm:block focus-within:ring-2 focus-within:ring-primary rounded-lg transition-all">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
            search
          </span>
          <input
            type="text"
            placeholder="Search clients or service..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-outline-variant rounded-lg text-sm focus:outline-none focus:border-transparent focus:ring-0"
          />
        </div>
      </div>

      {/* Right: Actions & Profile */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <span className="hidden sm:block text-xs font-semibold text-primary px-3 py-1 bg-primary-container/10 rounded-full">
          Consulting Suite
        </span>
        <div className="h-6 w-px bg-outline-variant hidden sm:block mx-1"></div>
        
        {/* Notification Bell with Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="text-on-surface-variant hover:bg-slate-50 p-2 rounded-full transition-all relative"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 bg-error text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {notifications.length}
              </span>
            )}
          </button>
          
          {isOpen && (
            <>
              <div onClick={() => setIsOpen(false)} className="fixed inset-0 z-40" />
              <div className="absolute right-0 mt-2 bg-white rounded-xl shadow-lg border border-outline-variant/30 w-80 py-2 z-50 text-left max-h-96 overflow-y-auto">
                <div className="px-4 py-2 border-b border-outline-variant/30 flex justify-between items-center">
                  <span className="font-bold text-on-surface">Payment Alerts</span>
                  <span className="text-[10px] bg-error-container text-on-error-container font-semibold px-2 py-0.5 rounded-full">
                    {notifications.length} Action Needed
                  </span>
                </div>
                
                <div className="divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-on-surface-variant">
                      No follow-ups due. You're all caught up!
                    </div>
                  ) : (
                    notifications.map((tx) => (
                      <div key={tx.id} className="p-3 hover:bg-slate-50 transition-colors flex flex-col gap-1.5">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-on-surface text-xs leading-snug">{tx.company_name}</span>
                            <div className="text-[10px] text-on-surface-variant mt-0.5">
                              {tx.service_type} • {tx.type === 'overdue' ? 'Overdue' : 'Due Soon'}
                            </div>
                          </div>
                          <span className="font-mono text-xs font-bold text-error">₹{tx.pending_amount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-[9px] text-on-surface-variant font-medium bg-slate-100 px-1.5 py-0.5 rounded">
                            {tx.age_days} days pending
                          </span>
                          <button
                            onClick={() => sendReminder(tx)}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-2.5 py-1 rounded transition-colors flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[12px]">forum</span>
                            <span>WhatsApp</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-2 pl-2">
          <div className="text-right hidden md:block">
            <div className="text-xs font-semibold text-on-background">{user?.name}</div>
            <div className="text-[10px] text-on-surface-variant capitalize">{user?.role}</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs border border-outline-variant cursor-pointer hover:ring-2 hover:ring-primary transition-all">
            {user?.name.substring(0, 1).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
};
