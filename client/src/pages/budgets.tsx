import React, { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Trash2, Edit, PieChart, History, X, CalendarDays, Calculator, RotateCcw, Check, AlertTriangle } from "lucide-react";
import Header from "@/components/layout/header";
import BottomNavigation from "@/components/layout/bottom-navigation";
import ProgressBar from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useBudgets } from "@/hooks/use-budgets";
import { useTransactions } from "@/hooks/use-transactions";
import { useCategories } from "@/hooks/use-categories";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";
import type { InsertBudget, Transaction } from "@shared/schema";

const budgetSchema = z.object({
  category: z.string().min(1, "Category is required"),
  amount: z.string().min(1, "Amount is required"),
  period: z.enum(["weekly", "monthly", "yearly"]),
  startDate: z.string(),
  endDate: z.string(),
  icon: z.string(),
  description: z.string().optional(),
});

type BudgetFormData = z.infer<typeof budgetSchema>;

interface BudgetAllocation {
  category: string;
  icon: string;
  percentage: number;
  amount: number;
  enabled: boolean;
}

// 50/30/20 rule categorization
const BUDGET_RULES = {
  needs: { percentage: 50, categories: ["food", "transportation", "bills", "healthcare", "housing"] },
  wants: { percentage: 30, categories: ["entertainment", "shopping", "dining", "hobbies", "cosmetics"] },
  savings: { percentage: 20, categories: ["savings", "investment", "emergency", "debt"] }
};

