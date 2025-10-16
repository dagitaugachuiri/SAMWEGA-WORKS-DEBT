import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from './_app';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [timeReached, setTimeReached] = useState(false);

  useEffect(() => {
    // Authentication redirect logic
    if (!loading) {
      if (user) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }

    // Time check interval
    const checkTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      
      // Check if current time is 10:30 AM or later
      if (hours > 10 || (hours === 10 && minutes >= 30)) {
        setTimeReached(true);
      }
    };

    // Run check immediately and then every minute
    checkTime();
    const interval = setInterval(checkTime, 60000); // Check every minute

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, [user, loading, router]);

  // Redirect to time-reached screen if condition met
  useEffect(() => {
    if (timeReached) {
      router.push('/time-reached');
    }
  }, [timeReached, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="loading-spinner h-8 w-8 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Samwega Debt Management...</p>
        </div>
      </div>
    );
  }

  return null;
}