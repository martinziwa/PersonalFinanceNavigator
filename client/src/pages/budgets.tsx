import React, { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Trash2, Edit, PieChart, History, X, CalendarDays } from "lucide-react";
import Header from "@/components/layout/header";
import BottomNavigation from "@/components/layout/bottom-navigation";
import ProgressBar from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  
  // Date range state for budget overview
  const [overviewStartDate, setOverviewStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [overviewEndDate, setOverviewEndDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  
  const { data: budgets = [], isLoading } = useBudgets();
  const { data: transactions = [] } = useTransactions();
  const { budgetCategories, addCustomCategory } = useCategories();
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
      startDate: data.startDate,
      endDate: data.endDate,
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
                    setOverviewStartDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
                    setOverviewEndDate(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]);
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
                    setOverviewStartDate(new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]);
                    setOverviewEndDate(new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0]);
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
                    setOverviewStartDate(quarterStart.toISOString().split('T')[0]);
                    setOverviewEndDate(quarterEnd.toISOString().split('T')[0]);
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
      </main>

      <BottomNavigation />
    </div>
  );
}