export default function Budgets() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<any>(null);
  const [totalIncome, setTotalIncome] = useState<string>("");
  const [budgetAllocations, setBudgetAllocations] = useState<BudgetAllocation[]>([]);
  const [conflicts, setConflicts] = useState<string[]>([]);
  
  const { data: budgets = [], isLoading } = useBudgets();
  const { data: transactions = [] } = useTransactions();
  const { budgetCategories } = useCategories();
  const { toast } = useToast();

  const form = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      category: "",
      amount: "",
      period: "monthly",
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      icon: "",
      description: "",
    },
  });

  // Initialize budget allocations with 50/30/20 rule
  useEffect(() => {
    if (budgetCategories.length > 0 && budgetAllocations.length === 0) {
      const initialAllocations: BudgetAllocation[] = budgetCategories.map(category => {
        let percentage = 0;
        
        if (BUDGET_RULES.needs.categories.includes(category.value)) {
          percentage = BUDGET_RULES.needs.percentage / BUDGET_RULES.needs.categories.length;
        } else if (BUDGET_RULES.wants.categories.includes(category.value)) {
          percentage = BUDGET_RULES.wants.percentage / BUDGET_RULES.wants.categories.length;
        } else {
          percentage = BUDGET_RULES.savings.percentage / BUDGET_RULES.savings.categories.length;
        }

        return {
          category: category.value,
          icon: category.icon,
          percentage: Math.round(percentage * 100) / 100,
          amount: 0,
          enabled: true,
        };
      });

      setBudgetAllocations(initialAllocations);
    }
  }, [budgetCategories, budgetAllocations.length]);

  // Update amounts when total income or percentages change
  useEffect(() => {
    if (totalIncome) {
      const income = parseFloat(totalIncome);
      setBudgetAllocations(prev => 
        prev.map(allocation => ({
          ...allocation,
          amount: Math.round((allocation.percentage / 100) * income)
        }))
      );
    }
  }, [totalIncome]);

  // Check for conflicts with existing budgets (optimized)
  useEffect(() => {
    if (budgetAllocations.length === 0 || budgets.length === 0) {
      setConflicts([]);
      return;
    }

    const formData = form.getValues();
    const conflictingCategories: string[] = [];

    budgetAllocations.forEach(allocation => {
      if (!allocation.enabled) return;

      const hasConflict = budgets.some(budget => {
        const budgetStart = new Date(budget.startDate);
        const budgetEnd = new Date(budget.endDate);
        const newStart = new Date(formData.startDate);
        const newEnd = new Date(formData.endDate);

        return budget.category === allocation.category &&
               budget.period === formData.period &&
               ((newStart >= budgetStart && newStart <= budgetEnd) ||
                (newEnd >= budgetStart && newEnd <= budgetEnd) ||
                (newStart <= budgetStart && newEnd >= budgetEnd));
      });

      if (hasConflict) {
        conflictingCategories.push(allocation.category);
      }
    });

    setConflicts(conflictingCategories);
  }, [budgetAllocations, budgets, form.watch("startDate"), form.watch("endDate"), form.watch("period")]);

  // Budget Allocator Helper Functions
  const totalPercentage = useMemo(() => {
    return budgetAllocations
      .filter(allocation => allocation.enabled)
      .reduce((sum, allocation) => sum + allocation.percentage, 0);
  }, [budgetAllocations]);

  const totalAmount = useMemo(() => {
    return budgetAllocations
      .filter(allocation => allocation.enabled)
      .reduce((sum, allocation) => sum + allocation.amount, 0);
  }, [budgetAllocations]);

  const updatePercentage = (category: string, newPercentage: number) => {
    setBudgetAllocations(prev =>
      prev.map(allocation =>
        allocation.category === category
          ? { ...allocation, percentage: newPercentage }
          : allocation
      )
    );
  };

  const toggleBudgetEnabled = (category: string) => {
    setBudgetAllocations(prev =>
      prev.map(allocation =>
        allocation.category === category
          ? { ...allocation, enabled: !allocation.enabled }
          : allocation
      )
    );
  };

  const resetTo50_30_20 = () => {
    setBudgetAllocations(prev => prev.map(allocation => {
      let percentage = 0;
      
      if (BUDGET_RULES.needs.categories.includes(allocation.category)) {
        percentage = BUDGET_RULES.needs.percentage / BUDGET_RULES.needs.categories.length;
      } else if (BUDGET_RULES.wants.categories.includes(allocation.category)) {
        percentage = BUDGET_RULES.wants.percentage / BUDGET_RULES.wants.categories.length;
      } else {
        percentage = BUDGET_RULES.savings.percentage / BUDGET_RULES.savings.categories.length;
      }

      return {
        ...allocation,
        percentage: Math.round(percentage * 100) / 100,
        enabled: true,
      };
    }));
  };

  const getCategoryName = (category: string) => {
    const categoryData = budgetCategories.find(cat => cat.value === category);
    return categoryData?.label || category;
  };

  const getRuleCategory = (category: string) => {
    if (BUDGET_RULES.needs.categories.includes(category)) return "needs";
    if (BUDGET_RULES.wants.categories.includes(category)) return "wants";
    return "savings";
  };

  const getRuleColor = (ruleCategory: string) => {
    switch (ruleCategory) {
      case "needs": return "bg-red-100 text-red-800";
      case "wants": return "bg-yellow-100 text-yellow-800";
      case "savings": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const createBudgetMutation = useMutation({
    mutationFn: async (data: InsertBudget) => {
      const response = await apiRequest("POST", "/api/budgets", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      handleCloseDialog();
      toast({
        title: "Budget created",
        description: "Your budget has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create budget",
        variant: "destructive",
      });
    },
  });

  const createBudgetsMutation = useMutation({
    mutationFn: async (data: { budgets: InsertBudget[] }) => {
      const promises = data.budgets.map(budget => 
        apiRequest("/api/budgets", "POST", budget)
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({
        title: "Success",
        description: "All budgets have been created successfully!",
      });
      setTotalIncome("");
      resetTo50_30_20();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create budgets",
        variant: "destructive",
      });
    },
  });

  const handleCreateNew = () => {
    setEditingBudget(null);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingBudget(null);
    form.reset();
  };

  const onSubmit = (data: BudgetFormData) => {
    const submitData: InsertBudget = {
      category: data.category,
      amount: data.amount,
      period: data.period,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      icon: data.icon,
      description: data.description || null,
    };

    createBudgetMutation.mutate(submitData);
  };

  const handleCreateAllBudgets = () => {
    if (!totalIncome || parseFloat(totalIncome) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid total income amount",
        variant: "destructive",
      });
      return;
    }

    if (conflicts.length > 0) {
      toast({
        title: "Error",
        description: "Please resolve budget conflicts before creating budgets",
        variant: "destructive",
      });
      return;
    }

    const formData = form.getValues();
    const budgetsToCreate: InsertBudget[] = budgetAllocations
      .filter(allocation => allocation.enabled && allocation.amount > 0)
      .map(allocation => ({
        category: allocation.category,
        amount: allocation.amount.toString(),
        period: formData.period,
        startDate: new Date(formData.startDate),
        endDate: new Date(formData.endDate),
        icon: allocation.icon,
        description: `Budget allocated via Budget Allocator - ${allocation.percentage}% of income`,
      }));

    if (budgetsToCreate.length === 0) {
      toast({
        title: "Error",
        description: "Please enable at least one budget category",
        variant: "destructive",
      });
      return;
    }

    createBudgetsMutation.mutate({ budgets: budgetsToCreate });
  };

  const getBudgetTransactions = (budget: any) => {
    return transactions.filter((transaction: Transaction) => {
      return transaction.category === budget.category && 
             new Date(transaction.date) >= new Date(budget.startDate) &&
             new Date(transaction.date) <= new Date(budget.endDate);
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-sm mx-auto bg-white min-h-screen relative flex flex-col">
        <Header title="Budgets" subtitle="Manage your spending" />
        <main className="flex-1 overflow-y-auto pb-20 px-4 space-y-4 pt-4">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-100 rounded-xl p-4 h-20 animate-pulse"></div>
            ))}
          </div>
        </main>
        <BottomNavigation />
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto bg-white min-h-screen relative flex flex-col">
      <Header title="Budgets" subtitle="Manage your spending" />
      
      <main className="flex-1 overflow-y-auto pb-20 px-4 space-y-4 pt-4">
        <Tabs defaultValue="list" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Budget List
            </TabsTrigger>
            <TabsTrigger value="allocator" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Budget Allocator
            </TabsTrigger>
          </TabsList>
          
          {/* Budget List Tab */}
          <TabsContent value="list" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <Button
                onClick={handleCreateNew}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl"
              >
                <Plus className="h-4 w-4" />
                Add Budget
              </Button>
            </div>

            {budgets.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">💰</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No budgets yet</h3>
                <p className="text-gray-500 mb-6">Create your first budget or use the Budget Allocator to create multiple budgets at once</p>
                <Button onClick={handleCreateNew} className="mx-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Budget
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {budgets.map((budget) => {
                  const categoryTransactions = getBudgetTransactions(budget);
                  const totalSpent = categoryTransactions.reduce((total: number, transaction: Transaction) => {
                    return total + parseFloat(transaction.amount);
                  }, 0);
                  const remaining = parseFloat(budget.amount) - totalSpent;
                  const spentPercentage = parseFloat(budget.amount) > 0 ? (totalSpent / parseFloat(budget.amount)) * 100 : 0;

                  // Calculate time progress
                  const budgetStart = new Date(budget.startDate);
                  const budgetEnd = new Date(budget.endDate);
                  const now = new Date();
                  const totalDuration = budgetEnd.getTime() - budgetStart.getTime();
                  const elapsedDuration = now.getTime() - budgetStart.getTime();
                  const timeProgress = Math.max(0, Math.min(100, (elapsedDuration / totalDuration) * 100));
                  
                  const daysTotal = Math.ceil(totalDuration / (1000 * 60 * 60 * 24));
                  const daysElapsed = Math.max(0, Math.ceil(elapsedDuration / (1000 * 60 * 60 * 24)));
                  const daysRemaining = Math.max(0, daysTotal - daysElapsed);

                  return (
                    <Card key={budget.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="text-2xl">{budget.icon}</div>
                            <div>
                              <h3 className="font-semibold text-gray-900 capitalize">{budget.category}</h3>
                              <p className="text-sm text-gray-500">{budget.period}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900">{formatCurrency(parseFloat(budget.amount))}</div>
                            <div className="text-sm text-gray-500">Budget</div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Spent: {formatCurrency(totalSpent)}</span>
                            <span className={`font-medium ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {remaining >= 0 ? 'Remaining' : 'Over budget'}: {formatCurrency(Math.abs(remaining))}
                            </span>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>Budget Progress</span>
                              <span>{spentPercentage.toFixed(1)}% used</span>
                            </div>
                            <ProgressBar 
                              percentage={Math.min(spentPercentage, 100)} 
                              color={spentPercentage > 100 ? 'bg-red-500' : spentPercentage > 80 ? 'bg-yellow-500' : 'bg-green-500'}
                            />
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>Time Progress</span>
                              <span>{daysRemaining} days left</span>
                            </div>
                            <ProgressBar 
                              percentage={timeProgress} 
                              color={timeProgress > 90 ? 'bg-red-500' : timeProgress > 70 ? 'bg-yellow-500' : 'bg-blue-500'}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Budget Allocator Tab */}
          <TabsContent value="allocator" className="space-y-4 mt-4">
            {/* Total Income Input */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>💰</span>
                  Total Income
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="totalIncome" className="block text-sm font-medium text-gray-700 mb-1">
                      Enter your total income for budget allocation
                    </label>
                    <Input
                      id="totalIncome"
                      type="number"
                      placeholder="Enter amount (MWK)"
                      value={totalIncome}
                      onChange={(e) => setTotalIncome(e.target.value)}
                    />
                  </div>
                  
                  {totalIncome && (
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="text-sm text-blue-700 mb-2">Allocation Summary</div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-blue-600">Total Allocated:</span>
                          <div className="font-semibold">{formatCurrency(totalAmount)}</div>
                        </div>
                        <div>
                          <span className="text-blue-600">Percentage:</span>
                          <div className="font-semibold">{totalPercentage.toFixed(1)}%</div>
                        </div>
                      </div>
                      {totalPercentage !== 100 && (
                        <div className="mt-2 text-xs text-orange-600">
                          ⚠️ Total percentage is {totalPercentage.toFixed(1)}% (should be 100%)
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Period Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  Budget Period
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="period"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Period Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select period" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="yearly">Yearly</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </Form>
              </CardContent>
            </Card>

            {/* Conflicts Alert */}
            {conflicts.length > 0 && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <div className="font-medium mb-2">Budget Conflicts Detected:</div>
                  <div className="space-y-1">
                    {conflicts.map(category => (
                      <div key={category} className="flex items-center gap-2">
                        <span>• {getCategoryName(category)}</span>
                        <Badge variant="destructive" className="text-xs">Conflict</Badge>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-sm">
                    These categories already have budgets for the selected time period. Please adjust the dates or remove conflicting budgets.
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Budget Controls */}
            <div className="flex gap-2">
              <Button 
                onClick={resetTo50_30_20} 
                variant="outline" 
                className="flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Reset to 50/30/20 Rule
              </Button>
            </div>

            {/* Budget Allocations */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Budget Categories</h3>
              
              {["needs", "wants", "savings"].map(ruleCategory => {
                const categoryBudgets = budgetAllocations.filter(allocation => 
                  getRuleCategory(allocation.category) === ruleCategory
                );
                
                if (categoryBudgets.length === 0) return null;

                return (
                  <Card key={ruleCategory}>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2">
                        <Badge className={getRuleColor(ruleCategory)}>
                          {ruleCategory === "needs" ? "50% - Needs" : 
                           ruleCategory === "wants" ? "30% - Wants" : "20% - Savings/Debt"}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {categoryBudgets.map(allocation => (
                        <div key={allocation.category} className={`p-4 rounded-lg border transition-all ${
                          allocation.enabled ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'
                        } ${conflicts.includes(allocation.category) ? 'border-red-300 bg-red-50' : ''}`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{allocation.icon}</span>
                              <div>
                                <div className="font-medium">{getCategoryName(allocation.category)}</div>
                                <div className="text-sm text-gray-500">
                                  {allocation.percentage.toFixed(1)}% • {formatCurrency(allocation.amount)}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {conflicts.includes(allocation.category) && (
                                <Badge variant="destructive" className="text-xs">Conflict</Badge>
                              )}
                              <Button
                                variant={allocation.enabled ? "destructive" : "outline"}
                                size="sm"
                                onClick={() => toggleBudgetEnabled(allocation.category)}
                              >
                                {allocation.enabled ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                              </Button>
                            </div>
                          </div>
                          
                          {allocation.enabled && (
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm text-gray-600">
                                <span>Percentage</span>
                                <span>{allocation.percentage.toFixed(1)}%</span>
                              </div>
                              <Slider
                                value={[allocation.percentage]}
                                onValueChange={(value) => updatePercentage(allocation.category, value[0])}
                                max={50}
                                step={0.5}
                                className="w-full"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Create Budgets Button */}
            <Card>
              <CardContent className="pt-6">
                <Button 
                  onClick={handleCreateAllBudgets}
                  disabled={createBudgetsMutation.isPending || conflicts.length > 0 || !totalIncome}
                  className="w-full py-3"
                >
                  {createBudgetsMutation.isPending ? (
                    "Creating Budgets..."
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Create All Budgets ({budgetAllocations.filter(a => a.enabled).length} categories)
                    </>
                  )}
                </Button>
                
                {totalPercentage !== 100 && totalIncome && (
                  <div className="mt-2 text-center text-sm text-orange-600">
                    ⚠️ Total allocation is {totalPercentage.toFixed(1)}% (recommend 100%)
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Single Budget Creation Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingBudget ? "Edit Budget" : "Create New Budget"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {budgetCategories.map((category) => (
                            <SelectItem key={category.value} value={category.value}>
                              <div className="flex items-center space-x-2">
                                <span>{category.icon}</span>
                                <span>{category.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Enter amount"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="period"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Period</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select period" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button type="submit" disabled={createBudgetMutation.isPending} className="flex-1">
                    {createBudgetMutation.isPending ? "Creating..." : editingBudget ? "Update Budget" : "Create Budget"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCloseDialog} className="flex-1">
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </main>

      <BottomNavigation />
    </div>
  );
}