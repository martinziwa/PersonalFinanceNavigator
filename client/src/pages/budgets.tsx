import React, { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Trash2, CalendarDays, Calculator, RotateCcw, AlertTriangle, Check, X } from "lucide-react";
import Header from "@/components/layout/header";
import BottomNavigation from "@/components/layout/bottom-navigation";
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
import { Progress } from "@/components/ui/progress";
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

const BUDGET_RULES = {
  needs: { percentage: 50, categories: ["food", "transportation", "bills", "healthcare", "housing"] },
  wants: { percentage: 30, categories: ["entertainment", "shopping", "dining", "hobbies", "cosmetics"] },
  savings: { percentage: 20, categories: ["savings", "investment", "emergency", "debt"] }
};

export default function Budgets() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      icon: data.icon,
      description: data.description || null,
    };

    createBudgetMutation.mutate(submitData);
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
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
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

  const isValidAllocation = Math.abs(totalPercentage - 100) < 0.01;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg">Loading budgets...</div>
          </div>
        </div>
        <BottomNavigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 pb-20">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Budget Management</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="list">Budget List</TabsTrigger>
            <TabsTrigger value="allocator">Budget Allocator</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Budget
              </Button>
            </div>

            {budgets.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <CalendarDays className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">No budgets yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first budget to start tracking your spending goals.
                  </p>
                  <Button onClick={() => setIsDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Budget
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {budgets.map((budget) => {
                  const categoryTransactions = transactions.filter((transaction: Transaction) => {
                    const transactionDate = new Date(transaction.date);
                    const budgetStart = new Date(budget.startDate);
                    const budgetEnd = new Date(budget.endDate);
                    return transaction.category === budget.category &&
                           transaction.type === "expense" &&
                           transactionDate >= budgetStart &&
                           transactionDate <= budgetEnd;
                  });
                  
                  const totalSpent = categoryTransactions.reduce((total: number, transaction: Transaction) => {
                    return total + parseFloat(transaction.amount);
                  }, 0);
                  
                  const budgetAmount = parseFloat(budget.amount);
                  const remainingAmount = budgetAmount - totalSpent;
                  const spentPercentage = budgetAmount > 0 ? (totalSpent / budgetAmount) * 100 : 0;

                  return (
                    <div key={budget.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{budget.icon}</div>
                        <div>
                          <h3 className="font-medium capitalize">{getCategoryName(budget.category)}</h3>
                          <p className="text-sm text-muted-foreground">
                            {new Date(budget.startDate).toLocaleDateString()} - {new Date(budget.endDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        <div className="text-lg font-semibold">
                          {formatCurrency(budgetAmount)}
                        </div>
                        <Progress value={Math.min(spentPercentage, 100)} className="w-32" />
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(totalSpent)} spent • {formatCurrency(remainingAmount)} remaining
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteBudgetMutation.mutate(budget.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="allocator" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Budget Allocator (50/30/20 Rule)
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetTo50_30_20}
                    className="ml-auto"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset to 50/30/20
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="income">Total Income (MWK)</Label>
                    <Input
                      id="income"
                      type="number"
                      placeholder="Enter your total income"
                      value={totalIncome}
                      onChange={(e) => setTotalIncome(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Allocation Summary</Label>
                    <div className="p-3 border rounded-lg">
                      <div className="text-sm text-muted-foreground">
                        Total: {totalPercentage.toFixed(1)}% ({formatCurrency(totalAmount)})
                      </div>
                      {!isValidAllocation && (
                        <div className="text-sm text-destructive mt-1">
                          Allocation must total 100%
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {allocatorConflicts.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Budget conflicts detected for: {allocatorConflicts.join(", ")}. 
                      These categories already have budgets for the selected period.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Budget Categories</h3>
                  <div className="space-y-4">
                    {["needs", "wants", "savings"].map((ruleType) => (
                      <div key={ruleType} className="space-y-3">
                        <h4 className="font-medium capitalize flex items-center gap-2">
                          {ruleType} ({BUDGET_RULES[ruleType as keyof typeof BUDGET_RULES].percentage}% recommended)
                        </h4>
                        <div className="grid gap-3">
                          {budgetAllocations
                            .filter(allocation => getRuleCategory(allocation.category) === ruleType)
                            .map((allocation) => (
                              <div key={allocation.category} className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <input
                                      type="checkbox"
                                      checked={allocation.enabled}
                                      onChange={() => toggleBudgetEnabled(allocation.category)}
                                      className="rounded"
                                    />
                                    <span className="text-xl">{allocation.icon}</span>
                                    <span className="capitalize font-medium">{getCategoryName(allocation.category)}</span>
                                    {allocatorConflicts.includes(allocation.category) && (
                                      <Badge variant="destructive">Conflict</Badge>
                                    )}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {allocation.percentage.toFixed(1)}% ({formatCurrency(allocation.amount)})
                                  </div>
                                </div>
                                {allocation.enabled && (
                                  <div className="ml-8">
                                    <Slider
                                      value={[allocation.percentage]}
                                      onValueChange={([value]) => updatePercentage(allocation.category, value)}
                                      max={50}
                                      step={0.5}
                                      className="w-full"
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onAllocatorSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="period"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Budget Period</FormLabel>
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

                    <div className="flex gap-3">
                      <Button
                        type="submit"
                        disabled={!isValidAllocation || !totalIncome || createBudgetsMutation.isPending}
                        className="flex-1"
                      >
                        {createBudgetsMutation.isPending ? (
                          <>Creating Budgets...</>
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Create All Budgets
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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
                      <Select onValueChange={(value) => {
                        field.onChange(value);
                        const category = budgetCategories.find(cat => cat.value === value);
                        if (category) {
                          form.setValue("icon", category.icon);
                        }
                      }}>
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
                                <span className="capitalize">{category.label}</span>
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
                      <FormLabel>Budget Amount (MWK)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
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
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Budget description..." {...field} />
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
      </div>
      <BottomNavigation />
    </div>
  );
}