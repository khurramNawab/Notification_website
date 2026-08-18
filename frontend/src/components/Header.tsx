import React from 'react';
import { useAuth } from '../context/AuthContext';

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
        
        <button className="text-on-surface-variant hover:bg-slate-50 p-2 rounded-full transition-all relative">
          <span className="material-symbols-outlined text-[22px]">notifications</span>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full"></span>
        </button>
        
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
