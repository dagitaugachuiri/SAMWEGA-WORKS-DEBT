 
// components/DebtDetailModal.jsx
import { Send, X } from 'lucide-react';
import { useState } from 'react';
import { apiService } from '../lib/api';
import { toast } from 'react-hot-toast';

export default function DebtDetailModal({ 
  selectedDebt, 
  onClose, 
  formatCurrency, 
  formatTimestamp,
  onRefresh 
}) {
  const [sendingSMS, setSendingSMS] = useState(false);

  const handleResendSMS = async () => {
    if (sendingSMS || selectedDebt.status === 'paid') return;
    
    setSendingSMS(true);
    try {
      const response = await apiService.debts.resendInvoiceSMS(selectedDebt.id);
      if (response.data.success) {
        toast.success('Invoice SMS resent successfully!');
        onRefresh();
      }
    } catch (error) {
      toast.error('Failed to resend invoice SMS');
    } finally {
      setSendingSMS(false);
    }
  };

  if (!selectedDebt) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-3xl shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Debt Details</h2>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-lg mb-3 text-gray-700">Debt Information</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Code:</strong> #{selectedDebt.debtCode}</p>
              <p><strong>Status:</strong> <span className={`inline-block px-2 py-1 rounded ${
                selectedDebt.status === 'paid' ? 'bg-green-100 text-green-800' : 
                selectedDebt.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                'bg-red-100 text-red-800'
              }`}>{selectedDebt.status}</span></p>
              <p><strong>Total Amount:</strong> {formatCurrency(selectedDebt.amount)}</p>
              <p><strong>Paid:</strong> {formatCurrency(selectedDebt.paidAmount || 0)}</p>
              <p><strong>Outstanding:</strong> {formatCurrency(selectedDebt.remainingAmount || 0)}</p>
              <p><strong>Due Date:</strong> {formatTimestamp(selectedDebt.dueDate?.seconds)}</p>
              <p><strong>Created At:</strong> {formatTimestamp(selectedDebt.createdAt?.seconds)}</p>
              <p><strong>Last Updated:</strong> {formatTimestamp(selectedDebt.lastUpdatedAt?.seconds)}</p>
              <p><strong>Last SMS Sent:</strong> {
                selectedDebt.lastInvoiceSMSSent 
                  ? formatTimestamp(selectedDebt.lastInvoiceSMSSent.seconds)
                  : 'Not sent yet'
              }</p>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-lg mb-3 text-gray-700">Store Information</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Name:</strong> {selectedDebt.store?.name}</p>
              <p><strong>Location:</strong> {selectedDebt.store?.location}</p>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg md:col-span-2">
            <h3 className="font-semibold text-lg mb-3 text-gray-700">Owner Information</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Name:</strong> {selectedDebt.storeOwner?.name}</p>
              <p><strong>Email:</strong> {selectedDebt.storeOwner?.email}</p>
              <p><strong>Phone:</strong> {selectedDebt.storeOwner?.phoneNumber}</p>
            </div>
          </div>

          {selectedDebt.vehiclePlate && (
            <div className="bg-gray-50 p-4 rounded-lg md:col-span-2">
              <h3 className="font-semibold text-lg mb-3 text-gray-700">Vehicle Information</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Plate Number:</strong> {selectedDebt.vehiclePlate}</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          {selectedDebt.status !== 'paid' && (
            <button
              onClick={handleResendSMS}
              disabled={sendingSMS}
              className="btn-outline flex items-center space-x-2"
            >
              <Send className="h-4 w-4" />
              <span>{sendingSMS ? 'Sending...' : 'Resend Invoice SMS'}</span>
            </button>
          )}
          <button
            className="btn-primary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}