







import axios from 'axios';
import { auth } from './firebase';
import { toast } from 'react-hot-toast';

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
    delete: (debtId) => api.delete(`/api/debts/${debtId}`),

    // Resend invoice SMS
    resendInvoiceSMS: async (debtId) => {
      return axios.post(`${API_BASE_URL}/api/debts/${debtId}/resend-invoice-sms`);
    },

    // Trigger reconciliation
    reconcile: async () => {
      try {
        const response = await api.post('/api/debts/reconcile');
        if (response.data.success && response.data.data.totalDuplicates > 0) {
          toast.success(response.data.message, { duration: 6000 });
        }
        return response.data;
      } catch (error) {
        console.error('Error triggering reconciliation:', error);
        toast.error(error.response?.data?.error || 'Failed to perform reconciliation');
        throw error;
      }
    }
  },
 // Customer management
 customers: {
    // Get all customers
    getAll: (params = {}) => api.get('/api/customers', { params }),

    // Get specific customer by phoneNumber
    getById: (phoneNumber) => api.get(`/api/customers/${phoneNumber}`),

    // Send custom message to multiple customers
    sendCustomMessage: (data) => api.post('/api/customers/send-message', data),
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
  health: () => api.get('/health'),

  // Reports analytics using existing endpoints
  reports: {
    getAnalytics: async (timeframe) => {
      try {
        const debtsResponse = await api.get('/api/debts', {
          params: { limit: 1000 }
        });
        
        const debts = debtsResponse.data.debts || [];
        const now = new Date();
        const timeframeInDays = {
          '7days': 7,
          '30days': 30,
          '90days': 90,
          '1year': 365,
          'all': 36500 // ~100 years
        };
        
        // Filter debts by timeframe
        const filteredDebts = debts.filter(debt => {
          const debtDate = new Date(debt.createdAt.seconds * 1000);
          const daysDiff = (now - debtDate) / (1000 * 60 * 60 * 24);
          return daysDiff <= timeframeInDays[timeframe];
        });

        // Calculate summary metrics
        const summary = {
          totalDebts: filteredDebts.length,
          totalAmount: filteredDebts.reduce((sum, d) => sum + (d.amount || 0), 0),
          totalPaid: filteredDebts.reduce((sum, d) => sum + (d.paidAmount || 0), 0),
          totalOutstanding: filteredDebts.reduce((sum, d) => sum + (d.remainingAmount || 0), 0),
          averageDebtAmount: filteredDebts.length ? 
            filteredDebts.reduce((sum, d) => sum + d.amount, 0) / filteredDebts.length : 0,
          averagePaymentTime: calculateAveragePaymentTime(filteredDebts),
          collectionRate: calculateCollectionRate(filteredDebts)
        };

        // Location analysis
        const locationStats = filteredDebts.reduce((acc, debt) => {
          const location = debt.store?.location || 'Unknown';
          if (!acc[location]) {
            acc[location] = { total: 0, paid: 0, count: 0 };
          }
          acc[location].total += debt.amount || 0;
          acc[location].paid += debt.paidAmount || 0;
          acc[location].count++;
          return acc;
        }, {});

        // Customer analysis
        const customerStats = filteredDebts.reduce((acc, debt) => {
          const customerId = debt.storeOwner?.phoneNumber || 'unknown';
          if (!acc[customerId]) {
            acc[customerId] = {
              name: debt.storeOwner?.name || 'Unknown',
              totalDebt: 0,
              paidAmount: 0,
              debtCount: 0
            };
          }
          acc[customerId].totalDebt += debt.amount || 0;
          acc[customerId].paidAmount += debt.paidAmount || 0;
          acc[customerId].debtCount++;
          return acc;
        }, {});

        // Calculate trends
        const trends = {
          dailyIssuance: calculateDailyIssuance(filteredDebts),
          paymentTrends: calculatePaymentTrends(filteredDebts),
          overdueRate: calculateOverdueRate(filteredDebts)
        };

        return {
          success: true,
          data: {
            summary,
            trends,
            locations: {
              topLocations: Object.entries(locationStats)
                .map(([name, stats]) => ({
                  name,
                  amount: stats.total,
                  paidAmount: stats.paid,
                  debtCount: stats.count,
                  collectionRate: (stats.paid / stats.total) * 100
                }))
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 5),
              locationPerformance: Object.entries(locationStats)
                .map(([name, stats]) => ({
                  name,
                  collectionRate: (stats.paid / stats.total) * 100
                }))
                .sort((a, b) => b.collectionRate - a.collectionRate)
            },
            customers: {
              topCustomers: Object.values(customerStats)
                .sort((a, b) => b.totalDebt - a.totalDebt)
                .slice(0, 10),
              customerCategories: categorizeCustomers(customerStats)
            }
          }
        };
      } catch (error) {
        console.error('Error generating reports:', error);
        throw error;
      }
    },

    // Add PDF generation method
    generatePDF: async (reportType, timeframe) => {
      try {
        // Get analytics data first
        const analytics = await apiService.reports.getAnalytics(timeframe);
        
        // Format data based on report type
        const reportData = {
          reportType,
          timeframe,
          generatedAt: new Date().toISOString(),
          data: analytics.data[reportType] || analytics.data,
        };

        // Generate HTML content
        const htmlContent = generateReportHTML(reportData);

        // Convert to blob
        const blob = new Blob([htmlContent], { type: 'text/html' });
        
        return {
          success: true,
          data: blob,
          filename: `${reportType}-report-${timeframe}.html`
        };
      } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
      }
    }
  }
};

