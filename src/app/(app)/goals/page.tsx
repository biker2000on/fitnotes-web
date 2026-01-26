'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Target } from 'lucide-react';
import { GoalCard } from '@/components/goals/goal-card';
import { GoalForm } from '@/components/goals/goal-form';
import { getGoals, deleteGoal, type GoalProgress } from '@/actions/goals';

export default function GoalsPage() {
  const [goals, setGoals] = useState<GoalProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalProgress | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  const loadGoals = async () => {
    setIsLoading(true);
    try {
      const data = await getGoals();
      setGoals(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGoals();
  }, []);

  const handleEdit = (goal: GoalProgress) => {
    setEditingGoal(goal);
    setFormOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this goal?')) {
      await deleteGoal(id);
      await loadGoals();
    }
  };

  const handleFormSuccess = async () => {
    await loadGoals();
    setEditingGoal(null);
  };

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      setEditingGoal(null);
    }
  };

  const filteredGoals = goals.filter((goal) => {
    if (activeTab === 'active') return !goal.isCompleted;
    if (activeTab === 'completed') return goal.isCompleted;
    return true;
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Target className="h-8 w-8" />
            Goals
          </h1>
          <p className="text-muted-foreground mt-1">Track your fitness objectives and progress</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Goal
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({goals.length})</TabsTrigger>
          <TabsTrigger value="active">
            Active ({goals.filter((g) => !g.isCompleted).length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({goals.filter((g) => g.isCompleted).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading goals...</div>
          ) : filteredGoals.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Target className="h-16 w-16 mx-auto text-muted-foreground/50" />
              <div className="text-lg font-medium">No goals yet</div>
              <p className="text-muted-foreground">
                {activeTab === 'all'
                  ? 'Create your first goal to start tracking progress'
                  : activeTab === 'active'
                    ? 'No active goals at the moment'
                    : 'No completed goals yet'}
              </p>
              {activeTab === 'all' && (
                <Button onClick={() => setFormOpen(true)} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Goal
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredGoals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} onEdit={handleEdit} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <GoalForm
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        editingGoal={editingGoal}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}
