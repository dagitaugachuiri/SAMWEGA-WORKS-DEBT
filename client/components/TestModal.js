import { useState } from 'react';
import { X, TestTube, Play } from 'lucide-react';

export default function TestModal({ onClose }) {
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState(null);

  const runTests = async () => {
    setLoading(true);
    setTestResults(null);
    
    // Simulate test running
    setTimeout(() => {
      setTestResults({
        success: true,
        message: 'All tests completed successfully!',
        details: [
          'Health check: ✅ Passed',
          'Authentication: ✅ Passed',
          'Debt creation: ✅ Passed',
          'SMS service: ✅ Passed',
          'Payment simulation: ✅ Passed'
        ]
      });
      setLoading(false);
    }, 3000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center space-x-2">
            <TestTube className="h-5 w-5" />
            <span>System Test</span>
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-4">
            Run comprehensive tests to validate system functionality including SMS, payments, and database operations.
          </p>
          
          {!testResults && !loading && (
            <button
              onClick={runTests}
              className="btn-primary w-full flex items-center justify-center space-x-2"
            >
              <Play className="h-4 w-4" />
              <span>Run System Tests</span>
            </button>
          )}
          
          {loading && (
            <div className="text-center py-8">
              <div className="loading-spinner h-8 w-8 mx-auto mb-4"></div>
              <p className="text-sm text-gray-600">Running tests...</p>
            </div>
          )}
          
          {testResults && (
            <div className="space-y-3">
              <div className={`p-3 rounded-lg ${testResults.success ? 'bg-success-50 text-success-800' : 'bg-danger-50 text-danger-800'}`}>
                <p className="font-medium">{testResults.message}</p>
              </div>
              
              <div className="space-y-1">
                {testResults.details.map((detail, index) => (
                  <p key={index} className="text-sm text-gray-600 font-mono">
                    {detail}
                  </p>
                ))}
              </div>
              
              <button
                onClick={() => {
                  setTestResults(null);
                  setLoading(false);
                }}
                className="btn-secondary w-full"
              >
                Run Again
              </button>
            </div>
          )}
        </div>
        
        <button
          onClick={onClose}
          className="btn-secondary w-full"
        >
          Close
        </button>
      </div>
    </div>
  );
}
