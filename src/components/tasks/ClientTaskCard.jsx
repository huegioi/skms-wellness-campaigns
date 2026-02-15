import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building, CheckCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';

export default function ClientTaskCard({ client, tasks = [], onClick }) {
  const queryClient = useQueryClient();
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const progress = tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0;

  if (pendingTasks.length === 0) return null;

  return (
    <Card 
      className="hover:shadow-xl transition-all cursor-pointer hover:scale-105 border-l-4 border-l-blue-500" 
      onClick={() => onClick && onClick(client)}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-lg text-gray-900 truncate">{client.name}</h4>
            {client.company && (
              <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                <Building className="w-3 h-3" />
                {client.company}
              </p>
            )}
          </div>
        </div>

        {/* Progress Circle */}
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 flex-shrink-0">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle cx="32" cy="32" r="28" stroke="#e5e7eb" strokeWidth="6" fill="none" />
              <circle 
                cx="32" 
                cy="32" 
                r="28" 
                stroke="#3b82f6" 
                strokeWidth="6" 
                fill="none"
                strokeDasharray={`${progress * 1.76} 176`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-gray-700">{Math.round(progress)}%</span>
            </div>
          </div>
          
          <div className="flex-1">
            <Badge className="bg-blue-100 text-blue-700 mb-2">
              {pendingTasks.length} pending
            </Badge>
            <p className="text-xs text-gray-500">
              {completedTasks.length} of {tasks.length} completed
            </p>
          </div>
        </div>

        {/* Complete All Button */}
        <Button
          size="sm"
          className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white"
          onClick={async (e) => {
            e.stopPropagation();
            if (!confirm(`Mark all tasks complete for ${client.name}?`)) return;
            try {
              for (const task of pendingTasks) {
                await base44.entities.ClientTask.update(task.id, {
                  status: 'completed',
                  completed_date: new Date().toISOString()
                });
              }
              queryClient.invalidateQueries({ queryKey: ['clientTasks'] });
            } catch (error) {
              alert('Failed to complete tasks: ' + error.message);
            }
          }}
        >
          <CheckCircle className="w-4 h-4 mr-1" />
          Complete All Tasks
        </Button>
      </CardContent>
    </Card>
  );
}