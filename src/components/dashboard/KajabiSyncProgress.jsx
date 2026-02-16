import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, Loader2, Clock, AlertTriangle, TrendingUp, Users, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

export default function KajabiSyncProgress() {
  const { data: syncRecords = [], isLoading, refetch } = useQuery({
    queryKey: ['kajabiSyncProgress'],
    queryFn: () => base44.entities.KajabiSyncProgress.list('-started_at'),
    refetchInterval: 5000, // Refresh every 5 seconds for live updates
    initialData: []
  });

  const currentSync = syncRecords.find(r => r.status === 'in_progress');
  const completedSyncs = syncRecords.filter(r => r.status === 'completed').slice(0, 10);
  const failedSyncs = syncRecords.filter(r => r.status === 'failed').slice(0, 5);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'in_progress':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
      completed: 'bg-green-100 text-green-700 border-green-200',
      failed: 'bg-red-100 text-red-700 border-red-200'
    };
    return (
      <Badge className={`${variants[status]} border`}>
        {status === 'in_progress' ? 'Syncing' : status === 'completed' ? 'Completed' : 'Failed'}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 text-gray-400 mx-auto mb-4 animate-spin" />
          <p className="text-gray-500">Loading sync data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Sync Status */}
      {currentSync ? (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                Sync in Progress
              </CardTitle>
              {getStatusBadge(currentSync.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-4 border border-blue-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Total Processed</span>
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-blue-600">{currentSync.total_processed || 0}</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-green-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">New</span>
                  <Users className="w-4 h-4 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-green-600">{currentSync.new_count || 0}</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-amber-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Updated</span>
                  <RefreshCw className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-2xl font-bold text-amber-600">{currentSync.updated_count || 0}</p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Skipped</span>
                  <AlertTriangle className="w-4 h-4 text-gray-600" />
                </div>
                <p className="text-2xl font-bold text-gray-600">{currentSync.skipped_count || 0}</p>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Pages Processed</span>
                <span className="text-sm text-gray-600">{currentSync.page_count || 0} pages</span>
              </div>
              <Progress value={33} className="h-2" />
            </div>

            {currentSync.error_count > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900">
                      {currentSync.error_count} error{currentSync.error_count !== 1 ? 's' : ''} encountered
                    </p>
                    {currentSync.error_message && (
                      <p className="text-sm text-red-700 mt-1">{currentSync.error_message}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-sm text-gray-600 pt-2 border-t">
              <span>Started: {format(new Date(currentSync.started_at), 'MMM d, yyyy h:mm a')}</span>
              {currentSync.retry_count > 0 && (
                <span className="text-amber-600">Retries: {currentSync.retry_count}</span>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <p className="text-gray-700 font-medium">No active sync</p>
            <p className="text-sm text-gray-500 mt-1">All syncs are up to date</p>
          </CardContent>
        </Card>
      )}

      {/* Sync History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Completed Syncs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Recent Completed Syncs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {completedSyncs.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {completedSyncs.map((sync) => (
                  <div key={sync.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:bg-gray-100 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(sync.status)}
                        <span className="text-sm font-medium text-gray-700">
                          {format(new Date(sync.started_at), 'MMM d, h:mm a')}
                        </span>
                      </div>
                      {getStatusBadge(sync.status)}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                      <div>
                        <span className="text-gray-500">Total:</span>
                        <span className="ml-2 font-medium text-gray-900">{sync.total_processed || 0}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Pages:</span>
                        <span className="ml-2 font-medium text-gray-900">{sync.page_count || 0}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">New:</span>
                        <span className="ml-2 font-medium text-green-600">{sync.new_count || 0}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Updated:</span>
                        <span className="ml-2 font-medium text-amber-600">{sync.updated_count || 0}</span>
                      </div>
                      {sync.skipped_count > 0 && (
                        <div>
                          <span className="text-gray-500">Skipped:</span>
                          <span className="ml-2 font-medium text-gray-600">{sync.skipped_count}</span>
                        </div>
                      )}
                    </div>

                    {sync.completed_at && (
                      <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                        Completed: {format(new Date(sync.completed_at), 'MMM d, h:mm a')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No completed syncs yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Failed Syncs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              Failed Syncs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {failedSyncs.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {failedSyncs.map((sync) => (
                  <div key={sync.id} className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(sync.status)}
                        <span className="text-sm font-medium text-gray-700">
                          {format(new Date(sync.started_at), 'MMM d, h:mm a')}
                        </span>
                      </div>
                      {getStatusBadge(sync.status)}
                    </div>

                    {sync.error_message && (
                      <div className="mt-2 p-2 bg-white rounded border border-red-200">
                        <p className="text-sm text-red-800">{sync.error_message}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                      <div>
                        <span className="text-gray-500">Processed:</span>
                        <span className="ml-2 font-medium text-gray-900">{sync.total_processed || 0}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Errors:</span>
                        <span className="ml-2 font-medium text-red-600">{sync.error_count || 0}</span>
                      </div>
                      {sync.retry_count > 0 && (
                        <div>
                          <span className="text-gray-500">Retries:</span>
                          <span className="ml-2 font-medium text-amber-600">{sync.retry_count}</span>
                        </div>
                      )}
                      {sync.last_successful_page !== undefined && (
                        <div>
                          <span className="text-gray-500">Last Page:</span>
                          <span className="ml-2 font-medium text-gray-900">{sync.last_successful_page}</span>
                        </div>
                      )}
                    </div>

                    {sync.error_details && sync.error_details.length > 0 && (
                      <details className="mt-3">
                        <summary className="text-xs text-red-700 cursor-pointer hover:text-red-800">
                          View error details ({sync.error_details.length})
                        </summary>
                        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                          {sync.error_details.map((err, idx) => (
                            <div key={idx} className="text-xs bg-white p-2 rounded border border-red-100">
                              <span className="text-gray-500">Page {err.page}:</span>
                              <span className="ml-1 text-red-700">{err.error}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No failed syncs</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      {syncRecords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overall Sync Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{syncRecords.length}</p>
                <p className="text-sm text-gray-600 mt-1">Total Syncs</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{completedSyncs.length}</p>
                <p className="text-sm text-gray-600 mt-1">Completed</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{failedSyncs.length}</p>
                <p className="text-sm text-gray-600 mt-1">Failed</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">
                  {syncRecords.reduce((sum, s) => sum + (s.total_processed || 0), 0)}
                </p>
                <p className="text-sm text-gray-600 mt-1">Total Contacts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}