// Helper function to generate HTML report
function generateReportHTML(reportData) {
  const { reportType, timeframe, generatedAt, data } = reportData;

  let contentHTML = '';
  
  // Generate content based on report type
  switch (reportType) {
    case 'trends':
      contentHTML = `
        <h2>Payment Trends Report</h2>
        <p>Time Period: ${timeframe}</p>
        <div class="trends">
          ${data.paymentTrends.map(trend => `
            <div class="trend-item">
              <span>${trend.date}</span>
              <span>${formatCurrency(trend.amount)}</span>
            </div>
          `).join('')}
        </div>
      `;
      break;

    case 'locations':
      contentHTML = `
        <h2>Location Performance Report</h2>
        <p>Time Period: ${timeframe}</p>
        <div class="locations">
          ${data.topLocations.map(loc => `
            <div class="location-item">
              <h3>${loc.name}</h3>
              <p>Total Amount: ${formatCurrency(loc.amount)}</p>
              <p>Collection Rate: ${loc.collectionRate.toFixed(1)}%</p>
            </div>
          `).join('')}
        </div>
      `;
      break;

    case 'customers':
      contentHTML = `
        <h2>Customer Analysis Report</h2>
        <p>Time Period: ${timeframe}</p>
        <div class="customers">
          <h3>Top Customers</h3>
          <table>
            <tr>
              <th>Name</th>
              <th>Total Debt</th>
              <th>Paid Amount</th>
            </tr>
            ${data.topCustomers.map(customer => `
              <tr>
                <td>${customer.name}</td>
                <td>${formatCurrency(customer.totalDebt)}</td>
                <td>${formatCurrency(customer.paidAmount)}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      `;
      break;

    default:
      contentHTML = `
        <h2>Summary Report</h2>
        <p>Time Period: ${timeframe}</p>
        <div class="summary">
          <p>Total Debts: ${data.summary.totalDebts}</p>
          <p>Total Amount: ${formatCurrency(data.summary.totalAmount)}</p>
          <p>Collection Rate: ${data.summary.collectionRate.toFixed(1)}%</p>
        </div>
      `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${reportType} Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px; border: 1px solid #ddd; }
        th { background-color: #f5f5f5; }
        .report-header { margin-bottom: 20px; }
        .generated-at { color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="report-header">
        <h1>Samwega Debt Management System</h1>
        <p class="generated-at">Generated on: ${new Date(generatedAt).toLocaleString()}</p>
      </div>
      ${contentHTML}
    </body>
    </html>
  `;
}

// Helper functions for calculations
function calculateAveragePaymentTime(debts) {
  const paidDebts = debts.filter(d => d.status === 'paid');
  if (!paidDebts.length) return 0;
  
  return paidDebts.reduce((sum, debt) => {
    const createDate = new Date(debt.createdAt.seconds * 1000);
    const paidDate = new Date(debt.lastUpdatedAt.seconds * 1000);
    return sum + (paidDate - createDate) / (1000 * 60 * 60 * 24);
  }, 0) / paidDebts.length;
}

function calculateCollectionRate(debts) {
  const totalAmount = debts.reduce((sum, d) => sum + (d.amount || 0), 0);
  const totalPaid = debts.reduce((sum, d) => sum + (d.paidAmount || 0), 0);
  return totalAmount ? (totalPaid / totalAmount) * 100 : 0;
}

function calculateDailyIssuance(debts) {
  const dailyTotals = debts.reduce((acc, debt) => {
    const date = new Date(debt.createdAt.seconds * 1000).toISOString().split('T')[0];
    acc[date] = (acc[date] || 0) + debt.amount;
    return acc;
  }, {});
  
  return Object.entries(dailyTotals)
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function calculatePaymentTrends(debts) {
  return debts
    .filter(d => d.paidAmount > 0)
    .map(d => ({
      date: new Date(d.lastUpdatedAt.seconds * 1000).toISOString().split('T')[0],
      amount: d.paidAmount
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function calculateOverdueRate(debts) {
  const overdueDebts = debts.filter(d => {
    const dueDate = new Date(d.dueDate.seconds * 1000);
    return dueDate < new Date() && d.status !== 'paid';
  });
  return debts.length ? (overdueDebts.length / debts.length) * 100 : 0;
}

function categorizeCustomers(customerStats) {
  return Object.values(customerStats).reduce((acc, customer) => {
    const category = 
      customer.totalDebt > 100000 ? 'high_value' :
      customer.totalDebt > 50000 ? 'medium_value' : 'low_value';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
}

export default apiService;