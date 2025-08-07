import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { apiService } from '../lib/api';
import { toast } from 'react-hot-toast';

export default function CreateDebtModal({ onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [vehicles, setVehicles] = useState(["KDK 123M"]); // Add state for vehicles

  // Fetch vehicles when component mounts


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Collect form data
      const formData = new FormData(e.target);
      const debtData = {
        storeOwner: {
          name: formData.get('storeOwnerName'),
          phoneNumber: formData.get('phoneNumber'),
          email: formData.get('email') || '',
        },
        vehiclePlate: formData.get('vehiclePlate'), // Add vehicle plate
        store: {
          name: formData.get('storeName'),
          location: formData.get('location'),
        },
        amount: Number(formData.get('amount')),
        dateIssued: formData.get('dateIssued') || new Date().toISOString().split('T')[0], // Fallback to today
        dueDate: formData.get('dueDate'),
        paymentMethod: formData.get('paymentMethod'),
        description: formData.get('description') || '',
      };

      // Validate phone number format
      if (!/^\+254[17]\d{8}$/.test(debtData.storeOwner.phoneNumber)) {
        throw new Error('Phone number must be in format +254XXXXXXXXX (starting with +2541 or +2547)');
      }

      // Validate dateIssued and dueDate
      if (!debtData.dateIssued) {
        throw new Error('Date issued is required');
      }
      if (new Date(debtData.dueDate) < new Date(debtData.dateIssued)) {
        throw new Error('Due date must be on or after date issued');
      }

      // Log request body for debugging
      console.log('Debt data:', JSON.stringify(debtData, null, 2));

      // Send POST request using apiService
      const response = await apiService.debts.create(debtData);

      if (response.data.success) {
        toast.success('Debt created successfully');
        onSuccess(response.data.data);
        onClose();
      } else {
        throw new Error(response.data.error || 'Failed to create debt');
      }
    } catch (err) {
      console.error('Debt creation error:', err.message);
      setError(err.message);
      toast.error(err.message || 'Failed to create debt');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Create New Debt</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Add Vehicle Plate selection before store details */}
          

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Store Owner Name
              </label>
              <input
                type="text"
                name="storeOwnerName"
                required
                minLength="2"
                maxLength="100"
                className="input-field"
                placeholder="Enter store owner name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                name="phoneNumber"
                required
                pattern="\+254[17][0-9]{8}"
                className="input-field"
                placeholder="+254712345678"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email (Optional)
              </label>
              <input
                type="email"
                name="email"
                className="input-field"
                placeholder="Enter email"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Store Name
              </label>
              <input
                type="text"
                name="storeName"
                required
                minLength="2"
                maxLength="100"
                className="input-field"
                placeholder="Enter store name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location
              </label>
              <input
                type="text"
                name="location"
                required
                minLength="2"
                maxLength="100"
                className="input-field"
                placeholder="Enter location"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount (KES)
              </label>
              <input
                type="number"
                name="amount"
                required
                min="1"
                max="10000000"
                className="input-field"
                placeholder="0"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date Issued
              </label>
              <input
                type="date"
                name="dateIssued"
                required
                max={new Date().toISOString().split('T')[0]}
                defaultValue={new Date().toISOString().split('T')[0]}
                className="input-field"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date
              </label>
              <input
                type="date"
                name="dueDate"
                required
                min={ new Date().toISOString().split('T')[0]}
                className="input-field"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method
              </label>
              <select name="paymentMethod" required className="select-field">
                <option value="">Select payment method</option>
                <option value="mpesa">M-Pesa</option>
                <option value="bank">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
              <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vehicle Plate Number *
              </label>
              <select 
                name="vehiclePlate"
                required
                className="select-field"
              >
                <option value="">Select vehicle</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.plateNumber}>
                    {vehicle.plateNumber} - {vehicle.model}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (Optional)
              </label>
              <textarea
                name="description"
                maxLength="500"
                className="input-field"
                placeholder="Enter description"
              />
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
              disabled={loading}
              className="btn-primary flex-1"
            >
              {loading ? 'Creating...' : 'Create Debt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}