import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, BarChart3, Users, MoreVertical, Link2, ExternalLink } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const STATUS_STYLES = {
  quick_done: 'bg-gray-100 text-gray-600',
  team_launched: 'bg-blue-100 text-blue-700',
  collecting: 'bg-amber-100 text-amber-700',
  ready: 'bg-green-100 text-green-700',
};

export default function JourneyAssessmentTable({ journeys, origin, copyLink }) {
  const navigate = useNavigate();

  if (journeys.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 text-center shadow">
        <Link2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="text-gray-500">No Mental Fitness Journeys yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th className="py-3 px-4 font-medium">Company</th>
            <th className="py-3 px-4 font-medium">Contact</th>
            <th className="py-3 px-4 font-medium hidden md:table-cell">Created</th>
            <th className="py-3 px-4 font-medium text-center">Responses</th>
            <th className="py-3 px-4 font-medium">Leader Score</th>
            <th className="py-3 px-4 font-medium hidden md:table-cell">Status</th>
            <th className="py-3 px-4 font-medium hidden lg:table-cell">Partner</th>
            <th className="py-3 px-4 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {journeys.map(j => {
            const dashboardUrl = `${origin}/FitnessRoi/dashboard?k=${j.magic_key}`;
            const surveyUrl = `${origin}/MfsJourneySurvey?token=${j.survey_token}`;
            return (
              <tr key={j.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full font-bold shrink-0">MFJ</span>
                    <span className="font-semibold text-sm text-gray-800">{j.company_name || '—'}</span>
                    {j.is_demo && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold">DEMO</span>}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="text-sm text-gray-700">{j.contact_name || '—'}</div>
                  <div className="text-xs text-gray-400">{j.email}</div>
                </td>
                <td className="py-3 px-4 text-sm text-gray-500 hidden md:table-cell">
                  {new Date(j.created_date).toLocaleDateString()}
                </td>
                <td className="py-3 px-4 text-center text-sm font-medium text-gray-700">
                  {j.responseCount}
                </td>
                <td className="py-3 px-4">
                  {j.locked ? (
                    <span className="text-xs text-amber-600 font-medium">gated · {j.responseCount} of 5</span>
                  ) : (
                    <span className="text-sm font-bold text-[#264d44]">{j.composite != null ? Math.round(j.composite) : '—'}</span>
                  )}
                </td>
                <td className="py-3 px-4 hidden md:table-cell">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[j.status] || 'bg-gray-100 text-gray-600'}`}>
                    {j.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-gray-600 hidden lg:table-cell">
                  {j.partnerName || '—'}
                </td>
                <td className="py-3 px-4 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button aria-label="Row actions" className="flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:p-1.5 rounded-lg hover:bg-gray-100">
                        <MoreVertical className="w-4 h-4 text-gray-500" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => window.open(dashboardUrl, '_blank')}>
                        <BarChart3 className="w-4 h-4 mr-2" /> Open dashboard
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => copyLink(dashboardUrl)}>
                        <Copy className="w-4 h-4 mr-2" /> Copy dashboard link
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => copyLink(surveyUrl)}>
                        <Copy className="w-4 h-4 mr-2" /> Copy survey link
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => window.open(surveyUrl, '_blank')}>
                        <ExternalLink className="w-4 h-4 mr-2" /> Open survey
                      </DropdownMenuItem>
                      {j.client && (
                        <DropdownMenuItem onClick={() => navigate(`/Clients?clientId=${j.client.id}`)}>
                          <Users className="w-4 h-4 mr-2" /> Open client
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}