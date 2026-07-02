import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building } from 'lucide-react';
import ClientPortalCore from '@/components/portal/ClientPortalCore';

export default function ClientPortal() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const clientId = searchParams.get('clientId');

  if (token) {
    return <ClientPortalCore mode="client" token={token} />;
  }

  if (clientId) {
    return <ClientPortalCore mode="admin" clientId={clientId} />;
  }

  // No credential — show the "portal being set up" card
  return (
    <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
        <Building className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome!</h2>
        <p className="text-gray-600 mb-4">
          Your client portal is being set up. Please contact us if you believe this is an error.
        </p>
      </div>
    </div>
  );
}