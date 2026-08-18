import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { Clients } from './components/Clients';
import { FollowUps } from './components/FollowUps';
import { Reports } from './components/Reports';
import { Settings } from './components/Settings';
import { NewEntryModal } from './components/NewEntryModal';
import { MarkPaidModal } from './components/MarkPaidModal';
import { ClientProfileModal } from './components/ClientProfileModal';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  
  // Navigation & UI States
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Modal States
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false);
  const [editTransactionId, setEditTransactionId] = useState<number | null>(null);
  const [paymentTransactionId, setPaymentTransactionId] = useState<number | null>(null);
  const [clientProfileId, setClientProfileId] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <span className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></span>
          <span className="text-xs font-semibold text-on-surface-variant font-sans">Connecting to PayTrack...</span>
        </div>
      </div>
    );
  }

  // Redirect to login screen if not authenticated
  if (!user) {
    return <Login />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans antialiased text-on-background text-sm">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openNewEntry={() => setIsNewEntryOpen(true)}
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:ml-[260px] h-screen overflow-hidden">
        {/* Top AppBar */}
        <Header
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />

        {/* Tab View Routing */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'dashboard' && (
            <Dashboard
              searchTerm={searchTerm}
              triggerNewPayment={(txId) => setPaymentTransactionId(txId)}
            />
          )}

          {activeTab === 'clients' && (
            <Clients
              searchTerm={searchTerm}
              setTriggerEditId={setEditTransactionId}
              openNewEntryModal={() => setIsNewEntryOpen(true)}
              openMarkPaidModal={(txId) => setPaymentTransactionId(txId)}
              openClientProfile={(clientId) => setClientProfileId(clientId)}
              refreshTrigger={refreshTrigger}
              setRefreshTrigger={setRefreshTrigger}
            />
          )}

          {activeTab === 'followups' && (
            <FollowUps
              openMarkPaidModal={(txId) => setPaymentTransactionId(txId)}
              refreshTrigger={refreshTrigger}
              setRefreshTrigger={setRefreshTrigger}
            />
          )}

          {activeTab === 'reports' && <Reports />}

          {activeTab === 'settings' && <Settings />}
        </main>
      </div>

      {/* Dynamic Overlay Dialogs */}
      {(isNewEntryOpen || editTransactionId !== null) && (
        <NewEntryModal
          transactionId={editTransactionId}
          onClose={() => {
            setIsNewEntryOpen(false);
            setEditTransactionId(null);
          }}
          onSave={() => {
            setIsNewEntryOpen(false);
            setEditTransactionId(null);
            setRefreshTrigger((prev) => prev + 1);
          }}
        />
      )}

      {paymentTransactionId !== null && (
        <MarkPaidModal
          transactionId={paymentTransactionId}
          onClose={() => setPaymentTransactionId(null)}
          onSave={() => {
            setPaymentTransactionId(null);
            setRefreshTrigger((prev) => prev + 1);
          }}
        />
      )}

      {clientProfileId !== null && (
        <ClientProfileModal
          clientId={clientProfileId}
          onClose={() => setClientProfileId(null)}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
