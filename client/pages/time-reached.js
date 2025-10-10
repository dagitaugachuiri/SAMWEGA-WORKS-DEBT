import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function TimeReached() {
  const router = useRouter();

 

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="text-center p-10 bg-white rounded-xl shadow-lg max-w-lg w-full transform transition-all duration-300">
        {/* SVG Graphic: Stylized Clock */}
        <div className="mb-6 flex justify-center">
          <svg
            className="w-16 h-16 text-blue-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-semibold text-gray-900 mb-4">
          End of Shift
        </h1>
      
        <p className="text-sm text-gray-500">
          You will be redirected to the login page shortly.
        </p>
      </div>
    </div>
  );
}