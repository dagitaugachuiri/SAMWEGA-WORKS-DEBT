import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { apiService } from '../lib/api'; // Assuming this is where apiService is located

export default function PaymentModal({ debt, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const chequeDetailsRef = useRef(null);
  const mpesaDetailsRef = useRef(null);
  const bankDetailsRef = useRef(null);

  useEffect(() => {
    const chequeDetails = chequeDetailsRef.current;
    const mpesaDetails = mpesaDetailsRef.current;
    const bankDetails = bankDetailsRef.current;

    if (chequeDetails && mpesaDetails && bankDetails) {
      chequeDetails.classList.toggle('hidden', paymentMethod !== 'cheque');
      mpesaDetails.classList.toggle('hidden', paymentMethod !== 'mpesa');
      bankDetails.classList.toggle('hidden', paymentMethod !== 'bank');
    }
  }, [paymentMethod]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData(e.target);
      const paymentData = {
        amount: parseFloat(formData.get('amount')),
        paymentMethod: formData.get('paymentMethod'),
        phoneNumber: formData.get('phoneNumber') || debt.storeOwner.phoneNumber,
        ...(formData.get('paymentMethod') === 'cheque' && {
          chequeNumber: formData.get('chequeNumber'),
          bankName: formData.get('bankName'),
          chequeDate: formData.get('chequeDate') || new Date().toISOString(),
        }),
        ...(formData.get('paymentMethod') === 'bank' && {
          bankName: formData.get('bankName'),
        }),
      };

      console.log('Submitting payment for debt:', debt.id, paymentData);

      const response = await apiService.debts.processPayment(debt.id, paymentData);
      console.log('Payment response:', response.data);

      if (response.data.success) {
        onSuccess();
        onClose();
      } else {
        setError(response.data.error || 'Failed to process payment');
      }
    } catch (err) {
      console.error('Payment error:', err.response?.data || err.message);
      setError(err.response?.data?.error || 'An error occurred while processing payment');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Process Payment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">Debt #{debt.debtCode}</p>
          <p className="font-medium">{debt.storeOwner.name}</p>
          <p className="text-sm text-gray-600">
            Outstanding: {formatCurrency(debt.remainingAmount || debt.amount)}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Amount (KES)
              </label>
              <input
                type="number"
                name="amount"
                required
                min="1"
                max={debt.remainingAmount || debt.amount}
                className="input-field w-full p-2 border rounded"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method
              </label>
              <select
                name="paymentMethod"
                required
                className="select-field w-full p-2 border rounded"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="">Select payment method</option>
                <option value="mpesa">M-Pesa</option>
                <option value="bank">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
              </select>
            </div>

            <div ref={mpesaDetailsRef} className="mpesa-details hidden" data-payment-method="mpesa">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                name="phoneNumber"
                className="input-field w-full p-2 border rounded"
                placeholder="+254XXXXXXXXX"
                defaultValue={debt.storeOwner.phoneNumber}
                required={paymentMethod === 'mpesa'}
              />
            </div>

            <div ref={bankDetailsRef} className="bank-details hidden" data-payment-method="bank">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bank Name
              </label>
              <input
                type="text"
                name="bankName"
                className="input-field w-full p-2 border rounded"
                placeholder="Enter bank name"
                required={paymentMethod === 'bank'}
              />
            </div>

            <div ref={chequeDetailsRef} className="cheque-details hidden" data-payment-method="cheque">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cheque Number
                </label>
                <input
                  type="text"
                  name="chequeNumber"
                  className="input-field w-full p-2 border rounded"
                  placeholder="Enter cheque number"
                  required={paymentMethod === 'cheque'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  name="bankName"
                  className="input-field w-full p-2 border rounded"
                  placeholder="Enter bank name"
                  required={paymentMethod === 'cheque'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cheque Date
                </label>
                <input
                  type="date"
                  name="chequeDate"
                  className="input-field w-full p-2 border rounded"
                  required={paymentMethod === 'cheque'}
                />
              </div>
            </div>
          </div>

          <div className="flex space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 p-2 border rounded text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-success flex-1 p-2 bg-green-600 text-white rounded"
            >
              {loading ? 'Processing...' : 'Process Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}