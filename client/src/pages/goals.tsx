import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Trash2, DollarSign } from "lucide-react";
import Header from "@/components/layout/header";
import BottomNavigation from "@/components/layout/bottom-navigation";
import ProgressBar from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGoals } from "@/hooks/use-goals";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertSavingsGoal } from "@shared/schema";

const goalSchema = z.object({
  name: z.string().min(1, "Goal name is required"),
  targetAmount: z.string().min(1, "Target amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Target amount must be a positive number"
  ),
  deadline: z.string().optional(),
  icon: z.string().min(1, "Icon is required"),
  color: z.string().min(1, "Color is required"),
});

type GoalFormData = z.infer<typeof goalSchema>;

const goalTypes = [
  { value: "emergency", label: "Emergency Fund", icon: "🛡️", color: "#059669" },
  { value: "vacation", label: "Vacation", icon: "✈️", color: "#7C3AED" },
  { value: "house", label: "House Down Payment", icon: "🏠", color: "#DC2626" },
  { value: "car", label: "New Car", icon: "🚗", color: "#2563EB" },
  { value: "education", label: "Education", icon: "🎓", color: "#D97706" },
  { value: "retirement", label: "Retirement", icon: "👴", color: "#059669" },
  { value: "other", label: "Other", icon: "🎯", color: "#6B7280" },
];

export default function Goals() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isContributeDialogOpen, setIsContributeDialogOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [contributeAmount, setContributeAmount] = useState("");
  
  const { data: goals = [], isLoading } = useGoals();
  const { toast } = useToast();

  const form = useForm<GoalFormData>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      name: "",
      targetAmount: "",
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
        description: "Contribution added successfully",
      });
      setIsContributeDialogOpen(false);
      setContributeAmount("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add contribution",
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
    createGoalMutation.mutate({
      name: data.name,
      targetAmount: data.targetAmount,
      deadline: data.deadline ? new Date(data.deadline) : undefined,
      icon: data.icon,
      color: data.color,
    });
  };

  const handleGoalTypeChange = (type: string) => {
    const goalType = goalTypes.find(g => g.value === type);
    if (goalType) {
      form.setValue("name", goalType.label);
      form.setValue("icon", goalType.icon);
      form.setValue("color", goalType.color);
    }
  };

  const handleContribute = () => {
    if (!selectedGoal || !contributeAmount) return;
    
    const newAmount = parseFloat(selectedGoal.currentAmount) + parseFloat(contributeAmount);
    updateGoalMutation.mutate({
      id: selectedGoal.id,
      data: { currentAmount: newAmount.toString() }
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="max-w-sm mx-auto bg-white min-h-screen relative">
      <Header title="Savings Goals" subtitle="Track your progress" />
      
      <main className="pb-20 px-4 space-y-4 pt-4">
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
              <DialogTitle>Create Savings Goal</DialogTitle>
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
                    onClick={() => setIsDialogOpen(false)}
                    className="flex-1"
                    disabled={createGoalMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-primary text-white"
                    disabled={createGoalMutation.isPending}
                  >
                    {createGoalMutation.isPending ? "Creating..." : "Create Goal"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Contribute Dialog */}
        <Dialog open={isContributeDialogOpen} onOpenChange={setIsContributeDialogOpen}>
          <DialogContent className="max-w-sm mx-auto">
            <DialogHeader>
              <DialogTitle>Add Contribution</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contribution Amount
                </label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={contributeAmount}
                  onChange={(e) => setContributeAmount(e.target.value)}
                />
              </div>

              <div className="flex space-x-4">
                <Button
                  variant="secondary"
                  onClick={() => setIsContributeDialogOpen(false)}
                  className="flex-1"
                  disabled={updateGoalMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleContribute}
                  className="flex-1 bg-primary text-white"
                  disabled={updateGoalMutation.isPending || !contributeAmount}
                >
                  {updateGoalMutation.isPending ? "Adding..." : "Add Contribution"}
                </Button>
              </div>
            </div>
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
              const percentage = (parseFloat(goal.currentAmount) / parseFloat(goal.targetAmount)) * 100;
              const remaining = parseFloat(goal.targetAmount) - parseFloat(goal.currentAmount);
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
                          setSelectedGoal(goal);
                          setIsContributeDialogOpen(true);
                        }}
                        className="p-2 text-green-600 hover:bg-green-50"
                      >
                        <DollarSign className="h-4 w-4" />
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
                        {formatCurrency(parseFloat(goal.currentAmount))}
                      </span>
                      <span className="text-gray-900 font-medium">
                        {formatCurrency(parseFloat(goal.targetAmount))}
                      </span>
                    </div>
                    <ProgressBar
                      percentage={percentage}
                      color={isCompleted ? "bg-green-500" : `bg-[${goal.color}]`}
                    />
                  </div>
                  
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
