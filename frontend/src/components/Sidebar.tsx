import React from 'react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  openNewEntry: () => void;
  isOpen: boolean;
  toggleSidebar: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  openNewEntry,
  isOpen,
  toggleSidebar
}) => {
  const { user, logout } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'clients', label: 'Clients & Transactions', icon: 'group' },
    { id: 'followups', label: 'Follow-ups', icon: 'event_repeat' },
    { id: 'reports', label: 'Reports & Import', icon: 'analytics' },
    { id: 'settings', label: 'Settings', icon: 'settings' }
  ];

  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
    if (isOpen) {
      toggleSidebar(); // Close drawer on mobile
    }
  };

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div
          onClick={toggleSidebar}
          className="fixed inset-0 bg-slate-900/40 z-30 md:hidden backdrop-blur-xs"
        />
      )}

      <nav
        className={`fixed left-0 top-0 h-screen w-[260px] bg-white shadow-sm flex flex-col border-r border-outline-variant z-40 transition-transform duration-300 md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand / Logo Header */}
        <div className="flex items-center gap-3 p-6 border-b border-outline-variant h-16 shrink-0 bg-white">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-white text-xl fill-icon">account_balance</span>
          </div>
          <div className="overflow-hidden">
            <div className="text-lg font-bold text-primary truncate leading-none">PayTrack CRM</div>
            <div className="text-[10px] text-on-surface-variant font-medium truncate mt-1">Consultancy Edition</div>
          </div>
        </div>

        {/* User Stats Card */}
        <div className="p-4 bg-slate-50 border-b border-outline-variant/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-primary font-bold text-sm shrink-0 border border-outline-variant/30">
            {user?.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <div className="text-sm font-semibold text-on-background truncate leading-snug">{user?.name}</div>
            <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-primary-container/20 text-primary border border-primary/20 mt-0.5">
              {user?.role}
            </span>
          </div>
        </div>

        {/* Global CTA */}
        <div className="p-4 shrink-0">
          <button
            onClick={openNewEntry}
            className="w-full bg-primary hover:bg-surface-tint text-white font-semibold text-xs py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>New Entry</span>
          </button>
        </div>

        {/* Navigation links */}
        <div className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all text-left ${
                  isActive
                    ? 'text-primary font-bold bg-surface-container-low border-r-4 border-primary'
                    : 'text-on-surface-variant hover:bg-slate-50'
                }`}
              >
                <span className={`material-symbols-outlined text-lg ${isActive ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-outline-variant/50 flex flex-col gap-2 bg-slate-50 shrink-0">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-error hover:bg-error-container/30 rounded-lg transition-colors font-medium text-left"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </nav>
    </>
  );
};
