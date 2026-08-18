import React, { useEffect, useState } from 'react';
import { request } from '../utils/api';

interface MarkPaidModalProps {
  transactionId: number;
  onClose: () => void;
  onSave: () => void;
}

export const MarkPaidModal: React.FC<MarkPaidModalProps> = ({
  transactionId,
  onClose,
  onSave
}) => {
  const [details, setDetails] = useState<any | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'UPI' | 'bank' | 'cheque'>('UPI');
  const [note, setNote] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTxDetails = async () => {
      try {
        const data = await request(`/api/transactions?limit=100`);
        const tx = data.transactions.find((t: any) => t.id === transactionId);
        if (tx) {
          setDetails(tx);
          setAmount(tx.pending_amount.toString()); // default to full pending amount
        }
      } catch (err) {
        console.error(err);
      } finally {
        setFetching(false);
      }
    };
    fetchTxDetails();
  }, [transactionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pAmt = parseFloat(amount) || 0;
    if (pAmt <= 0) {
      setError('Amount must be greater than zero');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await request(`/api/transactions/${transactionId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: pAmt,
          payment_date: paymentDate,
          payment_mode: paymentMode,
          note
        })
      });
      onSave();
    } catch (err: any) {
      setError(err.message || 'Failed to log payment');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs">
        <div className="bg-white p-6 rounded-xl flex items-center gap-3">
          <span className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></span>
          <span className="text-xs font-semibold text-on-surface">Loading ledger state...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-level-2 border border-outline-variant/30 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-outline-variant flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-sm font-bold text-on-surface">Log Client Payment</h2>
            <p className="text-[9px] text-on-surface-variant uppercase tracking-wider mt-0.5">{details?.company_name}</p>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors p-1">
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-error-container text-on-error-container border border-error/20 rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">warning</span>
              <span>{error}</span>
            </div>
          )}

          {/* Read Only Stats Context */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-outline-variant/20 text-[10px]">
            <div>
              <span className="block text-on-surface-variant uppercase">Quotation</span>
              <span className="font-bold text-on-surface font-mono text-xs">₹{details?.quotation_amount.toLocaleString()}</span>
            </div>
            <div>
              <span className="block text-on-surface-variant uppercase">Advance Paid</span>
              <span className="font-bold text-on-surface font-mono text-xs">₹{details?.advance_amount.toLocaleString()}</span>
            </div>
            <div className="col-span-2 pt-2 border-t border-slate-200 flex justify-between items-center">
              <div>
                <span className="block text-on-surface-variant uppercase">Received Log</span>
                <span className="font-bold text-on-surface font-mono text-xs">₹{details?.payment_received.toLocaleString()}</span>
              </div>
              <div className="text-right">
                <span className="block text-on-surface-variant uppercase font-semibold">Total Outstanding</span>
                <span className="font-bold text-error font-mono text-sm">₹{details?.pending_amount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Input: Payment Amount */}
          <div>
            <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Payment Amount (₹)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="0.00"
              className="w-full rounded border border-outline-variant bg-white px-3 py-2 text-xs font-mono text-on-surface focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all"
              required
              min="0.01"
              step="any"
              max={details?.pending_amount}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Input: Date */}
            <div>
              <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full rounded border border-outline-variant bg-white px-3 py-2 text-xs text-on-surface focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all"
                required
              />
            </div>
            {/* Input: Mode */}
            <div>
              <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Payment Mode</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as any)}
                className="w-full rounded border border-outline-variant bg-white px-3 py-2 text-xs text-on-surface focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all"
                required
              >
                <option value="UPI">UPI (GPay/PhonePe)</option>
                <option value="bank">Bank Transfer (NEFT/IMPS)</option>
                <option value="cash">Cash Payment</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>

          {/* Input: Memo note */}
          <div>
            <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Receipt Note / Memo</label>
            <input
              type="text"
              placeholder="e.g. Tx ID, Cheque number, etc."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded border border-outline-variant bg-white px-3 py-2 text-xs text-on-surface focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-outline-variant/30 flex justify-end gap-2 text-xs font-semibold shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 hover:bg-slate-50 text-on-surface-variant rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-primary hover:bg-primary/95 text-white py-1.5 px-4 rounded-lg shadow-sm flex items-center gap-1 transition-colors"
            >
              {loading ? (
                <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full"></span>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">payment</span>
                  <span>Record Payment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
