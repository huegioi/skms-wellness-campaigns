import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, AlertCircle } from 'lucide-react';

export default function SpeakerPortalRedirect() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: portalData } = useQuery({
    queryKey: ['myPresenterPortalId', user?.email],
    queryFn: async () => {
      try {
        const res = await base44.functions.invoke('getMyPresenterPortalId', {});
        return res.data;
      } catch (e) {
        if (e?.response?.status === 404 || e?.response?.status === 401) return null;
        throw e;
      }
    },
    enabled: !!user?.email
  });

  useEffect(() => {
    if (portalData?.portal_id) {
      window.location.href = `/PresenterPortal?id=${portalData.portal_id}`;
    }
  }, [portalData?.portal_id]);

  // Still resolving or about to redirect
  if (portalData === undefined || portalData?.portal_id) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#013f7c]" />
      </div>
    );
  }

  // No presenter found
  return (
    <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">No Presenter Profile Found</h2>
        <p className="text-gray-600">
          No presenter profile found for {user?.email} — contact SKMS Wellness.
        </p>
      </div>
    </div>
  );
}