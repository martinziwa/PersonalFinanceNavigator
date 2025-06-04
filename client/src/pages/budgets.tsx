import React, { useState, useMemo, useEffect } from "react";
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
        </div>

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
      </main>

      <BottomNavigation />
    </div>
  );
}