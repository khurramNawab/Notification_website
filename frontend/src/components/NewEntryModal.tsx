import React, { useEffect, useState } from 'react';
import { request } from '../utils/api';

const STANDARD_SERVICES = [
  "Trademark Registration",
  "Company Registration (Pvt Ltd / LLP/OPC)",
  "Copyright Registration",
  "Barcode Registration",
  "Design Registration",
  "ISO Certification (9001, 14001, 45001, 27001 and more...)",
  "Product Certificate (CE Marking/GMP/HALAL/KOSHER/FDA/HACCP)",
  "Food License & Registration (FSSAI)",
  "MSME Registration (Udyog)",
  "Import Export License (IEC)",
  "Gem (E-marketing place) Portal Registration",
  "ESI & PF Registration",
  "Digital Signature Certificate (Class 3 & DGFT)",
  "Shop & Establishment Certificate",
  "Professional Tax (PTEC & PTRC Certificate)",
  "Income Tax Return Preparation and Filling",
  "GST Registration and Return Filling",
  "Accounting entry on small business",
  "Taxation Advisory Services",
  "All type of Company Formation & ROC Matters",
  "PAN, TAN, TDS Return",
  "Start up India Registration"
];

interface ServiceItem {
  serviceType: string;
  customServiceType: string;
  clientOrConsultant: 'client' | 'consultant';
  quotationAmount: string;
  govtFees: string;
  profFees: string;
  advanceAmount: string;
  remark: string;
}

interface NewEntryModalProps {
  transactionId: number | null;
  onClose: () => void;
  onSave: () => void;
}

