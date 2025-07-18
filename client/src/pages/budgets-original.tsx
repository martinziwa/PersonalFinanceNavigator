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
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("dateAdded");
  
  // Transaction History States
  const [selectedBudgetForHistory, setSelectedBudgetForHistory] = useState<any>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  
  // Budget Allocator States
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
  const { budgetCategories, addCustomCategory } = useCategories();
  const { toast } = useToast();

  // Initialize budget allocations with 50/30/20 rule
  useEffect(() => {
    const initialAllocations: BudgetAllocation[] = budgetCategories.map(category => {
      let percentage = 0;
      
      // Categorize based on 50/30/20 rule
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

    setConflicts(conflictingCategories);
  }, [budgetAllocations, budgets, form.watch("startDate"), form.watch("endDate"), form.watch("period")]);

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
      const errorMessage = error.message || "Failed to create budget. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const updateBudgetMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertBudget> }) => {
      const response = await apiRequest("PUT", `/api/budgets/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      handleCloseDialog();
      toast({
        title: "Budget updated",
        description: "Your budget has been updated successfully.",
      });
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Failed to update budget. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const deleteBudgetMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/budgets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({
        title: "Budget deleted",
        description: "Your budget has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete budget. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateNew = () => {
    setEditingBudget(null);
    setIsDialogOpen(true);
  };

  const handleEditBudget = (budget: any) => {
    setEditingBudget(budget);
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

    if (editingBudget) {
      updateBudgetMutation.mutate({ id: editingBudget.id, data: submitData });
    } else {
      createBudgetMutation.mutate(submitData);
    }
  };

  const handleAddCustomCategory = () => {
    if (customCategoryInput.trim()) {
      const categoryValue = addCustomCategory(customCategoryInput.trim());
      form.setValue("category", categoryValue);
      form.setValue("icon", "📝");
      setCustomCategoryInput("");
      setIsAddingCustomCategory(false);
    }
  };

  const handleShowTransactionHistory = (budget: any) => {
    setSelectedBudgetForHistory(budget);
    setIsHistoryModalOpen(true);
  };

  const handleCloseHistoryModal = () => {
    setIsHistoryModalOpen(false);
    setSelectedBudgetForHistory(null);
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
      // Reset form
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

  // Reset form when dialog opens/closes or when editing
  useEffect(() => {
    if (isDialogOpen) {
      if (editingBudget) {
        form.reset({
          category: editingBudget.category,
          amount: editingBudget.amount,
          period: editingBudget.period,
          startDate: new Date(editingBudget.startDate).toISOString().split('T')[0],
          endDate: new Date(editingBudget.endDate).toISOString().split('T')[0],
          icon: editingBudget.icon,
          description: editingBudget.description || "",
        });
      } else {
        form.reset({
          category: "",
          amount: "",
          period: "monthly",
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          icon: "",
          description: "",
        });
      }
      setIsAddingCustomCategory(false);
      setCustomCategoryInput("");
    }
  }, [isDialogOpen, editingBudget, form]);

  const allCategories = budgetCategories;

  const filteredBudgets = budgets.filter(budget => {
    if (categoryFilter === "all") return true;
    return budget.category === categoryFilter;
  });

  // Group budgets by start month
  // Calculate total budget stats for the selected period
  const totalBudgetStats = useMemo(() => {
    const overviewStart = new Date(overviewStartDate);
    const overviewEnd = new Date(overviewEndDate);
    
    // Filter budgets that overlap with the overview period
    const applicableBudgets = filteredBudgets.filter(budget => {
      const budgetStart = new Date(budget.startDate);
      const budgetEnd = new Date(budget.endDate);
      // Check if budget period overlaps with overview period
      return budgetStart <= overviewEnd && budgetEnd >= overviewStart;
    });
    
    const totalAmount = applicableBudgets.reduce((sum, budget) => sum + parseFloat(budget.amount), 0);
    const totalSpent = applicableBudgets.reduce((sum, budget) => sum + parseFloat(budget.spent), 0);
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
  }, [filteredBudgets, overviewStartDate, overviewEndDate]);

  const budgetsByMonth = useMemo(() => {
    const grouped = filteredBudgets.reduce((acc, budget) => {
      const startDate = new Date(budget.startDate);
      const monthKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = startDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long' 
      });
      
      if (!acc[monthKey]) {
        acc[monthKey] = {
          label: monthLabel,
          budgets: [],
          sortDate: startDate
        };
      }
      
      acc[monthKey].budgets.push(budget);
      return acc;
    }, {} as Record<string, { label: string; budgets: any[]; sortDate: Date }>);

    // Sort months chronologically (most recent first)
    return Object.entries(grouped)
      .sort(([, a], [, b]) => b.sortDate.getTime() - a.sortDate.getTime())
      .map(([key, value]) => ({ key, ...value }));
  }, [filteredBudgets]);

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

        {/* Total Budget Card */}
        {filteredBudgets.length > 0 && (
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

        {/* Budget List */}
        <div className="space-y-6">
          {filteredBudgets.length === 0 ? (
            <div className="bg-white rounded-xl p-6 border border-gray-100 text-center">
              <div className="text-4xl mb-3">💰</div>
              <p className="text-gray-500">No budgets yet</p>
              <p className="text-sm text-gray-400 mt-1">Create your first budget to start tracking your spending</p>
            </div>
          ) : (
            budgetsByMonth.map((monthGroup) => (
              <div key={monthGroup.key} className="space-y-4">
                {/* Month Header */}
                <div className="flex items-center space-x-3">
                  <div className="h-px bg-gray-200 flex-1"></div>
                  <div className="bg-gray-50 px-4 py-2 rounded-full border border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700">
                      {monthGroup.label}
                    </h3>
                  </div>
                  <div className="h-px bg-gray-200 flex-1"></div>
                </div>
                
                {/* Budgets for this month */}
                <div className="space-y-3">
                  {monthGroup.budgets.map((budget) => {
                    const categoryTransactions = transactions.filter((transaction: Transaction) => {
                      return transaction.category === budget.category && 
                             transaction.type === "expense" &&
                             new Date(transaction.date) >= new Date(budget.startDate) &&
                             new Date(transaction.date) <= new Date(budget.endDate);
                    });

                    const totalSpent = categoryTransactions.reduce((total: number, transaction: Transaction) => {
                      return total + parseFloat(transaction.amount);
                    }, 0);

                    const budgetAmount = parseFloat(budget.amount);
                    const percentage = budgetAmount > 0 ? (totalSpent / budgetAmount) * 100 : 0;
                    const isOverBudget = percentage > 100;

                    return (
                      <div key={budget.id} className="bg-white rounded-xl p-4 border border-gray-100">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                              <span className="text-lg">{budget.icon}</span>
                            </div>
                            <div>
                              <h3 className="font-medium text-gray-900 capitalize">
                                {budget.category.replace('_', ' ')}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {formatCurrency(totalSpent)} of {formatCurrency(budgetAmount)}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleShowTransactionHistory(budget)}
                              className="p-2 text-purple-600 hover:bg-purple-50"
                              title="View transaction history"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditBudget(budget)}
                              className="p-2 text-blue-600 hover:bg-blue-50"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteBudgetMutation.mutate(budget.id)}
                              disabled={deleteBudgetMutation.isPending}
                              className="p-2 text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Spending Progress</span>
                              <span className={`font-medium ${isOverBudget ? 'text-red-600' : 'text-gray-900'}`}>
                                {percentage.toFixed(1)}%
                              </span>
                            </div>
                            <ProgressBar
                              percentage={percentage}
                              color={
                                isOverBudget ? "bg-red-500" :
                                percentage > 80 ? "bg-yellow-500" :
                                "bg-green-500"
                              }
                            />
                          </div>
                          
                          {(() => {
                            const now = new Date();
                            const startDate = new Date(budget.startDate);
                            const endDate = new Date(budget.endDate);
                            
                            const totalDuration = endDate.getTime() - startDate.getTime();
                            const elapsedTime = Math.max(0, now.getTime() - startDate.getTime());
                            const timePercentage = Math.min(100, (elapsedTime / totalDuration) * 100);
                            
                            const daysTotal = Math.ceil(totalDuration / (1000 * 60 * 60 * 24));
                            const daysElapsed = Math.floor(elapsedTime / (1000 * 60 * 60 * 24));
                            const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                            
                            return (
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Time Progress</span>
                                  <span className="font-medium text-gray-900">
                                    {timePercentage.toFixed(1)}%
                                  </span>
                                </div>
                                <ProgressBar
                                  percentage={timePercentage}
                                  color="bg-blue-500"
                                />
                                <div className="flex justify-between text-xs text-gray-500">
                                  <span>{daysElapsed} of {daysTotal} days</span>
                                  <span>
                                    {daysRemaining > 0 ? `${daysRemaining} days left` : 'Budget period ended'}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                          
                          {/* Budget Tracking Comment */}
                          {(() => {
                            const now = new Date();
                            const startDate = new Date(budget.startDate);
                            const endDate = new Date(budget.endDate);
                            
                            const totalDuration = endDate.getTime() - startDate.getTime();
                            const elapsedTime = Math.max(0, now.getTime() - startDate.getTime());
                            const timePercentage = Math.min(100, (elapsedTime / totalDuration) * 100);
                            
                            const spendingPercentage = percentage;
                            const difference = spendingPercentage - timePercentage;
                            
                            // Don't show tracking for ended budgets
                            if (now > endDate) {
                              return null;
                            }
                            
                            let trackingMessage = "";
                            let trackingColor = "";
                            let trackingIcon = "";
                            
                            if (Math.abs(difference) <= 5) {
                              // On track (within 5% difference)
                              trackingMessage = "You're on track with your spending";
                              trackingColor = "text-green-600";
                              trackingIcon = "✓";
                            } else if (difference > 5) {
                              // Overspending
                              if (difference > 20) {
                                trackingMessage = "You're spending much faster than planned";
                                trackingColor = "text-red-600";
                                trackingIcon = "⚠️";
                              } else {
                                trackingMessage = "You're spending faster than planned";
                                trackingColor = "text-orange-500";
                                trackingIcon = "⚡";
                              }
                            } else {
                              // Underspending
                              if (Math.abs(difference) > 20) {
                                trackingMessage = "You have plenty of budget remaining";
                                trackingColor = "text-blue-600";
                                trackingIcon = "💰";
                              } else {
                                trackingMessage = "You're doing well with your budget";
                                trackingColor = "text-green-600";
                                trackingIcon = "👍";
                              }
                            }
                            
                            return (
                              <div className={`text-xs ${trackingColor} font-medium mt-2 flex items-center space-x-1`}>
                                <span>{trackingIcon}</span>
                                <span>{trackingMessage}</span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Scrollable Budget Form Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
          <DialogContent className="max-w-sm mx-auto max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>{editingBudget ? "Edit Budget" : "Create Budget"}</DialogTitle>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto px-1">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={(value) => {
                            field.onChange(value);
                            const selectedCategory = allCategories.find(cat => cat.value === value);
                            if (selectedCategory) {
                              form.setValue("icon", selectedCategory.icon);
                            }
                          }}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                            <SelectContent>
                              {allCategories.map((category) => (
                                <SelectItem key={category.value} value={category.value}>
                                  <div className="flex items-center space-x-2">
                                    <span>{category.icon}</span>
                                    <span>{category.label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                              <SelectItem value="add_custom">
                                <div className="flex items-center space-x-2">
                                  <Plus className="h-4 w-4" />
                                  <span>Add custom category</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                        
                        {form.watch("category") === "add_custom" && (
                          <div className="mt-2 space-y-2">
                            <Input
                              placeholder="Enter custom category name"
                              value={customCategoryInput}
                              onChange={(e) => setCustomCategoryInput(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                onClick={handleAddCustomCategory}
                                size="sm"
                                className="flex-1"
                              >
                                Add Category
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  form.setValue("category", "");
                                  setCustomCategoryInput("");
                                }}
                                size="sm"
                                className="flex-1"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
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
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter description" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCloseDialog}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createBudgetMutation.isPending || updateBudgetMutation.isPending}
                      className="flex-1"
                    >
                      {editingBudget ? "Update Budget" : "Create Budget"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </DialogContent>
        </Dialog>

        {/* Transaction History Modal */}
        <Dialog open={isHistoryModalOpen} onOpenChange={handleCloseHistoryModal}>
          <DialogContent className="max-w-sm mx-auto max-h-[85vh] flex flex-col p-0">
            <DialogHeader className="flex-shrink-0 p-6 pb-4 border-b border-gray-200">
              <DialogTitle className="flex items-center justify-between">
                <span>Transaction History</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseHistoryModal}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </DialogTitle>
              {selectedBudgetForHistory && (
                <div className="text-sm text-gray-600">
                  <div className="flex items-center space-x-2 mt-2">
                    <span className="text-lg">{selectedBudgetForHistory.icon}</span>
                    <div>
                      <h4 className="font-medium capitalize">
                        {selectedBudgetForHistory.category.replace('_', ' ')}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {new Date(selectedBudgetForHistory.startDate).toLocaleDateString()} - {new Date(selectedBudgetForHistory.endDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
              {selectedBudgetForHistory && (() => {
                const budgetTransactions = getBudgetTransactions(selectedBudgetForHistory);
                const totalSpent = budgetTransactions.reduce((total, transaction) => total + parseFloat(transaction.amount), 0);
                const budgetAmount = parseFloat(selectedBudgetForHistory.amount);
                
                return (
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Budget Summary</span>
                        <span className={`text-sm font-semibold ${totalSpent > budgetAmount ? 'text-red-600' : 'text-green-600'}`}>
                          {((totalSpent / budgetAmount) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <div className="flex justify-between">
                          <span>Spent:</span>
                          <span className="font-medium">{formatCurrency(totalSpent)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Budget:</span>
                          <span className="font-medium">{formatCurrency(budgetAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Remaining:</span>
                          <span className={`font-medium ${budgetAmount - totalSpent < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(budgetAmount - totalSpent)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between sticky top-0 bg-white z-10 py-2">
                        <h5 className="font-medium text-gray-900">
                          Transactions ({budgetTransactions.length})
                        </h5>
                        {budgetTransactions.length > 0 && (
                          <span className="text-xs text-gray-500">
                            Latest first
                          </span>
                        )}
                      </div>
                      
                      {budgetTransactions.length === 0 ? (
                        <div className="text-center py-12">
                          <div className="text-4xl mb-3">📊</div>
                          <p className="text-gray-500 font-medium">No transactions yet</p>
                          <p className="text-sm text-gray-400 mt-1">
                            Transactions in this category will appear here
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3 pb-4">
                          {budgetTransactions
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map((transaction, index) => (
                            <div 
                              key={transaction.id} 
                              className="bg-gray-50 border border-gray-200 rounded-lg p-3 hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between mb-2">
                                    <h6 className="font-medium text-gray-900 text-sm leading-tight truncate pr-2">
                                      {transaction.description || 'No description'}
                                    </h6>
                                    <span className="font-semibold text-red-600 text-sm whitespace-nowrap">
                                      -{formatCurrency(parseFloat(transaction.amount))}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs text-gray-500">
                                    <span>
                                      {new Date(transaction.date).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: new Date(transaction.date).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                                      })}
                                    </span>
                                    {transaction.time && (
                                      <span className="font-mono">{transaction.time}</span>
                                    )}
                                  </div>
                                  {index === 0 && budgetTransactions.length > 1 && (
                                    <div className="mt-1 text-xs text-blue-600 font-medium">
                                      Most recent
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          {budgetTransactions.length > 10 && (
                            <div className="text-center pt-4 border-t border-gray-200">
                              <p className="text-xs text-gray-500">
                                Showing all {budgetTransactions.length} transactions
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </DialogContent>
        </Dialog>
          </TabsContent>

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
      </main>

      <BottomNavigation />
    </div>
  );
}