import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Building, LogOut } from 'lucide-react';

export default function MyPortal() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: tokenData } = useQuery({
    queryKey: ['myClientPortalToken', user?.email],
    queryFn: async () => {
      try {
        const res = await base44.functions.invoke('getMyClientPortalToken', {});
        return res.data;
      } catch (e) {
        if (e?.response?.status === 404 || e?.response?.status === 401) return null;
        throw e;
      }
    },
    enabled: !!user?.email
  });

  // Redirect to the tokened client portal once we have a token
  useEffect(() => {
    if (tokenData?.portal_token) {
      window.location.href = `/ClientPortal?token=${tokenData.portal_token}`;
    }
  }, [tokenData?.portal_token]);

  // Still resolving or about to redirect — show loading spinner
  if (tokenData === undefined || tokenData?.portal_token) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#770142] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your portal...</p>
        </div>
      </div>
    );
  }

  // tokenData is null — no client matched
  return (
    <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
        <Building className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome!</h2>
        <p className="text-gray-600 mb-4">
          Your client portal is being set up. Please contact us if you believe this is an error.
        </p>
        <p className="text-sm text-gray-500 mb-6">Logged in as: {user?.email}</p>
        <Button variant="outline" onClick={() => base44.auth.logout()}>
          <LogOut className="w-4 h-4 mr-2" /> Sign Out
        </Button>
      </div>
    </div>
  );
}