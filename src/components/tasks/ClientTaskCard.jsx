import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, CheckCircle2, Circle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function ClientTaskCard({ client, tasks = [], onClick }) {
  const navigate = useNavigate();

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const progress = tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0;

  if (pendingTasks.length === 0) return null;

  const handleClick = () => {
    if (onClick) {
      onClick(client);
    } else {
      navigate(createPageUrl('Clients') + `?clientId=${client.id}`);
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={handleClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-800 truncate">{client.name}</h4>
            <p className="text-sm text-gray-500 truncate">{client.company}</p>
          </div>
          <Badge variant={pendingTasks.length > 3 ? 'destructive' : 'secondary'}>
            {pendingTasks.length} pending
          </Badge>
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-green-500 transition-all" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {completedTasks.length} of {tasks.length} completed
          </p>
        </div>

        {/* Next Tasks Preview */}
        <div className="space-y-2 mb-3">
          {pendingTasks.slice(0, 3).map(task => (
            <div key={task.id} className="flex items-center gap-2 text-sm">
              <Circle className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="text-gray-700 truncate">{task.description}</span>
            </div>
          ))}
        </div>

        <Button variant="ghost" size="sm" className="w-full">
          View All Tasks <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}