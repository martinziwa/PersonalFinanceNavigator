import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Trash2, Edit } from "lucide-react";
import Header from "@/components/layout/header";
import BottomNavigation from "@/components/layout/bottom-navigation";
import ProgressBar from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGoals } from "@/hooks/use-goals";
import { useTransactions } from "@/hooks/use-transactions";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";
import type { InsertSavingsGoal, Transaction } from "@shared/schema";

const goalSchema = z.object({
  name: z.string().min(1, "Goal name is required"),
  targetAmount: z.string().min(1, "Target amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Target amount must be a positive number"
  ),
  startingSavings: z.string().optional().refine(
    (val) => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
    "Starting savings must be a non-negative number"
  ),
  deadline: z.string().optional(),
  icon: z.string().min(1, "Icon is required"),
  color: z.string().min(1, "Color is required"),
});

type GoalFormData = z.infer<typeof goalSchema>;

const goalTypes = [
  { value: "car", label: "New Car", icon: "🚗", color: "#2563EB" },
  { value: "education", label: "Education", icon: "🎓", color: "#D97706" },
  { value: "emergency", label: "Emergency Fund", icon: "🛡️", color: "#059669" },
  { value: "house", label: "House Down Payment", icon: "🏠", color: "#DC2626" },
  { value: "other", label: "Other", icon: "🎯", color: "#6B7280" },
  { value: "retirement", label: "Retirement", icon: "👴", color: "#059669" },
  { value: "vacation", label: "Vacation", icon: "✈️", color: "#7C3AED" },
];

