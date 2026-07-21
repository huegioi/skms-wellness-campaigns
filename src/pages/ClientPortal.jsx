import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building } from 'lucide-react';
import ClientPortalCore from '@/components/portal/ClientPortalCore';
import { PortalError } from '@/components/portal/PortalShell';

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
    <PortalError
      icon={Building}
      iconClass="w-16 h-16 text-gray-300"
      heading="Welcome!"
      message="Your client portal is being set up. Please contact us if you believe this is an error."
    />
  );
}