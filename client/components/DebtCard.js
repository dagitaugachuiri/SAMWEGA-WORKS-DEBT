import { useState } from 'react';
import { CreditCard, MapPin, User, Calendar, DollarSign, MessageSquare, Send, AlertTriangle, Car } from 'lucide-react';
import { apiService } from '../lib/api';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/router';

export default function DebtCard({ debt, onPaymentClick, onRefresh, onCardClick }) {
  const [showResendModal, setShowResendModal] = useState(false);
  const router = useRouter(); // Initialize router hook

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString('en-GB');
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'paid':
        return 'text-green-600';
      case 'partially_paid':
        return 'text-yellow-600';
      case 'overdue':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'paid':
        return 'Paid';
      case 'partially_paid':
        return 'Partially Paid';
      case 'overdue':
        return 'Overdue';
      default:
        return 'Waiting Payment';
    }
  };

  const handleRequestManualPayment = async () => {
    try {
      const response = await apiService.debts.requestManualPayment(debt?.id);
      if (response.data.success) {
        toast.success('Manual payment request sent!');
        onRefresh();
      } else {
        throw new Error(response.data.error || 'Failed to request manual payment');
      }
    } catch (error) {
      console.error('Error requesting manual payment:', error);
      toast.error(error.message || 'Failed to request manual payment');
    }
  };

  const handleResendInvoiceSMS = async () => {
    try {
      setShowResendModal(false);
      const response = await apiService.debts.resendInvoiceSMS(debt?.id);
      if (response.data.success) {
        toast.success('Invoice SMS resent!');
        onRefresh();
      } else {
        throw new Error(response.data.error || 'Failed to resend invoice SMS');
      }
    } catch (error) {
      console.error('Error resending invoice SMS:', error);
      toast.error(error.message || 'Failed to resend invoice SMS');
    }
  };

  // Handle card click to navigate to debt logs page
  const handleCardClick = () => {
    router.push(`/debt-logs-page?debtId=${debt.id}`); // Navigate to static route with debtId query param
  };

  if (!debt) {
    return <div className="border rounded-lg p-4 text-sm text-gray-600">No debt data available</div>;
  }

  return (
    <>
      <div 
        className="border rounded-lg p-4 hover:shadow transition-shadow cursor-pointer"
        onClick={handleCardClick} // Use custom handler instead of onCardClick prop
      >
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-blue-600" />
            <span className={`font-mono text-sm font-bold ${debt.status === 'paid' ? 'line-through text-gray-500' : 'text-gray-900'}`}>#{debt.debtCode || 'N/A'}</span>
          </div>
          <span className={`text-sm font-medium ${getStatusClass(debt.status)}`}>
            {getStatusText(debt.status)}
          </span>
        </div>

        <div className="flex items-center gap-2 mb-1">
          <User className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium">{debt.storeOwner?.name || 'Unknown'}</span>
        </div>

        <div className="flex items-center gap-2 mb-1">
          <MapPin className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">{debt.store?.name || 'N/A'}, {debt.store?.location || 'N/A'}</span>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <Car className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">
            {debt.vehiclePlate === '' ? 'WORKSHOP DEBT' : `Vehicle: ${debt.vehiclePlate || 'N/A'}`}
          </span>
        </div>

        <div className="bg-gray-50 rounded p-2 mb-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Total:</span>
            <span className={`font-bold ${debt.status === 'paid' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
              {formatCurrency(debt.amount || 0)}
            </span>
          </div>
          {debt.paidAmount > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Paid:</span>
              <span className="font-medium text-green-600">{formatCurrency(debt.paidAmount)}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Outstanding:</span>
            <span className="font-bold text-red-600">{formatCurrency(debt.remainingAmount || 0)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">Created On: {formatTimestamp(debt.createdAt?.seconds)  || 'N/A'}</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">Due On: {formatTimestamp(debt.dueDate?.seconds)  || 'N/A'}</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <User className="h-2 w-2 text-gray-400" />
          <span className="text-xs text-gray-600">Created By {debt.createdBy || 'N/A'}</span>
        </div>
     

        {debt.status !== 'paid' && (
          <div className="flex gap-2">
            {!debt.manualPaymentRequested ? (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRequestManualPayment(); }}
                  className="flex-1 flex items-center justify-center gap-1 text-sm bg-gray-100 hover:bg-gray-200 rounded p-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Manual Payment</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowResendModal(true); }}
                  className="flex-1 flex items-center justify-center gap-1 text-sm bg-green-100 hover:bg-green-200 rounded p-2"
                >
                  <Send className="h-4 w-4" />
                  <span>Resend SMS</span>
                </button>
              </>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onPaymentClick(debt); }}
                className="w-full flex items-center justify-center gap-1 text-sm bg-blue-100 hover:bg-blue-200 rounded p-2"
              >
                <DollarSign className="h-4 w-4" />
                <span>Process Payment</span>
              </button>
            )}
          </div>
        )}
      </div>

      {showResendModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={(e) => { e.stopPropagation(); setShowResendModal(false); }}
        >
          <div 
            className="bg-white rounded p-4 max-w-sm w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-yellow-600 mb-2">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-base font-semibold">Confirm Resend SMS</h3>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Resend invoice SMS to <span className="font-medium">{debt.storeOwner?.name || 'Unknown'}</span>?
            </p>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowResendModal(false)}
                className="text-sm bg-gray-100 hover:bg-gray-200 rounded p-2"
              >
                Cancel
              </button>
              <button
                onClick={handleResendInvoiceSMS}
                className="text-sm bg-green-100 hover:bg-green-200 rounded p-2"
              >
                Resend SMS
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};