export const NewEntryModal: React.FC<NewEntryModalProps> = ({
  transactionId,
  onClose,
  onSave
}) => {
  // Client Info (Filled once)
  const [companyName, setCompanyName] = useState('');
  const [clientName, setClientName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // List of services logged in this engagement
  const [services, setServices] = useState<ServiceItem[]>([
    {
      serviceType: '',
      customServiceType: '',
      clientOrConsultant: 'client',
      quotationAmount: '',
      govtFees: '',
      profFees: '',
      advanceAmount: '',
      remark: ''
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load details in edit mode
  useEffect(() => {
    if (!transactionId) return;

    const loadTxDetails = async () => {
      try {
        setFetching(true);
        const data = await request(`/api/transactions?limit=100`);
        const tx = data.transactions.find((t: any) => t.id === transactionId);
        if (tx) {
          setCompanyName(tx.company_name);
          setClientName(tx.client_name);
          setPhoneNumber(tx.phone_number || '');
          setDate(tx.date);

          let sType = tx.service_type;
          let cType = '';
          if (!STANDARD_SERVICES.includes(tx.service_type)) {
            sType = 'Other';
            cType = tx.service_type;
          }

          setServices([
            {
              serviceType: sType,
              customServiceType: cType,
              clientOrConsultant: tx.client_or_consultant,
              quotationAmount: tx.quotation_amount.toString(),
              govtFees: tx.govt_fees.toString(),
              profFees: tx.prof_fees.toString(),
              advanceAmount: tx.advance_amount.toString(),
              remark: tx.remark || ''
            }
          ]);
        }
      } catch (err) {
        console.error('Failed to load transaction for edit:', err);
      } finally {
        setFetching(false);
      }
    };

    loadTxDetails();
  }, [transactionId]);

  // Append a blank service item to the list
  const addServiceItem = () => {
    setServices([
      ...services,
      {
        serviceType: '',
        customServiceType: '',
        clientOrConsultant: 'client',
        quotationAmount: '',
        govtFees: '',
        profFees: '',
        advanceAmount: '',
        remark: ''
      }
    ]);
  };

  // Remove a service item from the list
  const removeServiceItem = (index: number) => {
    setServices(services.filter((_, i) => i !== index));
  };

  // Update field value for a specific service row
  const updateServiceItem = (index: number, field: keyof ServiceItem, value: string) => {
    const updated = [...services];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-calculate Professional Fees when quotation or govt fees change
    if (field === 'quotationAmount' || field === 'govtFees') {
      const q = parseFloat(field === 'quotationAmount' ? value : updated[index].quotationAmount) || 0;
      const g = parseFloat(field === 'govtFees' ? value : updated[index].govtFees) || 0;
      updated[index].profFees = Math.max(0, q - g).toString();
    }

    setServices(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !clientName || !date) {
      setError('Please fill in all required client fields');
      return;
    }

    // Validate each service in the list
    for (let i = 0; i < services.length; i++) {
      const s = services[i];
      const finalService = s.serviceType === 'Other' ? s.customServiceType : s.serviceType;
      if (!finalService) {
        setError(`Please specify a service type for Service #${i + 1}`);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Create or Find client first
      let clientId;
      const clients = await request('/api/clients');
      const existingClient = clients.find(
        (c: any) => c.company_name.toLowerCase().trim() === companyName.toLowerCase().trim()
      );

      if (existingClient) {
        clientId = existingClient.id;
        if (phoneNumber && existingClient.phone_number !== phoneNumber) {
          await request(`/api/clients/${clientId}`, {
            method: 'PUT',
            body: JSON.stringify({
              company_name: existingClient.company_name,
              client_name: clientName,
              phone_number: phoneNumber
            })
          });
        }
      } else {
        const newClient = await request('/api/clients', {
          method: 'POST',
          body: JSON.stringify({
            company_name: companyName,
            client_name: clientName,
            phone_number: phoneNumber
          })
        });
        clientId = newClient.id;
      }

      // 2. Loop and save each service item
      for (const s of services) {
        const finalService = s.serviceType === 'Other' ? s.customServiceType : s.serviceType;
        const payload = {
          client_id: clientId,
          date,
          service_type: finalService,
          client_or_consultant: s.clientOrConsultant,
          quotation_amount: parseFloat(s.quotationAmount) || 0,
          govt_fees: parseFloat(s.govtFees) || 0,
          prof_fees: parseFloat(s.profFees) || 0,
          advance_amount: parseFloat(s.advanceAmount) || 0,
          remark: s.remark
        };

        if (transactionId) {
          // If editing, update current transaction id
          await request(`/api/transactions/${transactionId}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
          });
        } else {
          // Otherwise, save as a new transaction row
          await request('/api/transactions', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
        }
      }

      onSave();
    } catch (err: any) {
      setError(err.message || 'Failed to save client engagements');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs">
        <div className="bg-white p-6 rounded-xl flex items-center gap-3">
          <span className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></span>
          <span className="text-xs font-semibold text-on-surface">Loading engagement details...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-4xl shadow-level-2 border border-outline-variant/30 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-slate-50 rounded-t-xl shrink-0">
          <div>
            <h2 className="text-base font-bold text-on-surface">
              {transactionId ? 'Modify Service Entry' : 'New Service Engagement(s)'}
            </h2>
            <p className="text-[10px] text-on-surface-variant">Log client details and billing particulars.</p>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors p-1">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <form onSubmit={handleSave} className="space-y-6">
            {error && (
              <div className="p-3 bg-error-container text-on-error-container border border-error/20 rounded-lg text-xs font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">warning</span>
                <span>{error}</span>
              </div>
            )}

            {/* Client Info Section */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-primary border-b border-outline-variant/30 pb-1">Client Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Company Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Stark Industries"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full rounded border border-outline-variant bg-white px-3 py-2 text-xs text-on-surface focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Primary Contact</label>
                  <input
                    type="text"
                    placeholder="Client Contact Name"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full rounded border border-outline-variant bg-white px-3 py-2 text-xs text-on-surface focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Contact Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 99999 99999"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full rounded border border-outline-variant bg-white px-3 py-2 text-xs text-on-surface focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Engagement Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded border border-outline-variant bg-white px-3 py-2 text-xs text-on-surface focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Dynamic Services List Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-outline-variant/30 pb-1">
                <h3 className="text-xs font-bold text-primary">Service Engagements</h3>
                {!transactionId && (
                  <button
                    type="button"
                    onClick={addServiceItem}
                    className="bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold px-3 py-1 rounded flex items-center gap-1 transition-colors"
                  >
                    <span className="material-symbols-outlined text-xs">add</span>
                    <span>Add Another Service</span>
                  </button>
                )}
              </div>

              <div className="space-y-6">
                {services.map((s, index) => {
                  const qVal = parseFloat(s.quotationAmount) || 0;
                  const aVal = parseFloat(s.advanceAmount) || 0;
                  const pendingVal = qVal - aVal;

                  return (
                    <div key={index} className="bg-slate-50 p-4 rounded-xl border border-outline-variant/30 space-y-4 relative">
                      {/* Row Header */}
                      <div className="flex justify-between items-center border-b border-outline-variant/20 pb-2">
                        <span className="text-[10px] font-bold text-on-surface uppercase tracking-wider">Service #{index + 1}</span>
                        {services.length > 1 && !transactionId && (
                          <button
                            type="button"
                            onClick={() => removeServiceItem(index)}
                            className="text-error hover:bg-error-container/20 p-1 rounded transition-colors"
                            title="Remove this service row"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        )}
                      </div>

                      {/* Row Inputs Part 1 */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div>
                          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Service Type</label>
                          <select
                            value={s.serviceType}
                            onChange={(e) => updateServiceItem(index, 'serviceType', e.target.value)}
                            className="w-full rounded border border-outline-variant bg-white px-3 py-2 text-xs text-on-surface focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all"
                            required
                          >
                            <option value="">Select Service...</option>
                            {STANDARD_SERVICES.map(sName => (
                              <option key={sName} value={sName}>{sName}</option>
                            ))}
                            <option value="Other">Other (Write Custom Service)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Engagement Classification</label>
                          <div className="flex border border-outline-variant rounded overflow-hidden">
                            <button
                              type="button"
                              onClick={() => updateServiceItem(index, 'clientOrConsultant', 'client')}
                              className={`flex-1 text-center py-2 text-xs font-semibold transition-colors ${s.clientOrConsultant === 'client' ? 'bg-primary text-white' : 'bg-white text-on-surface-variant hover:bg-slate-50'
                                }`}
                            >
                              Direct Client
                            </button>
                            <button
                              type="button"
                              onClick={() => updateServiceItem(index, 'clientOrConsultant', 'consultant')}
                              className={`flex-1 text-center py-2 text-xs font-semibold transition-colors ${s.clientOrConsultant === 'consultant' ? 'bg-primary text-white' : 'bg-white text-on-surface-variant hover:bg-slate-50'
                                }`}
                            >
                              Consultant
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Remarks / Internal Notes</label>
                          <input
                            type="text"
                            placeholder="e.g. Document pending, fast track, etc."
                            value={s.remark}
                            onChange={(e) => updateServiceItem(index, 'remark', e.target.value)}
                            className="w-full rounded border border-outline-variant bg-white px-3 py-2 text-xs text-on-surface focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all"
                          />
                        </div>
                      </div>

                      {/* Custom Service Input if Other is selected */}
                      {s.serviceType === 'Other' && (
                        <div className="pt-1">
                          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Custom Service Name</label>
                          <input
                            type="text"
                            placeholder="Enter custom service type..."
                            value={s.customServiceType}
                            onChange={(e) => updateServiceItem(index, 'customServiceType', e.target.value)}
                            className="w-full max-w-md rounded border border-outline-variant bg-white px-3 py-2 text-xs text-on-surface focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all"
                            required
                          />
                        </div>
                      )}

                      {/* Financial Breakdown for this Service Row */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Quotation Amount (₹)</label>
                          <input
                            type="number"
                            value={s.quotationAmount}
                            onChange={(e) => updateServiceItem(index, 'quotationAmount', e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            className="w-full rounded border border-outline-variant bg-white px-3 py-2 text-xs font-mono text-on-surface focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all"
                            required
                            min="0"
                            step="any"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Govt Fees (₹)</label>
                          <input
                            type="number"
                            value={s.govtFees}
                            onChange={(e) => updateServiceItem(index, 'govtFees', e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            className="w-full rounded border border-outline-variant bg-white px-3 py-2 text-xs font-mono text-on-surface focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all"
                            min="0"
                            step="any"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Professional Fees (₹)</label>
                          <input
                            type="number"
                            value={s.profFees}
                            readOnly
                            step="any"
                            onWheel={(e) => e.currentTarget.blur()}
                            className="w-full rounded border border-outline-variant bg-slate-150 px-3 py-2 text-xs font-mono text-on-surface-variant cursor-not-allowed focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Advance Received (₹)</label>
                          <input
                            type="number"
                            value={s.advanceAmount}
                            onChange={(e) => updateServiceItem(index, 'advanceAmount', e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            className="w-full rounded border border-outline-variant bg-white px-3 py-2 text-xs font-mono text-on-surface focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all"
                            min="0"
                            step="any"
                          />
                        </div>
                      </div>

                      {/* Live calculated field box */}
                      <div className="flex justify-end pt-1">
                        <div className="bg-primary/5 rounded border border-primary/20 px-4 py-1.5 flex justify-between items-center w-full max-w-xs h-[32px]">
                          <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">Estimated Pending Balance</span>
                          <span className={`text-xs font-bold font-mono ${pendingVal > 0 ? 'text-primary' : 'text-slate-500'}`}>
                            ₹{pendingVal.toLocaleString()}
                          </span>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-outline-variant/30 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 hover:bg-slate-50 text-on-surface-variant font-semibold text-xs rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-primary hover:bg-primary/95 text-white font-semibold text-xs px-5 py-2 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors"
              >
                {loading ? (
                  <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full"></span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">save</span>
                    <span>Save {services.length > 1 ? `${services.length} Entries` : 'Entry'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
