import React, { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Trash2, Edit, PieChart, History, X, CalendarDays, Calculator, RotateCcw, AlertTriangle, Check } from "lucide-react";
import Header from "@/components/layout/header";
import BottomNavigation from "@/components/layout/bottom-navigation";
import ProgressBar from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

// Budget allocator types
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
  const [activeTab, setActiveTab] = useState("list");
  const [totalIncome, setTotalIncome] = useState<string>("");
  const [budgetAllocations, setBudgetAllocations] = useState<BudgetAllocation[]>([]);
  const [allocatorConflicts, setAllocatorConflicts] = useState<string[]>([]);
  
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
  }, [budgetCategories]);

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

  // Check for conflicts with existing budgets
  useEffect(() => {
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

    setAllocatorConflicts(conflictingCategories);
  }, [budgetAllocations, budgets, form.watch("startDate"), form.watch("endDate"), form.watch("period")]);

  const createBudgetMutation = useMutation({
    mutationFn: async (data: InsertBudget) => {
      return apiRequest("/api/budgets", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({
        title: "Success",
        description: "Budget created successfully!",
      });
      setIsDialogOpen(false);
      setEditingBudget(null);
      form.reset();
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
      setActiveTab("list");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create budgets",
        variant: "destructive",
      });
    },
  });

  const deleteBudgetMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/budgets/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({
        title: "Success",
        description: "Budget deleted successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete budget",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BudgetFormData) => {
    const submitData: InsertBudget = {
      category: data.category,
      amount: data.amount,
      period: data.period,
      startDate: data.startDate,
      endDate: data.endDate,
      icon: data.icon,
      description: data.description || null,
    };

    createBudgetMutation.mutate(submitData);
  };

  // Budget Allocator Functions
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

  const onAllocatorSubmit = (data: BudgetFormData) => {
    if (!totalIncome || parseFloat(totalIncome) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid total income amount",
        variant: "destructive",
      });
      return;
    }

    if (allocatorConflicts.length > 0) {
      toast({
        title: "Error",
        description: "Please resolve budget conflicts before creating budgets",
        variant: "destructive",
      });
      return;
    }

    const budgetsToCreate: InsertBudget[] = budgetAllocations
      .filter(allocation => allocation.enabled && allocation.amount > 0)
      .map(allocation => ({
        category: allocation.category,
        amount: allocation.amount.toString(),
        period: data.period,
        startDate: data.startDate,
        endDate: data.endDate,
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="list">Budget List</TabsTrigger>
            <TabsTrigger value="allocator">Budget Allocator</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            <div className="flex items-center justify-between">
              <Button
                onClick={() => setIsDialogOpen(true)}
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
                <p className="text-gray-500 mb-4">Create your first budget to start tracking your spending</p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Budget
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {budgets.map((budget) => {
                  const categoryTransactions = transactions.filter((transaction: Transaction) => {
                    const transactionDate = new Date(transaction.date);
                    const budgetStart = new Date(budget.startDate);
                    const budgetEnd = new Date(budget.endDate);
                    return transaction.category === budget.category &&
                           transactionDate >= budgetStart &&
                           transactionDate <= budgetEnd;
                  });
                  
                  const totalSpent = categoryTransactions.reduce((total: number, transaction: Transaction) => {
                    return total + parseFloat(transaction.amount);
                  }, 0);
                  
                  const budgetAmount = parseFloat(budget.amount);
                  const remainingAmount = budgetAmount - totalSpent;
                  const spentPercentage = budgetAmount > 0 ? (totalSpent / budgetAmount) * 100 : 0;
                  const isOverBudget = totalSpent > budgetAmount;

                  return (
                    <div key={budget.id} className="bg-white rounded-xl p-4 border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{budget.icon}</span>
                          <div>
                            <h3 className="font-semibold text-gray-900">{getCategoryName(budget.category)}</h3>
                            <p className="text-sm text-gray-500">{budget.period}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteBudgetMutation.mutate(budget.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Spent: {formatCurrency(totalSpent)}</span>
                          <span className={isOverBudget ? "text-red-600" : "text-gray-600"}>
                            Budget: {formatCurrency(budgetAmount)}
                          </span>
                        </div>
                        
                        <ProgressBar 
                          progress={Math.min(spentPercentage, 100)} 
                          className={isOverBudget ? "bg-red-500" : "bg-blue-500"}
                        />
                        
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{spentPercentage.toFixed(1)}% used</span>
                          <span className={isOverBudget ? "text-red-600" : ""}>
                            {isOverBudget ? "Over by " : "Remaining: "}
                            {formatCurrency(Math.abs(remainingAmount))}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="allocator" className="space-y-4">
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
                    <Label htmlFor="totalIncome">Enter your total income for budget allocation</Label>
                    <Input
                      id="totalIncome"
                      type="number"
                      placeholder="Enter amount (MWK)"
                      value={totalIncome}
                      onChange={(e) => setTotalIncome(e.target.value)}
                      className="mt-1"
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
            {allocatorConflicts.length > 0 && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <div className="font-medium mb-2">Budget Conflicts Detected:</div>
                  <div className="space-y-1">
                    {allocatorConflicts.map(category => (
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
                        } ${allocatorConflicts.includes(allocation.category) ? 'border-red-300 bg-red-50' : ''}`}>
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
                              {allocatorConflicts.includes(allocation.category) && (
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
                  onClick={form.handleSubmit(onAllocatorSubmit)}
                  disabled={createBudgetsMutation.isPending || allocatorConflicts.length > 0 || !totalIncome}
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

        {/* Create Budget Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Budget</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {budgetCategories.map((category) => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.icon} {category.label}
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
                      <FormLabel>Budget Amount (MWK)</FormLabel>
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
                            <SelectValue />
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

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Budget description"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createBudgetMutation.isPending}>
                    {createBudgetMutation.isPending ? "Creating..." : "Create Budget"}
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