import { CreditCard, MapPin, User, Calendar, DollarSign, MessageSquare } from 'lucide-react';
import { apiService } from '../lib/api';
import { toast } from 'react-hot-toast';

export default function DebtCard({ debt, onPaymentClick, onRefresh }) {
  console.log('DebtCard rendered with debt:', debt);
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-GB');
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
        onRefresh(); // Refresh debts to update manualPaymentRequested
      } else {
        throw new Error(response.data.error || 'Failed to request manual payment');
      }
    } catch (error) {
      console.error('Error requesting manual payment:', error);
      toast.error(error.message || 'Failed to request manual payment');
    }
  };

  return (
    <div className="card hover:shadow-medium transition-shadow duration-200">
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
      <div className="flex items-center space-x-2 mb-3">
        <MapPin className="h-4 w-4 text-gray-400" />
        <span className="text-sm text-gray-600">
          {debt.store.name}, {debt.store.location}
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
            {formatCurrency(debt.remainingAmount || debt.amount)}
          </span>
        </div>
      </div>

      {/* Due Date */}
      <div className="flex items-center space-x-2 mb-4">
        <Calendar className="h-4 w-4 text-gray-400" />
        <span className="text-sm text-gray-600">
          Due: {formatDate(debt.dueDate)}
        </span>
      </div>

      {/* Actions */}
      {debt.status !== 'paid' && (
        <div className="space-y-2">
          {!debt.manualPaymentRequested ? (
            <button
              onClick={handleRequestManualPayment}
              className="btn-secondary w-full flex items-center justify-center space-x-2"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Request Manual Payment</span>
            </button>
          ) : (
            <button
              onClick={() => onPaymentClick(debt)}
              className="btn-primary w-full flex items-center justify-center space-x-2"
            >
              <DollarSign className="h-4 w-4" />
              <span>Process Payment</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}