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
  
  // Helper function to format date for input without timezone issues
  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Date range state for budget overview
  const [overviewStartDate, setOverviewStartDate] = useState(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return formatDateForInput(firstDay);
  });
  const [overviewEndDate, setOverviewEndDate] = useState(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return formatDateForInput(lastDay);
  });
  
  const { data: budgets = [], isLoading } = useBudgets();
  const { data: transactions = [] } = useTransactions();
  const { budgetCategories } = useCategories();
  const { toast } = useToast();

  // Calculate total budget stats for the selected period
  const totalBudgetStats = useMemo(() => {
    const overviewStart = new Date(overviewStartDate);
    const overviewEnd = new Date(overviewEndDate);
    
    // Filter budgets that overlap with the overview period
    const applicableBudgets = budgets.filter(budget => {
      const budgetStart = new Date(budget.startDate);
      const budgetEnd = new Date(budget.endDate);
      // Check if budget period overlaps with overview period
      return budgetStart <= overviewEnd && budgetEnd >= overviewStart;
    });
    
    const totalAmount = applicableBudgets.reduce((sum, budget) => sum + parseFloat(budget.amount), 0);
    
    // Calculate actual spending from transactions for each applicable budget
    const totalSpent = applicableBudgets.reduce((sum, budget) => {
      const budgetTransactions = transactions.filter((transaction: Transaction) => {
        const transactionDate = new Date(transaction.date);
        const budgetStart = new Date(budget.startDate);
        const budgetEnd = new Date(budget.endDate);
        
        return transaction.category === budget.category && 
               transaction.type === "expense" &&
               transactionDate >= budgetStart &&
               transactionDate <= budgetEnd &&
               // Also check if transaction falls within overview period
               transactionDate >= overviewStart &&
               transactionDate <= overviewEnd;
      });
      
      const categorySpent = budgetTransactions.reduce((total, transaction) => {
        return total + parseFloat(transaction.amount);
      }, 0);
      
      return sum + categorySpent;
    }, 0);
    
    const totalRemaining = totalAmount - totalSpent;
    const spentPercentage = totalAmount > 0 ? (totalSpent / totalAmount) * 100 : 0;
    
    // Calculate time progress
    const now = new Date();
    const totalPeriodDays = Math.ceil((overviewEnd.getTime() - overviewStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const elapsedDays = Math.max(0, Math.min(
      totalPeriodDays,
      Math.ceil((now.getTime() - overviewStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    ));
    const timeProgress = totalPeriodDays > 0 ? (elapsedDays / totalPeriodDays) * 100 : 0;
    
    return {
      totalAmount,
      totalSpent,
      totalRemaining,
      spentPercentage,
      budgetCount: applicableBudgets.length,
      timeProgress,
      elapsedDays,
      totalPeriodDays,
      applicableBudgets
    };
  }, [budgets, transactions, overviewStartDate, overviewEndDate]);

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

  const createBudgetMutation = useMutation({
    mutationFn: async (data: InsertBudget) => {
      return await apiRequest("POST", "/api/budgets", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({ title: "Budget created successfully!" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to create budget", variant: "destructive" });
    },
  });

  const createBudgetsMutation = useMutation({
    mutationFn: async ({ budgets }: { budgets: InsertBudget[] }) => {
      const promises = budgets.map(budget => apiRequest("POST", "/api/budgets", budget));
      return await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({
        title: "Success!",
        description: `Created ${budgetAllocations.filter(a => a.enabled).length} budgets successfully`,
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
             transaction.type === "expense" &&
             new Date(transaction.date) >= new Date(budget.startDate) &&
             new Date(transaction.date) <= new Date(budget.endDate);
    });
  };

  const calculateBudgetSpending = (budget: any, startDate: Date, endDate: Date) => {
    return transactions.filter((transaction: Transaction) => {
      const transactionDate = new Date(transaction.date);
      const budgetStart = new Date(budget.startDate);
      const budgetEnd = new Date(budget.endDate);
      
      return transaction.category === budget.category && 
             transaction.type === "expense" &&
             transactionDate >= budgetStart &&
             transactionDate <= budgetEnd &&
             transactionDate >= startDate &&
             transactionDate <= endDate;
    }).reduce((total, transaction) => total + parseFloat(transaction.amount), 0);
  };

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

            {/* Budget Overview */}
            {budgets.length > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="text-2xl">💼</div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Budget Overview</h3>
                      <p className="text-sm text-gray-600">{totalBudgetStats.budgetCount} applicable budgets</p>
                    </div>
                  </div>
                  <CalendarDays className="h-5 w-5 text-blue-600" />
                </div>

                {/* Date Range Selector */}
                <div className="space-y-2 mb-3">
                  <div className="flex space-x-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs px-2 py-1 h-6"
                      onClick={() => {
                        const now = new Date();
                        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                        setOverviewStartDate(formatDateForInput(firstDay));
                        setOverviewEndDate(formatDateForInput(lastDay));
                      }}
                    >
                      This Month
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs px-2 py-1 h-6"
                      onClick={() => {
                        const now = new Date();
                        const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                        const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
                        setOverviewStartDate(formatDateForInput(firstDay));
                        setOverviewEndDate(formatDateForInput(lastDay));
                      }}
                    >
                      Last Month
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs px-2 py-1 h-6"
                      onClick={() => {
                        const now = new Date();
                        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
                        const quarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);
                        setOverviewStartDate(formatDateForInput(quarterStart));
                        setOverviewEndDate(formatDateForInput(quarterEnd));
                      }}
                    >
                      Quarter
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-600 block mb-1">From</label>
                      <input
                        type="date"
                        value={overviewStartDate}
                        onChange={(e) => setOverviewStartDate(e.target.value)}
                        className="w-full text-xs p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600 block mb-1">To</label>
                      <input
                        type="date"
                        value={overviewEndDate}
                        onChange={(e) => setOverviewEndDate(e.target.value)}
                        className="w-full text-xs p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="text-center">
                    <p className="text-xs text-gray-600 mb-1">Budgeted</p>
                    <p className="font-semibold text-blue-600">{formatCurrency(totalBudgetStats.totalAmount)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-600 mb-1">Spent</p>
                    <p className="font-semibold text-orange-600">{formatCurrency(totalBudgetStats.totalSpent)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-600 mb-1">Remaining</p>
                    <p className={`font-semibold ${totalBudgetStats.totalRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(totalBudgetStats.totalRemaining)}
                    </p>
                  </div>
                </div>

                {/* Spending Progress Bar */}
                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Spending Progress</span>
                    <span>{totalBudgetStats.spentPercentage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        totalBudgetStats.spentPercentage > 100 ? 'bg-red-500' :
                        totalBudgetStats.spentPercentage > 80 ? 'bg-orange-500' :
                        'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(totalBudgetStats.spentPercentage, 100)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Time Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Time Progress</span>
                    <span>{totalBudgetStats.timeProgress.toFixed(1)}% ({totalBudgetStats.elapsedDays}/{totalBudgetStats.totalPeriodDays} days)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full transition-all duration-300 bg-gray-500"
                      style={{ width: `${Math.min(totalBudgetStats.timeProgress, 100)}%` }}
                    ></div>
                  </div>
                  {/* Spending vs Time Indicator */}
                  {totalBudgetStats.timeProgress > 0 && (
                    <div className="text-xs text-center">
                      {totalBudgetStats.spentPercentage > totalBudgetStats.timeProgress + 10 ? (
                        <span className="text-red-600">⚠️ Spending ahead of schedule</span>
                      ) : totalBudgetStats.spentPercentage < totalBudgetStats.timeProgress - 10 ? (
                        <span className="text-green-600">✓ Spending on track</span>
                      ) : (
                        <span className="text-blue-600">📊 Spending balanced</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {budgets.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <PieChart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No budgets created yet</p>
                <p className="text-sm">Create your first budget to start tracking expenses</p>
              </div>
            ) : (
              <div className="space-y-4">
                {budgets.map((budget) => {
                  const categoryTransactions = getBudgetTransactions(budget);
                  const totalSpent = categoryTransactions.reduce((total: number, transaction: Transaction) => {
                    return total + parseFloat(transaction.amount);
                  }, 0);
                  const budgetAmount = parseFloat(budget.amount);
                  const spentPercentage = budgetAmount > 0 ? (totalSpent / budgetAmount) * 100 : 0;
                  const remainingAmount = budgetAmount - totalSpent;

                  return (
                    <Card key={budget.id} className="border border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="text-2xl">{budget.icon}</div>
                            <div>
                              <h3 className="font-semibold text-gray-900 capitalize">
                                {budget.category.replace('_', ' ')}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {new Date(budget.startDate).toLocaleDateString()} - {new Date(budget.endDate).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingBudget(budget);
                                setIsDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                try {
                                  await apiRequest("DELETE", `/api/budgets/${budget.id}`);
                                  queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
                                  toast({ title: "Budget deleted successfully!" });
                                } catch (error) {
                                  toast({ title: "Failed to delete budget", variant: "destructive" });
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span>Spent: {formatCurrency(totalSpent)}</span>
                            <span>Budget: {formatCurrency(budgetAmount)}</span>
                          </div>
                          <ProgressBar 
                            percentage={spentPercentage}
                            color={spentPercentage > 100 ? "bg-red-500" : spentPercentage > 80 ? "bg-orange-500" : "bg-green-500"}
                          />
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>{spentPercentage.toFixed(1)}% used</span>
                            <span className={remainingAmount >= 0 ? "text-green-600" : "text-red-600"}>
                              {remainingAmount >= 0 ? "Remaining: " : "Over by: "}{formatCurrency(Math.abs(remainingAmount))}
                            </span>
                          </div>

                          {/* Time Progress for Individual Budget */}
                          {(() => {
                            const budgetStart = new Date(budget.startDate);
                            const budgetEnd = new Date(budget.endDate);
                            const now = new Date();
                            const totalDays = Math.ceil((budgetEnd.getTime() - budgetStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                            const elapsedDays = Math.max(0, Math.min(
                              totalDays,
                              Math.ceil((now.getTime() - budgetStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
                            ));
                            const timeProgress = totalDays > 0 ? (elapsedDays / totalDays) * 100 : 0;
                            const daysRemaining = Math.max(0, totalDays - elapsedDays);

                            return (
                              <div className="pt-2 border-t border-gray-100">
                                <div className="flex justify-between text-xs text-gray-600 mb-1">
                                  <span>Time Progress</span>
                                  <span>{timeProgress.toFixed(1)}% ({elapsedDays}/{totalDays} days)</span>
                                </div>
                                <ProgressBar 
                                  percentage={timeProgress}
                                  color="bg-gray-400"
                                  height="h-1"
                                />
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                  <span>{elapsedDays} of {totalDays} days</span>
                                  <span>
                                    {daysRemaining > 0 ? `${daysRemaining} days left` : 'Budget period ended'}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
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
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Budget Allocator</CardTitle>
                    <p className="text-sm text-gray-600">Automatically create budgets using the 50/30/20 rule</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetTo50_30_20}
                    className="flex items-center gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Monthly Income
                  </label>
                  <Input
                    type="number"
                    placeholder="Enter your total monthly income"
                    value={totalIncome}
                    onChange={(e) => setTotalIncome(e.target.value)}
                    className="mb-2"
                  />
                  {totalIncome && (
                    <p className="text-sm text-gray-600">
                      Total Budget: {formatCurrency(totalAmount)} ({totalPercentage.toFixed(1)}%)
                    </p>
                  )}
                </div>

                {/* Date Range for Budget Allocator */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Start Date</label>
                    <Input
                      type="date"
                      {...form.register("startDate")}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">End Date</label>
                    <Input
                      type="date"
                      {...form.register("endDate")}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Period</label>
                  <Select defaultValue="monthly" onValueChange={(value) => form.setValue("period", value as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {conflicts.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Conflicting budgets found for: {conflicts.join(", ")}. 
                      Please adjust the date range or disable conflicting categories.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Budget Categories */}
            <div className="space-y-4">
              {Object.entries(BUDGET_RULES).map(([ruleKey, rule]) => (
                <Card key={ruleKey}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base capitalize flex items-center justify-between">
                      <span>{ruleKey} ({rule.percentage}%)</span>
                      <Badge variant="outline">{rule.percentage}%</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {budgetAllocations
                      .filter(allocation => rule.categories.includes(allocation.category))
                      .map((allocation) => (
                        <div key={allocation.category} className={`p-3 rounded-lg border ${
                          conflicts.includes(allocation.category) ? 'border-red-300 bg-red-50' :
                          allocation.enabled ? 'border-gray-200' : 'border-gray-100 bg-gray-50'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">{allocation.icon}</span>
                              <span className="font-medium capitalize">
                                {allocation.category.replace('_', ' ')}
                              </span>
                              {totalIncome && (
                                <span className="text-sm text-gray-600">
                                  {formatCurrency(allocation.amount)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              {conflicts.includes(allocation.category) && (
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleBudgetEnabled(allocation.category)}
                                className={`h-6 w-6 p-0 ${allocation.enabled ? 'text-red-500' : 'text-green-500'}`}
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
              ))}
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