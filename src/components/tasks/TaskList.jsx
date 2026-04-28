import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, SkipForward, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

const PHASE_CONFIG = [
  {
    key: 'phase1',
    label: 'Phase 1: Sales & Setup',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    match: (order) => order >= 1 && order <= 5,
  },
  {
    key: 'phase2',
    label: 'Phase 2: Planning & Launch',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    match: (order) => order >= 6 && order <= 10,
  },
  {
    key: 'phase3',
    label: 'Phase 3: Implementation & Sustainment',
    color: 'bg-green-100 text-green-800 border-green-200',
    match: (order) => order >= 11 && order <= 19,
  },
  {
    key: 'challenge_setup',
    label: '📋 Challenge: Setup',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    match: (order) => order >= 20 && order <= 25,
  },
  {
    key: 'challenge_promo',
    label: '📣 Challenge: Promotion',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    match: (order) => order >= 26 && order <= 28,
  },
  {
    key: 'challenge_during',
    label: '🔁 Challenge: During',
    color: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    match: (order) => order >= 29 && order <= 31,
  },
  {
    key: 'challenge_wrapup',
    label: '📊 Challenge: Wrap-Up',
    color: 'bg-pink-100 text-pink-800 border-pink-200',
    match: (order) => order >= 32,
  },
];

export default function TaskList({ clientId, proposalId = null, showProposalGroups = false }) {
  const queryClient = useQueryClient();
  const [expandedProposals, setExpandedProposals] = useState({});
  const [collapsedPhases, setCollapsedPhases] = useState({});

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

  const togglePhase = (key) => {
    setCollapsedPhases(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderTask = (task) => {
    const isCompleted = task.status === 'completed';
    const isSkipped = task.status === 'skipped';
    // Strip the [CHALLENGE] prefix tag for display
    const displayDescription = task.description.replace(/^\[CHALLENGE\]\s*[A-Z-]+\s*—\s*/, '');

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
          <button onClick={() => handleToggleComplete(task)} className="flex-shrink-0">
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <Circle className="w-5 h-5 text-gray-400 hover:text-blue-600" />
            )}
          </button>
          <div className="flex-1 min-w-0">
            <p className={`font-medium text-sm ${isCompleted ? 'line-through text-gray-400' : isSkipped ? 'text-gray-400' : 'text-gray-800'}`}>
              {displayDescription}
            </p>
            {task.completed_date && (
              <p className="text-xs text-gray-400 mt-1">
                Completed {format(new Date(task.completed_date), 'MMM d, yyyy')}
              </p>
            )}
          </div>
        </div>
        {!isCompleted && !isSkipped && (
          <Button size="sm" variant="ghost" onClick={() => handleSkip(task)} className="flex-shrink-0" title="Skip">
            <SkipForward className="w-4 h-4" />
          </Button>
        )}
      </div>
    );
  };

  const renderPhases = (taskList) => {
    return (
      <div className="space-y-3">
        {PHASE_CONFIG.map(phase => {
          const phaseTasks = taskList.filter(t => phase.match(t.task_order || 0));
          if (!phaseTasks.length) return null;
          const completedCount = phaseTasks.filter(t => t.status === 'completed').length;
          const isCollapsed = collapsedPhases[phase.key];

          return (
            <div key={phase.key}>
              <button
                onClick={() => togglePhase(phase.key)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border mb-1 ${phase.color} hover:opacity-90 transition-opacity`}
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  <span className="font-semibold text-sm">{phase.label}</span>
                </div>
                <span className="text-xs font-medium">{completedCount}/{phaseTasks.length}</span>
              </button>
              {!isCollapsed && (
                <div className="space-y-2 pl-2">
                  {phaseTasks.map(renderTask)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (showProposalGroups) {
    const groupedTasks = tasks.reduce((acc, task) => {
      const key = task.proposal_id || 'general';
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    }, {});

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
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <CardTitle className="text-lg">{proposalName}</CardTitle>
                  </div>
                  <Badge variant={completedCount === totalCount ? 'default' : 'secondary'}>
                    {completedCount} / {totalCount}
                  </Badge>
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent>
                  {renderPhases(proposalTasks)}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tasks.length === 0 ? (
        <p className="text-center text-gray-500 py-8">No tasks yet</p>
      ) : (
        renderPhases(tasks)
      )}
    </div>
  );
}