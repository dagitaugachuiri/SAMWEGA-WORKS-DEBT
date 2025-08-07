import { useState } from 'react';
import { CreditCard, MapPin, User, Calendar, DollarSign, MessageSquare, Send, AlertTriangle, Car } from 'lucide-react';
import { apiService } from '../lib/api';
import { toast } from 'react-hot-toast';

export default function DebtCard({ debt, onPaymentClick, onRefresh, onCardClick }) {
  const [showResendModal, setShowResendModal] = useState(false);
  
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
        return 'status-paid';
      case 'partially_paid':
        return 'status-partially-paid';
      case 'overdue':
        return 'status-overdue';
      default:
        return 'status-pending';
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
        return 'Pending';
    }
  };

  const handleRequestManualPayment = async () => {
    try {
      const response = await apiService.debts.requestManualPayment(debt.id);
      if (response.data.success) {
        toast.success('Manual payment request sent successfully!');
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
      const response = await apiService.debts.resendInvoiceSMS(debt.id);
      if (response.data.success) {
        toast.success('Invoice SMS resent successfully!');
        onRefresh();
      } else {
        throw new Error(response.data.error || 'Failed to resend invoice SMS');
      }
    } catch (error) {
      console.error('Error resending invoice SMS:', error);
      toast.error(error.message || 'Failed to resend invoice SMS');
    }
  };

  return (
    <>
      <div 
        className="card hover:shadow-medium transition-shadow duration-200 cursor-pointer"
        onClick={() => onCardClick(debt)}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5 text-primary-600" />
            <span className="font-mono text-sm font-bold text-gray-900">
              #{debt.debtCode}
            </span>
          </div>
          <span className={getStatusClass(debt.status)}>
            {getStatusText(debt.status)}
          </span>
        </div>

        {/* Store Owner */}
        <div className="flex items-center space-x-2 mb-2">
          <User className="h-4 w-4 text-gray-400" />
          <span className="font-medium text-gray-900">{debt.storeOwner.name}</span>
        </div>

        {/* Store Info */}
        <div className="flex items-center space-x-2 mb-2">
          <MapPin className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">
            {debt.store.name}, {debt.store.location}
          </span>
        </div>

        {/* Vehicle Plate */}
        <div className="flex items-center space-x-2 mb-3">
          <Car className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">
            Vehicle: {debt.vehiclePlate || 'N/A'}
          </span>
        </div>

        {/* Amount Info */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Total Amount:</span>
            <span className="font-bold text-gray-900">
              {formatCurrency(debt.amount)}
            </span>
          </div>
          
          {debt.paidAmount > 0 && (
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Paid:</span>
              <span className="font-medium text-success-600">
                {formatCurrency(debt.paidAmount)}
              </span>
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Outstanding:</span>
            <span className="font-bold text-danger-600">
              {formatCurrency(debt.remainingAmount || 0)}
            </span>
          </div>
        </div>

        {/* Due Date */}
        <div className="flex items-center space-x-2 mb-4">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">
            Due: {formatTimestamp(debt.dueDate.seconds)}
          </span>
        </div>

        {/* Actions */}
        {debt.status !== 'paid' && (
          <div>
            {!debt.manualPaymentRequested ? (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRequestManualPayment(); }}
                  className="btn-secondary flex-1 flex items-center justify-center my-4 space-x-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Request Manual Payment</span>
                </button>
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setShowResendModal(true); 
                  }}
                  className="btn-success flex-1 flex items-center justify-center space-x-2"
                >
                  <Send className="h-4 w-4" />
                  <span>Resend SMS</span>
                </button>
              </>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onPaymentClick(debt); }}
                className="btn-primary w-full flex items-center justify-center space-x-2"
              >
                <DollarSign className="h-4 w-4" />
                <span>Process Payment</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Resend SMS Confirmation Modal */}
      {showResendModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            e.stopPropagation();
            setShowResendModal(false);
          }}
        >
          <div 
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center space-x-2 text-warning-600 mb-4">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-semibold">Confirm Resend SMS</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to resend the invoice SMS to{' '}
              <span className="font-medium text-gray-900">{debt.storeOwner.name}</span>?
            </p>

            <div className="flex items-center space-x-3 justify-end">
              <button
                onClick={() => setShowResendModal(false)}
                className="btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={handleResendInvoiceSMS}
                className="btn-success"
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