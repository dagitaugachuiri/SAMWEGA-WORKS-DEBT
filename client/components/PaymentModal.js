// import { useState } from 'react';
// import { X } from 'lucide-react';

export default function PaymentModal({ debt, onClose, onSuccess }) {
  // const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // setLoading(true);
    setTimeout(() => {
      // setLoading(false);
      onSuccess();
    }, 1000);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Process Payment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            {/* <X className="h-5 w-5" /> */}
          </button>
        </div>
        
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">Debt #{debt.sixDigitCode}</p>
          <p className="font-medium">{debt.storeOwner.name}</p>
          <p className="text-sm text-gray-600">Outstanding: {formatCurrency(debt.remainingAmount || debt.amount)}</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Amount (KES)
              </label>
              <input
                type="number"
                required
                min="1"
                max={debt.remainingAmount || debt.amount}
                className="input-field"
                placeholder="0"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method
              </label>
              <select required className="select-field">
                <option value="">Select payment method</option>
                <option value="mpesa">M-Pesa</option>
                <option value="bank">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>
          
          <div className="flex space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              // disabled={loading}
              className="btn-success flex-1"
            >
              {loading ? 'Processing...' : 'Process Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
