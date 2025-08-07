"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from './_app';
import { apiService } from '../lib/api';
import { 
  BarChart, 
  FileText, 
  TrendingUp, 
  Calendar, 
  ArrowLeft,
  Users,
  MapPin,
  AlertTriangle,
  DollarSign
} from 'lucide-react';
import Layout from '../components/Layout';
import { toast } from 'react-hot-toast';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

// Color palette
const COLORS = {
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  gray: '#6B7280'
};

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function Reports() {
  const [timeframe, setTimeframe] = useState('30days');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({
    summary: {
      totalDebts: 0,
      totalAmount: 0,
      totalPaid: 0,
      totalOutstanding: 0,
      averageDebtAmount: 0,
      averagePaymentTime: 0,
      collectionRate: 0
    },
    trends: {
      dailyIssuance: [],
      paymentTrends: [],
      overdueRate: 0
    },
    locations: {
      topLocations: [],
      locationPerformance: []
    },
    customers: {
      topCustomers: [],
      topVehicles: []
    }
  });

  const router = useRouter();
  const { user } = useAuth();

  // Fetch report data
  useEffect(() => {
    fetchReportData();
  }, [timeframe]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const response = await apiService.debts.getAll({
        limit: 1000
      });

      if (response.data.success) {
        const debts = response.data.data;
        const now = new Date();
        const timeframeInDays = {
          '7days': 7,
          '30days': 30,
          '90days': 90,
          '1year': 365,
          'all': 36500
        };

        // Filter debts by timeframe
        const filteredDebts = debts.filter(debt => {
          const debtDate = new Date(debt.createdAt.seconds * 1000);
          const daysDiff = (now - debtDate) / (1000 * 60 * 60 * 24);
          return daysDiff <= timeframeInDays[timeframe];
        });

        // Calculate metrics
        setReportData({
          summary: {
            totalDebts: filteredDebts.length,
            totalAmount: filteredDebts.reduce((sum, d) => sum + (d.amount || 0), 0),
            totalPaid: filteredDebts.reduce((sum, d) => sum + (d.paidAmount || 0), 0),
            totalOutstanding: filteredDebts.reduce((sum, d) => sum + (d.remainingAmount || 0), 0),
            averageDebtAmount: filteredDebts.length ? 
              filteredDebts.reduce((sum, d) => sum + d.amount, 0) / filteredDebts.length : 0,
            averagePaymentTime: calculateAveragePaymentTime(filteredDebts),
            collectionRate: calculateCollectionRate(filteredDebts)
          },
          trends: {
            dailyIssuance: calculateDailyIssuance(filteredDebts),
            paymentTrends: calculatePaymentTrends(filteredDebts),
            overdueRate: calculateOverdueRate(filteredDebts)
          },
          locations: calculateLocationStats(filteredDebts),
          customers: calculateCustomerStats(filteredDebts)
        });
      } else {
        throw new Error('Failed to fetch debts data');
      }
    } catch (error) {
      console.error('Error loading report data:', error);
      toast.error('Failed to load report data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Format large numbers
  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const timeframeOptions = [
    { value: '7days', label: 'Last 7 Days' },
    { value: '30days', label: 'Last 30 Days' },
    { value: '90days', label: 'Last Quarter' },
    { value: '1year', label: 'Last Year' },
    { value: 'all', label: 'All Time' }
  ];

  // Log current report data
  useEffect(() => {
    console.log('Current report data:', reportData);
  }, [reportData]);

  // Add data validation logging
  useEffect(() => {
    if (!loading) {
      const hasData = reportData.summary.totalDebts > 0 || 
                      reportData.customers.topCustomers.length > 0 ||
                      reportData.customers.topVehicles.length > 0;
      if (!hasData) {
        console.warn('No data available in reports:', reportData);
      }
    }
  }, [loading, reportData]);

  if (!user) return null;

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        {/* Modern Header with Gradient */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => router.back()}
                  className="btn-white-outline"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back</span>
                </button>
                <h1 className="text-2xl font-bold">B.I</h1>
              </div>
              
              <select 
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
              >
                {timeframeOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Stats Row */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="stat-card-light animate-pulse">
                    <div className="h-6 w-6 bg-blue-200/20 rounded" />
                    <div className="mt-2 h-4 w-20 bg-blue-200/20 rounded" />
                    <div className="mt-2 h-8 w-32 bg-blue-200/20 rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                <div className="stat-card-light">
                  <DollarSign className="h-6 w-6 text-blue-200" />
                  <p className="mt-2 text-blue-100">Total Paid Amount</p>
                  <h3 className="text-2xl font-bold">{formatCurrency(reportData.summary.totalPaid)}</h3>
                </div>
                
                <div className="stat-card-light">
                  <TrendingUp className="h-6 w-6 text-blue-200" />
                  <p className="mt-2 text-blue-100">Collection Rate</p>
                  <h3 className="text-2xl font-bold">{reportData.summary.collectionRate.toFixed(1)}%</h3>
                </div>

                <div className="stat-card-light">
                  <AlertTriangle className="h-6 w-6 text-blue-200" />
                  <p className="mt-2 text-blue-100">Overdue Rate</p>
                  <h3 className="text-2xl font-bold">{reportData.trends.overdueRate.toFixed(1)}%</h3>
                </div>

                <div className="stat-card-light">
                  <Users className="h-6 w-6 text-blue-200" />
                  <p className="mt-2 text-blue-100">Active Customers</p>
                  <h3 className="text-2xl font-bold">{formatNumber(reportData.customers.topCustomers.length)}</h3>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Payment Trends Chart */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-6">Payment Trends</h2>
              <div className="h-80">
                {reportData.trends.paymentTrends.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={reportData.trends.paymentTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Area 
                        type="monotone" 
                        dataKey="amount" 
                        stroke={COLORS.primary}
                        fill={COLORS.primary}
                        fillOpacity={0.1}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <NoDataFallback message="No payment trends data available" />
                )}
              </div>
            </div>

            {/* Location Performance */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-6">Location Performance</h2>
              <div className="space-y-4">
                {reportData.locations.topLocations.length > 0 ? (
                  reportData.locations.topLocations.map((location, index) => (
                    <div key={index} className="flex items-center">
                      <div className="w-full">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium">{location.name}</span>
                          <span className="text-sm text-gray-600">
                            {formatCurrency(location.amount)}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ 
                              width: `${location.collectionRate}%`,
                              backgroundColor: CHART_COLORS[index % CHART_COLORS.length]
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <NoDataFallback message="No location performance data available" />
                )}
              </div>
            </div>

            {/* Top Vehicles by Total Amount of Debt */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-6">Top Vehicles by Total Debt</h2>
              <div className="overflow-x-auto">
                {reportData.customers.topVehicles.length > 0 ? (
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Vehicle Plate
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Debt
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Paid Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.customers.topVehicles.map((vehicle, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                            {vehicle.vehiclePlate || 'N/A'}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-900">
                            {formatCurrency(vehicle.totalDebt)}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-900">
                            {formatCurrency(vehicle.paidAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <NoDataFallback message="No vehicle debt data available" />
                )}
              </div>
            </div>

            {/* Top Customers Table */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-6">Top Customers</h2>
              <div className="overflow-x-auto">
                {reportData.customers.topCustomers.length > 0 ? (
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Customer
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Debt
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Paid Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.customers.topCustomers.map((customer, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                            {customer.name}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-900">
                            {formatCurrency(customer.totalDebt)}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-900">
                            {formatCurrency(customer.paidAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <NoDataFallback message="No top customer data available" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES'
  }).format(amount);
}

// Replace empty charts/tables with this fallback
const NoDataFallback = ({ message }) => (
  <div className="flex flex-col items-center justify-center h-full py-12">
    <AlertTriangle className="h-12 w-12 text-gray-400 mb-4" />
    <p className="text-gray-500 text-sm">{message || 'No data available'}</p>
  </div>
);

// Helper functions
const calculateLocationStats = (debts) => {
  const locationStats = debts.reduce((acc, debt) => {
    const location = debt.store?.location || 'Unknown';
    if (!acc[location]) {
      acc[location] = { total: 0, paid: 0, count: 0 };
    }
    acc[location].total += debt.amount || 0;
    acc[location].paid += debt.paidAmount || 0;
    acc[location].count++;
    return acc;
  }, {});

  return {
    topLocations: Object.entries(locationStats)
      .map(([name, stats]) => ({
        name,
        amount: stats.total,
        paidAmount: stats.paid,
        debtCount: stats.count,
        collectionRate: stats.total ? (stats.paid / stats.total) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5),
    locationPerformance: Object.entries(locationStats)
      .map(([name, stats]) => ({
        name,
        collectionRate: stats.total ? (stats.paid / stats.total) * 100 : 0
      }))
      .sort((a, b) => b.collectionRate - a.collectionRate)
  };
};

const calculateCustomerStats = (debts) => {
  const customerStats = debts.reduce((acc, debt) => {
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

  const vehicleStats = debts.reduce((acc, debt) => {
    const vehiclePlate = debt.vehiclePlate || 'Unknown';
    if (!acc[vehiclePlate]) {
      acc[vehiclePlate] = {
        vehiclePlate,
        totalDebt: 0,
        paidAmount: 0,
        debtCount: 0
      };
    }
    acc[vehiclePlate].totalDebt += debt.amount || 0;
    acc[vehiclePlate].paidAmount += debt.paidAmount || 0;
    acc[vehiclePlate].debtCount++;
    return acc;
  }, {});

  return {
    topCustomers: Object.values(customerStats)
      .sort((a, b) => b.totalDebt - a.totalDebt)
      .slice(0, 10),
    topVehicles: Object.values(vehicleStats)
      .sort((a, b) => b.totalDebt - a.totalDebt)
      .slice(0, 10)
  };
};

// Add these calculation helper functions
const calculateAveragePaymentTime = (debts) => {
  const paidDebts = debts.filter(d => d.status === 'paid');
  if (!paidDebts.length) return 0;
  
  return paidDebts.reduce((sum, debt) => {
    const createDate = new Date(debt.createdAt.seconds * 1000);
    const paidDate = new Date(debt.lastUpdatedAt.seconds * 1000);
    return sum + (paidDate - createDate) / (1000 * 60 * 60 * 24);
  }, 0) / paidDebts.length;
};

const calculateCollectionRate = (debts) => {
  const totalAmount = debts.reduce((sum, d) => sum + (d.amount || 0), 0);
  const totalPaid = debts.reduce((sum, d) => sum + (d.paidAmount || 0), 0);
  return totalAmount ? (totalPaid / totalAmount) * 100 : 0;
};

const calculateDailyIssuance = (debts) => {
  const dailyTotals = debts.reduce((acc, debt) => {
    const date = new Date(debt.createdAt.seconds * 1000).toISOString().split('T')[0];
    acc[date] = (acc[date] || 0) + debt.amount;
    return acc;
  }, {});
  
  return Object.entries(dailyTotals)
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
};

const calculatePaymentTrends = (debts) => {
  return debts
    .filter(d => d.paidAmount > 0)
    .map(d => ({
      date: new Date(d.lastUpdatedAt.seconds * 1000).toISOString().split('T')[0],
      amount: d.paidAmount
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
};

const calculateOverdueRate = (debts) => {
  const overdueDebts = debts.filter(d => {
    const dueDate = new Date(d.dueDate.seconds * 1000);
    return dueDate < new Date() && d.status !== 'paid';
  });
  return debts.length ? (overdueDebts.length / debts.length) * 100 : 0;
};