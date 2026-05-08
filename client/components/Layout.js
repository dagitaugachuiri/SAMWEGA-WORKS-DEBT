import Head from 'next/head';
import { useEffect, useState } from 'react';
import { apiService } from '../lib/api';

export default function Layout({ children, title = 'Samwega Debt Management', userId }) {
  const [isDisabled, setIsDisabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkUserStatus = async () => {
      if (userId) {
        try {
          const response = await apiService.users.getMe();
          if (response.data.success) {
            const userData = response.data.data;
            setIsDisabled(userData.disabled || false);
          }
        } catch (error) {
          console.error('Error checking user status:', error);
        }
      }
      setIsLoading(false);
    };

    checkUserStatus();
  }, [userId]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (isDisabled) {
    return (
      <>
        <Head>
          <title>{title}</title>
          <meta name="description" content="Samwega Works Ltd. Debt Management System" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h1 className="text-2xl font-bold text-red-600">Account Disabled</h1>
            <p className="mt-2 text-gray-600">Your account has been disabled. Please contact support for assistance.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Samwega Works Ltd. Debt Management System" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      {children}
    </>
  );
}