export default function Goals() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any>(null);
  
  const { data: goals = [], isLoading } = useGoals();
  const { data: transactions = [] } = useTransactions();
  const { toast } = useToast();

  // Calculate actual savings for a goal based on starting savings plus transactions
  const calculateGoalProgress = (goalId: number, startingSavings: string = "0") => {
    const goalTransactions = transactions.filter((transaction: Transaction) => 
      transaction.savingsGoalId === goalId
    );
    
    const transactionTotal = goalTransactions.reduce((total: number, transaction: Transaction) => {
      if (transaction.type === 'savings_deposit') {
        return total + parseFloat(transaction.amount);
      } else if (transaction.type === 'savings_withdrawal') {
        return total - parseFloat(transaction.amount);
      }
      return total;
    }, 0);
    
    const startingAmount = parseFloat(startingSavings);
    const totalAmount = startingAmount + transactionTotal;
    
    return {
      total: totalAmount,
      startingAmount,
      transactionAmount: transactionTotal
    };
  };

  const form = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      name: "",
      targetAmount: "",
      startingSavings: "",
      deadline: "",
      icon: "",
      color: "",
    },
  });

  const createGoalMutation = useMutation({
    mutationFn: async (data: InsertSavingsGoal) => {
      const response = await apiRequest("POST", "/api/goals", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
      toast({
        title: "Success",
        description: "Savings goal created successfully",
      });
      form.reset();
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create savings goal",
        variant: "destructive",
      });
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest("PUT", `/api/goals/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
      toast({
        title: "Success",
        description: "Savings goal updated successfully",
      });
      setIsDialogOpen(false);
      setEditingGoal(null);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update savings goal",
        variant: "destructive",
      });
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/goals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
      toast({
        title: "Success",
        description: "Savings goal deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete savings goal",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: GoalFormData) => {
    const goalData = {
      name: data.name,
      targetAmount: data.targetAmount,
      startingSavings: data.startingSavings || "0",
      deadline: data.deadline ? new Date(data.deadline) : null,
      icon: data.icon,
      color: data.color,
    };
    
    if (editingGoal) {
      updateGoalMutation.mutate({
        id: editingGoal.id,
        data: goalData
      });
    } else {
      createGoalMutation.mutate(goalData);
    }
  };

  const handleGoalTypeChange = (type: string) => {
    const goalType = goalTypes.find(g => g.value === type);
    if (goalType) {
      form.setValue("name", goalType.label);
      form.setValue("icon", goalType.icon);
      form.setValue("color", goalType.color);
    }
  };

  // Pre-populate form when editing
  React.useEffect(() => {
    if (editingGoal && isDialogOpen) {
      const deadlineValue = editingGoal.deadline ? 
        new Date(editingGoal.deadline).toISOString().split('T')[0] : "";
      
      form.reset({
        name: editingGoal.name,
        targetAmount: editingGoal.targetAmount,
        startingSavings: editingGoal.startingSavings || "0",
        deadline: deadlineValue,
        icon: editingGoal.icon,
        color: editingGoal.color,
      });
    } else if (!editingGoal && isDialogOpen) {
      form.reset({
        name: "",
        targetAmount: "",
        startingSavings: "",
        deadline: "",
        icon: "",
        color: "",
      });
    }
  }, [editingGoal, isDialogOpen, form]);



  return (
    <div className="max-w-sm mx-auto bg-white min-h-screen relative flex flex-col">
      <Header title="Savings Goals" subtitle="Track your progress" />
      
      <main className="flex-1 overflow-y-auto pb-20 px-4 space-y-4 pt-4">
        {/* Add Goal Button */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full bg-primary text-white py-3">
              <Plus className="h-4 w-4 mr-2" />
              Create New Goal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm mx-auto">
            <DialogHeader>
              <DialogTitle>{editingGoal ? "Edit Savings Goal" : "Create Savings Goal"}</DialogTitle>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Goal Type</FormLabel>
                      <Select
                        onValueChange={handleGoalTypeChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select goal type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {goalTypes.map((goal) => (
                            <SelectItem key={goal.value} value={goal.value}>
                              <span className="flex items-center">
                                {goal.icon} {goal.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormControl>
                        <Input
                          placeholder="Or enter custom name"
                          {...field}
                          className="mt-2"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="targetAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="startingSavings"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Starting Savings (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="deadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Date (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex space-x-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setIsDialogOpen(false);
                      setEditingGoal(null);
                      form.reset();
                    }}
                    className="flex-1"
                    disabled={createGoalMutation.isPending || updateGoalMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-primary text-white"
                    disabled={createGoalMutation.isPending || updateGoalMutation.isPending}
                  >
                    {editingGoal
                      ? (updateGoalMutation.isPending ? "Updating..." : "Update Goal")
                      : (createGoalMutation.isPending ? "Creating..." : "Create Goal")
                    }
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Goals List */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 animate-pulse">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                </div>
                <div className="h-2 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : goals.length === 0 ? (
          <div className="bg-white rounded-xl p-8 border border-gray-100 text-center">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No savings goals yet</h3>
            <p className="text-gray-500 mb-4">
              Set your first savings goal to start building your future
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => {
              const savingsData = calculateGoalProgress(goal.id, goal.startingSavings);
              const targetAmount = parseFloat(goal.targetAmount);
              const percentage = (savingsData.total / targetAmount) * 100;
              const remaining = targetAmount - savingsData.total;
              const isCompleted = percentage >= 100;
              

              
              return (
                <div key={goal.id} className="bg-white rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                        style={{ backgroundColor: goal.color + '20' }}
                      >
                        <span>{goal.icon}</span>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{goal.name}</h3>
                        <p className="text-xs text-gray-500">
                          {goal.deadline ? 
                            `Target: ${new Date(goal.deadline).toLocaleDateString()}` : 
                            "No deadline set"
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-right">
                        <div 
                          className="text-sm font-semibold"
                          style={{ color: goal.color }}
                        >
                          {Math.round(percentage)}%
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingGoal(goal);
                          setIsDialogOpen(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteGoalMutation.mutate(goal.id)}
                        disabled={deleteGoalMutation.isPending}
                        className="p-2 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">
                        {formatCurrency(savingsData.total)}
                      </span>
                      <span className="text-gray-900 font-medium">
                        {formatCurrency(targetAmount)}
                      </span>
                    </div>
                    <ProgressBar
                      percentage={percentage}
                      color={isCompleted ? "#10B981" : goal.color}
                    />
                  </div>
                  
                  {/* Savings Breakdown */}
                  {(savingsData.startingAmount > 0 || savingsData.transactionAmount !== 0) && (
                    <div className="mb-2 p-2 bg-gray-50 rounded-lg">
                      <div className="text-xs text-gray-600 mb-1">Savings Breakdown:</div>
                      <div className="space-y-1 text-xs">
                        {savingsData.startingAmount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Starting savings:</span>
                            <span className="font-medium">{formatCurrency(savingsData.startingAmount)}</span>
                          </div>
                        )}
                        {savingsData.transactionAmount !== 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">
                              {savingsData.transactionAmount >= 0 ? 'Deposits:' : 'Net withdrawals:'}
                            </span>
                            <span className={`font-medium ${savingsData.transactionAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {savingsData.transactionAmount >= 0 ? '+' : ''}{formatCurrency(savingsData.transactionAmount)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between border-t border-gray-200 pt-1">
                          <span className="text-gray-700 font-medium">Total:</span>
                          <span className="font-semibold">{formatCurrency(savingsData.total)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-500">
                    {isCompleted ? 
                      "🎉 Goal completed! Congratulations!" :
                      `${formatCurrency(remaining)} remaining to reach goal`
                    }
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <BottomNavigation />
    </div>
  );
}
