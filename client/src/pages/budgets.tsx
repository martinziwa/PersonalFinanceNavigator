import React, { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Trash2, Edit, PieChart, Sliders } from "lucide-react";
import Header from "@/components/layout/header";
import BottomNavigation from "@/components/layout/bottom-navigation";
import ProgressBar from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBudgets } from "@/hooks/use-budgets";
import { useTransactions } from "@/hooks/use-transactions";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";
import type { InsertBudget, Transaction } from "@shared/schema";

const budgetSchema = z.object({
  category: z.string().min(1, "Category is required"),
  amount: z.string().min(1, "Amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Amount must be a positive number"
  ),
  period: z.string().default("monthly"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  icon: z.string().min(1, "Icon is required"),
});

type BudgetFormData = z.infer<typeof budgetSchema>;

const categories = [
  { value: "food", label: "Food & Dining", icon: "🍽️" },
  { value: "transportation", label: "Transportation", icon: "🚗" },
  { value: "shopping", label: "Shopping", icon: "🛍️" },
  { value: "entertainment", label: "Entertainment", icon: "🎬" },
  { value: "bills", label: "Bills & Utilities", icon: "📄" },
  { value: "healthcare", label: "Healthcare", icon: "🏥" },
  { value: "education", label: "Education", icon: "📚" },
  { value: "other", label: "Other", icon: "📝" },
];

export default function Budgets() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("list");
  const [totalBudgetAmount, setTotalBudgetAmount] = useState(10000);
  const [budgetAllocations, setBudgetAllocations] = useState<Record<string, number>>({
    food: 30,
    transportation: 15,
    shopping: 10,
    entertainment: 8,
    bills: 25,
    healthcare: 7,
    education: 3,
    other: 2
  });
  
  const { data: budgets = [], isLoading } = useBudgets();
  const { data: transactions = [] } = useTransactions();

  // Calculate actual spending for each budget category
  const calculateSpentAmount = (budget: any) => {
    const budgetStart = new Date(budget.startDate);
    const budgetEnd = new Date(budget.endDate);
    
    const categoryTransactions = transactions.filter((transaction: Transaction) => {
      const transactionDate = new Date(transaction.date);
      return (
        transaction.category === budget.category &&
        transaction.type === 'expense' &&
        transactionDate >= budgetStart &&
        transactionDate <= budgetEnd
      );
    });

    return categoryTransactions.reduce((total: number, transaction: Transaction) => {
      return total + parseFloat(transaction.amount);
    }, 0);
  };
  const { toast } = useToast();

  const form = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      category: "",
      amount: "",
      period: "monthly",
      startDate: "",
      endDate: "",
      icon: "",
    },
  });

  const createBudgetMutation = useMutation({
    mutationFn: async (data: InsertBudget) => {
      const response = await apiRequest("POST", "/api/budgets", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({
        title: "Success",
        description: "Budget created successfully",
      });
      form.reset();
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create budget",
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
        title: "Success",
        description: "Budget deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete budget",
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
      toast({
        title: "Success",
        description: "Budget updated successfully",
      });
      form.reset();
      setIsDialogOpen(false);
      setEditingBudget(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update budget",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BudgetFormData) => {
    const budgetData = {
      category: data.category,
      amount: data.amount,
      period: data.period,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      icon: data.icon,
    };
    
    if (editingBudget) {
      updateBudgetMutation.mutate({
        id: editingBudget.id,
        data: budgetData
      });
    } else {
      createBudgetMutation.mutate(budgetData);
    }
  };

  const handleCategoryChange = (category: string) => {
    const categoryData = categories.find(c => c.value === category);
    if (categoryData) {
      form.setValue("icon", categoryData.icon);
    }
  };

  // Pre-populate form when editing
  React.useEffect(() => {
    if (editingBudget && isDialogOpen) {
      const startDate = new Date(editingBudget.startDate);
      const endDate = new Date(editingBudget.endDate);
      
      form.reset({
        category: editingBudget.category,
        amount: editingBudget.amount,
        period: editingBudget.period,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        icon: editingBudget.icon,
      });
    } else if (!editingBudget && isDialogOpen) {
      form.reset({
        category: "",
        amount: "",
        period: "monthly",
        startDate: "",
        endDate: "",
        icon: "",
      });
    }
  }, [editingBudget, isDialogOpen, form]);

  // Budget allocation functions
  const totalPercentage = useMemo(() => {
    return Object.values(budgetAllocations).reduce((sum, val) => sum + val, 0);
  }, [budgetAllocations]);

  const handleAllocationChange = (category: string, percentage: number) => {
    setBudgetAllocations(prev => ({
      ...prev,
      [category]: percentage
    }));
  };

  const normalizeAllocations = () => {
    if (totalPercentage === 0) return;
    
    const factor = 100 / totalPercentage;
    const normalized = Object.fromEntries(
      Object.entries(budgetAllocations).map(([key, value]) => [key, Math.round(value * factor)])
    );
    setBudgetAllocations(normalized);
  };

  const createBudgetsFromAllocation = async () => {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
    
    for (const [category, percentage] of Object.entries(budgetAllocations)) {
      if (percentage > 0) {
        const amount = (totalBudgetAmount * percentage / 100).toFixed(0);
        const categoryData = categories.find(c => c.value === category);
        
        const budgetData = {
          category,
          amount,
          period: "monthly",
          startDate: today.toISOString().split('T')[0],
          endDate: nextMonth.toISOString().split('T')[0],
          icon: categoryData?.icon || "📝"
        };
        
        try {
          await apiRequest("POST", "/api/budgets", budgetData);
        } catch (error) {
          console.error(`Failed to create budget for ${category}:`, error);
        }
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
    toast({
      title: "Success",
      description: "Budgets created from allocation",
    });
  };

  const handleEditBudget = (budget: any) => {
    setEditingBudget(budget);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingBudget(null);
  };

  const handleCreateNew = () => {
    setEditingBudget(null);
    setIsDialogOpen(true);
  };

  return (
    <div className="max-w-sm mx-auto bg-white min-h-screen relative flex flex-col">
      <Header title="Budgets" subtitle="Manage your spending" />
      
      <main className="flex-1 overflow-y-auto pb-20 px-4 space-y-4 pt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Budget List
            </TabsTrigger>
            <TabsTrigger value="allocator" className="flex items-center gap-2">
              <Sliders className="h-4 w-4" />
              Allocator
            </TabsTrigger>
          </TabsList>

          <TabsContent value="allocator" className="space-y-4">
            {/* Budget Allocation Slider */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Budget Allocation</CardTitle>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Total Budget:</label>
                  <Input
                    type="number"
                    value={totalBudgetAmount}
                    onChange={(e) => setTotalBudgetAmount(Number(e.target.value))}
                    className="w-32 text-sm"
                    placeholder="Enter amount"
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {categories.map((category) => {
                  const percentage = budgetAllocations[category.value] || 0;
                  const amount = (totalBudgetAmount * percentage / 100);
                  
                  return (
                    <div key={category.value} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{category.icon}</span>
                          <span className="text-sm font-medium">{category.label}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">{percentage}%</div>
                          <div className="text-xs text-gray-500">{formatCurrency(amount)}</div>
                        </div>
                      </div>
                      <Slider
                        value={[percentage]}
                        onValueChange={(value) => handleAllocationChange(category.value, value[0])}
                        max={100}
                        step={1}
                        className="w-full"
                      />
                    </div>
                  );
                })}
                
                <div className="border-t pt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total Allocation:</span>
                    <span className={`font-bold ${totalPercentage === 100 ? 'text-green-600' : totalPercentage > 100 ? 'text-red-600' : 'text-amber-600'}`}>
                      {totalPercentage}%
                    </span>
                  </div>
                  
                  {totalPercentage !== 100 && (
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={normalizeAllocations}
                        className="flex-1"
                      >
                        Normalize to 100%
                      </Button>
                    </div>
                  )}
                  
                  <Button 
                    onClick={createBudgetsFromAllocation}
                    disabled={totalPercentage === 0}
                    className="w-full"
                  >
                    Create Budgets from Allocation
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="list" className="space-y-4">
            {/* Add Budget Button */}
            <Button 
              onClick={handleCreateNew}
              className="w-full bg-primary text-white py-3"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Budget
            </Button>

        <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
          <DialogContent className="max-w-sm mx-auto">
            <DialogHeader>
              <DialogTitle>{editingBudget ? "Edit Budget" : "Create Budget"}</DialogTitle>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          handleCategoryChange(value);
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.value} value={category.value}>
                              <span className="flex items-center">
                                {category.icon} {category.label}
                              </span>
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
                          step="0.01"
                          placeholder="0.00"
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
                          <Input
                            type="date"
                            {...field}
                          />
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
                          <Input
                            type="date"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex space-x-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCloseDialog}
                    className="flex-1"
                    disabled={createBudgetMutation.isPending || updateBudgetMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-primary text-white"
                    disabled={createBudgetMutation.isPending || updateBudgetMutation.isPending}
                  >
                    {editingBudget
                      ? (updateBudgetMutation.isPending ? "Updating..." : "Update Budget")
                      : (createBudgetMutation.isPending ? "Creating..." : "Create Budget")
                    }
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Budgets List */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 animate-pulse">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-xl"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                </div>
                <div className="h-2 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : budgets.length === 0 ? (
          <div className="bg-white rounded-xl p-8 border border-gray-100 text-center">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No budgets yet</h3>
            <p className="text-gray-500 mb-4">
              Create your first budget to start tracking your spending
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {budgets.map((budget) => {
              const actualSpent = calculateSpentAmount(budget);
              const percentage = (actualSpent / parseFloat(budget.amount)) * 100;
              const remaining = parseFloat(budget.amount) - actualSpent;
              const isOverBudget = percentage > 100;
              
              return (
                <div key={budget.id} className="bg-white rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                        <span className="text-lg">{budget.icon}</span>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 capitalize">
                          {budget.category.replace('_', ' ')}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {new Date(budget.startDate).toLocaleDateString()} - {new Date(budget.endDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(actualSpent)} / {formatCurrency(parseFloat(budget.amount))}
                        </div>
                        <div className={`text-xs ${
                          isOverBudget ? "text-red-600" : remaining < parseFloat(budget.amount) * 0.2 ? "text-yellow-600" : "text-green-600"
                        }`}>
                          {isOverBudget ? 
                            `Over by ${formatCurrency(Math.abs(remaining))}` : 
                            `${formatCurrency(remaining)} left`
                          }
                        </div>
                      </div>
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
                  
                  <ProgressBar
                    percentage={percentage}
                    color={
                      isOverBudget ? "bg-red-500" :
                      percentage > 80 ? "bg-yellow-500" :
                      "bg-green-500"
                    }
                  />
                  
                  {isOverBudget && (
                    <div className="mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                      ⚠️ Budget exceeded! Consider reviewing your spending.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
          </TabsContent>
        </Tabs>
      </main>

      <BottomNavigation />
    </div>
  );
}
