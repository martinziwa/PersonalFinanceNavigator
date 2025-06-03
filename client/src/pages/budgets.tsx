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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  description: z.string().optional(),
});

type BudgetFormData = z.infer<typeof budgetSchema>;

const categories = [
  { value: "bills", label: "Bills & Utilities", icon: "📄" },
  { value: "education", label: "Education", icon: "📚" },
  { value: "entertainment", label: "Entertainment", icon: "🎬" },
  { value: "food", label: "Food & Dining", icon: "🍽️" },
  { value: "healthcare", label: "Healthcare", icon: "🏥" },
  { value: "other", label: "Other", icon: "📝" },
  { value: "shopping", label: "Shopping", icon: "🛍️" },
  { value: "transportation", label: "Transportation", icon: "🚗" },
];

export default function Budgets() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("list");
  const [totalBudgetAmount, setTotalBudgetAmount] = useState(10000);
  const [budgetStartDate, setBudgetStartDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [budgetEndDate, setBudgetEndDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.toISOString().split('T')[0];
  });
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
    const startDate = new Date(budgetStartDate);
    const endDate = new Date(budgetEndDate);
    
    for (const [category, percentage] of Object.entries(budgetAllocations)) {
      if (percentage > 0) {
        const amount = (totalBudgetAmount * percentage / 100).toFixed(0);
        const categoryData = categories.find(c => c.value === category);
        
        const budgetData = {
          category,
          amount,
          period: "monthly",
          startDate: startDate,
          endDate: endDate,
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

  const onSubmit = (data: BudgetFormData) => {
    const budgetData = {
      ...data,
      amount: data.amount,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
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
        description: editingBudget.description || "",
      });
    } else if (!editingBudget && isDialogOpen) {
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
  }, [editingBudget, isDialogOpen, form]);

  if (isLoading) {
    return (
      <div className="max-w-sm mx-auto bg-white min-h-screen relative">
        <Header title="Budgets" subtitle="Manage your spending limits" />
        <main className="pb-20 px-4 pt-4">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading budgets...</p>
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
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Budget Allocation</CardTitle>
                <div className="space-y-3">
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
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-gray-600 mb-1 block">Start Date</label>
                      <Input
                        type="date"
                        value={budgetStartDate}
                        onChange={(e) => setBudgetStartDate(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 mb-1 block">End Date</label>
                      <Input
                        type="date"
                        value={budgetEndDate}
                        onChange={(e) => setBudgetEndDate(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  </div>
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
            <Button 
              onClick={handleCreateNew}
              className="w-full bg-primary text-white py-3"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Budget
            </Button>

            {budgets.length === 0 ? (
              <div className="bg-white rounded-xl p-6 border border-gray-100 text-center">
                <PieChart className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No budgets yet</p>
                <p className="text-sm text-gray-400 mt-1">Create your first budget to start tracking spending</p>
              </div>
            ) : (
              <div className="space-y-4">
                {budgets.map((budget: any) => {
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
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <span className="text-lg">{budget.icon}</span>
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900 capitalize">
                              {budget.category.replace('_', ' ')}
                            </h3>
                            {budget.description && (
                              <p className="text-xs text-gray-600 mb-1">
                                {budget.description}
                              </p>
                            )}
                            <p className="text-sm text-gray-500">
                              {formatCurrency(totalSpent)} of {formatCurrency(budgetAmount)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="text-right">
                            <div className={`text-sm font-semibold ${isOverBudget ? 'text-red-600' : 'text-gray-900'}`}>
                              {percentage.toFixed(1)}%
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatCurrency(budgetAmount - totalSpent)} left
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
                        <Input
                          placeholder="Add a description to help identify this budget"
                          {...field}
                        />
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
          </DialogContent>
        </Dialog>
      </main>

      <BottomNavigation />
    </div>
  );
}