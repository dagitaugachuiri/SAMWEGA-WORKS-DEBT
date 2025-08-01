import axios from 'axios';
import { auth } from './firebase';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    try {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      auth.signOut();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API methods
export const apiService = {
  // Debt management
  debts: {
    // Get all debts
    getAll: (params = {}) => api.get('/api/debts', { params }),
    
    // Get specific debt
    getById: (id) => api.get(`/api/debts/${id}`),
    
    // Create new debt
    create: (debtData) => api.post('/api/debts', debtData),
    
    // Process payment
    processPayment: (debtId, paymentData) => 
      api.post(`/api/debts/${debtId}/payment`, paymentData),
    
    // Request manual payment approval
    requestManualPayment: (debtId) => api.post(`/api/debts/${debtId}/manual-request`, {}),
    
    // Update debt status
    updateStatus: (debtId, statusData) => 
      api.patch(`/api/debts/${debtId}/status`, statusData),
    
    // Delete debt
    delete: (debtId) => api.delete(`/api/debts/${debtId}`)
  },

  // Payment management
  payments: {
    // Get processor status
    getProcessorStatus: () => api.get('/api/payments/processor/status'),
    
    // Check specific debt
    checkDebt: (debtCode) => api.post('/api/payments/processor/check-debt', { debtCode })
  },

  // Test endpoints
  test: {
    // Test SMS
    sendSMS: (smsData) => api.post('/api/test/sms', smsData),
    
    // Simulate payment
    simulatePayment: (paymentData) => 
      api.post('/api/test/simulate-payment', paymentData),
    
    // Complete workflow test
    testWorkflow: () => api.post('/api/test/workflow'),
    
    // Health check
    health: () => api.get('/api/test/health')
  },

  // System health
  health: () => api.get('/health')
};

export default apiService;