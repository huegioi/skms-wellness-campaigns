import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, RefreshCw, ExternalLink, Users, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export default function JourneyAdminCard({ client }) {
  const [journey, setJourney] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const journeys = await base44.entities.MfsJourney.filter({ client_id: client.id }, '-created_date', 1);
      if (!journeys || journeys.length === 0) { setJourney(null); return; }
      const j = journeys[0];
      setJourney(j);
      const res = await base44.functions.invoke('getJourneyDashboard', { magic_key: j.magic_key });
      setDashboardData(res.data);
    } catch {
      setJourney(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [client.id]);

  const copyLink = (url, label) => {
    navigator.clipboard.writeText(url);
    toast.success(`${label} copied!`);
  };

  if (loading) {
    return (
      <Card className="border-teal-100">
        <CardContent className="p-5 text-center text-sm text-gray-400">Loading ROI Journey data…</CardContent>
      </Card>
    );
  }

  if (!journey) return null;

  const responseCount = dashboardData?.response_count || 0;
  const status = journey.status || '—';
  const origin = window.location.origin;
  const dashboardUrl = `${origin}/FitnessRoi/dashboard?k=${journey.magic_key}`;
  const launchUrl = `${origin}/FitnessRoi/launch?k=${journey.magic_key}`;
  const surveyUrl = `${origin}/MfsJourneySurvey?token=${journey.survey_token}`;

  const links = [
    { label: 'Dashboard', url: dashboardUrl },
    { label: 'Launch page', url: launchUrl },
    { label: 'Employee survey', url: surveyUrl },
  ];

  return (
    <Card className="border-teal-200 bg-teal-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-600" />
            ROI Journey
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={fetchData} className="h-7 px-2">
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <Users className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-gray-700">{responseCount} response{responseCount !== 1 ? 's' : ''}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            status === 'ready' ? 'bg-green-100 text-green-700' :
            status === 'collecting' ? 'bg-amber-100 text-amber-700' :
            'bg-gray-100 text-gray-600'
          }`}>{status.replace(/_/g, ' ')}</span>
          {journey.is_demo && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Demo</span>}
        </div>

        <div className="space-y-2 pt-2 border-t border-teal-100">
          {links.map(({ label, url }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-24 shrink-0">{label}</span>
              <input readOnly value={url} className="flex-1 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 font-mono truncate" />
              <Button size="sm" variant="outline" className="h-7 px-2 shrink-0" onClick={() => copyLink(url, `${label} link`)}>
                <Copy className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2 shrink-0" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3 h-3" /></a>
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}