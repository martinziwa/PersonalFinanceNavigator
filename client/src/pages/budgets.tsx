import React, { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Trash2, Edit, PieChart, Sliders, History, X } from "lucide-react";
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
  amount: z.string().min(1, "Amount is required"),
  period: z.enum(["weekly", "monthly", "yearly"]),
  startDate: z.string(),
  endDate: z.string(),
  icon: z.string(),
  description: z.string().optional(),
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
  { value: "savings", label: "Savings", icon: "💳" },
  { value: "loan", label: "Loan", icon: "🏛️" },
  { value: "other", label: "Other", icon: "📝" },
];

export default function Budgets() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("list");
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState("");
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("dateAdded");
  
  // Budget Allocator States
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [allocationType, setAllocationType] = useState("recommended");
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [showAllocatorResults, setShowAllocatorResults] = useState(false);
  
  // Transaction History States
  const [selectedBudgetForHistory, setSelectedBudgetForHistory] = useState<any>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  
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

  const onSubmit = (data: BudgetFormData) => {
    const budgetData = {
      ...data,
      amount: data.amount,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
    };

    if (editingBudget) {
      updateBudgetMutation.mutate({ id: editingBudget.id, data: budgetData });
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

  const handleAddCustomCategory = () => {
    if (customCategoryInput.trim()) {
      setCustomCategories(prev => [...prev, customCategoryInput.trim()]);
      form.setValue("category", customCategoryInput.trim());
      form.setValue("icon", "📝");
      setCustomCategoryInput("");
      setIsAddingCustomCategory(false);
    }
  };

  // Recommended budget allocation percentages (50/30/20 rule + adjustments)
  const recommendedAllocations = {
    food: 15,
    transportation: 10,
    bills: 25,
    healthcare: 5,
    shopping: 10,
    entertainment: 10,
    education: 5,
    savings: 20
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

  const handleCreateBudgetsFromAllocator = async () => {
    if (!monthlyIncome || Object.keys(allocations).length === 0) {
      toast({
        title: "Missing Information",
        description: "Please enter your monthly income and set allocations",
        variant: "destructive",
      });
      return;
    }

    const income = parseFloat(monthlyIncome);
    const budgetsToCreate = Object.entries(allocations).map(([category, percentage]) => {
      const amount = (income * percentage / 100).toFixed(2);
      const categoryData = categories.find(cat => cat.value === category);
      
      return {
        category,
        amount,
        period: "monthly" as const,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        icon: categoryData?.icon || "📝",
        description: `Auto-generated from ${percentage}% allocation`
      };
    });

    try {
      for (const budget of budgetsToCreate) {
        await apiRequest("POST", "/api/budgets", budget);
      }
      
      await queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      
      toast({
        title: "Budgets Created",
        description: `Successfully created ${budgetsToCreate.length} budgets from your allocation`,
      });
      
      setActiveTab("list");
      setShowAllocatorResults(false);
      setMonthlyIncome("");
      setAllocations({});
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create budgets. Please try again.",
        variant: "destructive",
      });
    }
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

  const allCategories = [
    ...categories,
    ...customCategories
      .filter(cat => !categories.some(predef => predef.value === cat))
      .map(cat => ({ value: cat, label: cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' '), icon: "📝" }))
  ];

  const filteredBudgets = budgets.filter(budget => {
    if (categoryFilter === "all") return true;
    return budget.category === categoryFilter;
  });

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
          <Button
            onClick={() => setActiveTab("allocator")}
            variant="outline"
            className="flex items-center gap-2 px-4 py-2 rounded-xl"
          >
            <Sliders className="h-4 w-4" />
            Allocator
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="list">Budget List</TabsTrigger>
            <TabsTrigger value="allocator">Budget Allocator</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-4">
            {/* Budget List */}
            <div className="space-y-4">
          {filteredBudgets.length === 0 ? (
            <div className="bg-white rounded-xl p-6 border border-gray-100 text-center">
              <div className="text-4xl mb-3">💰</div>
              <p className="text-gray-500">No budgets yet</p>
              <p className="text-sm text-gray-400 mt-1">Create your first budget to start tracking your spending</p>
            </div>
          ) : (
            filteredBudgets.map((budget) => {
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
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Progress</span>
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
                </div>
              );
            })
          )}
            </div>
          </TabsContent>

          <TabsContent value="allocator" className="mt-4">
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Allocator</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Enter your monthly income to automatically allocate budgets across categories using recommended percentages.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Monthly Income (MWK)
                    </label>
                    <Input
                      type="number"
                      placeholder="Enter your monthly income"
                      value={monthlyIncome}
                      onChange={(e) => setMonthlyIncome(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Allocation Method
                    </label>
                    <Select value={allocationType} onValueChange={setAllocationType}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose allocation method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="recommended">Recommended (50/30/20 Rule)</SelectItem>
                        <SelectItem value="custom">Custom Allocation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {monthlyIncome && (
                    <Button 
                      onClick={() => {
                        if (allocationType === "recommended") {
                          setAllocations(recommendedAllocations);
                        } else {
                          const equalAllocation = Math.floor(100 / categories.length);
                          const customAllocations: Record<string, number> = {};
                          categories.forEach(cat => {
                            customAllocations[cat.value] = equalAllocation;
                          });
                          setAllocations(customAllocations);
                        }
                        setShowAllocatorResults(true);
                      }}
                      className="w-full"
                    >
                      Generate Allocation
                    </Button>
                  )}
                </div>
              </div>
              
              {showAllocatorResults && monthlyIncome && Object.keys(allocations).length > 0 && (
                <div className="bg-white rounded-xl p-6 border border-gray-100">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Budget Allocation</h4>
                  
                  <div className="space-y-4 mb-6">
                    {Object.entries(allocations).map(([category, percentage]) => {
                      const categoryData = categories.find(cat => cat.value === category);
                      const amount = (parseFloat(monthlyIncome) * percentage / 100);
                      
                      return (
                        <div key={category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                              <span className="text-sm">{categoryData?.icon}</span>
                            </div>
                            <div>
                              <h5 className="font-medium text-gray-900 capitalize">
                                {category.replace('_', ' ')}
                              </h5>
                              <p className="text-sm text-gray-500">{percentage}%</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-gray-900">
                              {formatCurrency(amount)}
                            </div>
                            {allocationType === "custom" && (
                              <div className="mt-1">
                                <Slider
                                  value={[percentage]}
                                  onValueChange={(value) => {
                                    setAllocations(prev => ({
                                      ...prev,
                                      [category]: value[0]
                                    }));
                                  }}
                                  max={50}
                                  step={1}
                                  className="w-20"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg mb-4">
                    <span className="font-medium text-blue-900">Total Allocated</span>
                    <span className="font-semibold text-blue-900">
                      {Object.values(allocations).reduce((sum, val) => sum + val, 0)}%
                    </span>
                  </div>
                  
                  <Button 
                    onClick={handleCreateBudgetsFromAllocator}
                    className="w-full"
                    disabled={Object.values(allocations).reduce((sum, val) => sum + val, 0) !== 100}
                  >
                    Create Budgets from Allocation
                  </Button>
                  
                  {Object.values(allocations).reduce((sum, val) => sum + val, 0) !== 100 && (
                    <p className="text-sm text-amber-600 text-center mt-2">
                      Total allocation must equal 100%
                    </p>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

        </Tabs>

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
                        {isAddingCustomCategory ? (
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <Input
                                placeholder="Enter custom category"
                                value={customCategoryInput}
                                onChange={(e) => setCustomCategoryInput(e.target.value)}
                                className="flex-1"
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddCustomCategory();
                                  }
                                }}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleAddCustomCategory}
                                className="px-3"
                              >
                                Add
                              </Button>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setIsAddingCustomCategory(false)}
                              className="text-sm text-gray-500"
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Select 
                            onValueChange={(value) => {
                              if (value === "__add_custom__") {
                                setIsAddingCustomCategory(true);
                              } else {
                                field.onChange(value);
                                handleCategoryChange(value);
                              }
                            }} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {allCategories.map((category) => (
                                <SelectItem key={category.value} value={category.value}>
                                  <span className="flex items-center">
                                    {category.icon} {category.label}
                                  </span>
                                </SelectItem>
                              ))}
                              <SelectItem value="__add_custom__" className="text-primary font-medium">
                                <div className="flex items-center gap-2">
                                  <Plus className="h-4 w-4" />
                                  Add Custom Category
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
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
            </div>
          </DialogContent>
        </Dialog>

        {/* Transaction History Modal */}
        <Dialog open={isHistoryModalOpen} onOpenChange={handleCloseHistoryModal}>
          <DialogContent className="max-w-sm mx-auto max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
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
            
            <div className="flex-1 overflow-y-auto px-1">
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

                    <div>
                      <h5 className="font-medium text-gray-900 mb-3">Transactions ({budgetTransactions.length})</h5>
                      
                      {budgetTransactions.length === 0 ? (
                        <div className="text-center py-8">
                          <div className="text-4xl mb-2">📊</div>
                          <p className="text-gray-500">No transactions yet</p>
                          <p className="text-sm text-gray-400 mt-1">
                            Transactions in this category will appear here
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {budgetTransactions
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map((transaction) => (
                            <div key={transaction.id} className="bg-white border border-gray-200 rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-1">
                                    <h6 className="font-medium text-gray-900 text-sm">
                                      {transaction.description || 'No description'}
                                    </h6>
                                    <span className="font-semibold text-red-600">
                                      -{formatCurrency(parseFloat(transaction.amount))}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs text-gray-500">
                                    <span>
                                      {new Date(transaction.date).toLocaleDateString()}
                                    </span>
                                    {transaction.time && (
                                      <span>{transaction.time}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
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