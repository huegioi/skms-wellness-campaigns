import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, SkipForward, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function TaskList({ clientId, proposalId = null, showProposalGroups = false }) {
  const queryClient = useQueryClient();
  const [expandedProposals, setExpandedProposals] = useState({});

  const { data: tasks = [] } = useQuery({
    queryKey: ['clientTasks', clientId, proposalId],
    queryFn: async () => {
      const filter = proposalId 
        ? { client_id: clientId, proposal_id: proposalId }
        : { client_id: clientId };
      return base44.entities.ClientTask.filter(filter, 'task_order');
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, data }) => base44.entities.ClientTask.update(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientTasks'] });
    }
  });

  const handleToggleComplete = (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    updateTaskMutation.mutate({
      taskId: task.id,
      data: {
        status: newStatus,
        completed_date: newStatus === 'completed' ? new Date().toISOString() : null
      }
    });
  };

  const handleSkip = (task) => {
    updateTaskMutation.mutate({
      taskId: task.id,
      data: { status: 'skipped' }
    });
  };

  // Group tasks by proposal if needed
  const groupedTasks = showProposalGroups 
    ? tasks.reduce((acc, task) => {
        const key = task.proposal_id || 'general';
        if (!acc[key]) acc[key] = [];
        acc[key].push(task);
        return acc;
      }, {})
    : { all: tasks };

  const renderTask = (task) => {
    const isCompleted = task.status === 'completed';
    const isSkipped = task.status === 'skipped';

    return (
      <div
        key={task.id}
        className={`flex items-center gap-3 p-3 rounded-lg border ${
          isCompleted ? 'bg-green-50 border-green-200' :
          isSkipped ? 'bg-gray-50 border-gray-200' :
          'bg-white border-gray-200 hover:border-blue-300'
        } transition-all`}
      >
        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={() => handleToggleComplete(task)}
            className="flex-shrink-0"
          >
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <Circle className="w-5 h-5 text-gray-400 hover:text-blue-600" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <p className={`font-medium ${isCompleted ? 'line-through text-gray-500' : 'text-gray-800'}`}>
              {task.description}
            </p>
            {task.completed_date && (
              <p className="text-xs text-gray-500 mt-1">
                Completed {format(new Date(task.completed_date), 'MMM d, yyyy')}
              </p>
            )}
            {task.source_event && (
              <Badge variant="outline" className="text-xs mt-1">
                {task.source_event}
              </Badge>
            )}
          </div>
        </div>

        {!isCompleted && !isSkipped && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleSkip(task)}
            className="flex-shrink-0"
          >
            <SkipForward className="w-4 h-4" />
          </Button>
        )}
      </div>
    );
  };

  if (showProposalGroups) {
    return (
      <div className="space-y-6">
        {Object.entries(groupedTasks).map(([proposalKey, proposalTasks]) => {
          const isExpanded = expandedProposals[proposalKey] !== false;
          const completedCount = proposalTasks.filter(t => t.status === 'completed').length;
          const totalCount = proposalTasks.length;
          const proposalName = proposalKey === 'general' ? 'General Tasks' : `Proposal ${proposalKey.slice(0, 8)}`;

          return (
            <Card key={proposalKey}>
              <CardHeader 
                className="cursor-pointer"
                onClick={() => setExpandedProposals(prev => ({ ...prev, [proposalKey]: !isExpanded }))}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{proposalName}</CardTitle>
                  <Badge variant={completedCount === totalCount ? 'default' : 'secondary'}>
                    {completedCount} / {totalCount}
                  </Badge>
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent className="space-y-2">
                  {proposalTasks.map(renderTask)}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No tasks yet</p>
      ) : (
        tasks.map(renderTask)
      )}
    </div>
  );
}