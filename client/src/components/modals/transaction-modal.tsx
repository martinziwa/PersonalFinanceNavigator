import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useGoals } from "@/hooks/use-goals";

import { useTransactions } from "@/hooks/use-transactions";
import { useCategories } from "@/hooks/use-categories";
import type { InsertTransaction } from "@shared/schema";

const transactionSchema = z.object({
  amount: z.string().min(1, "Amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Amount must be a positive number"
  ),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  type: z.enum(["income", "expense", "savings_deposit", "savings_withdrawal", "loan_received", "loan_payment"]),
  date: z.string().min(1, "Date is required"),
  time: z.string().optional(),
  savingsGoalId: z.string().optional(),
  loanId: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTransaction?: any;
}

export default function TransactionModal({ isOpen, onClose, editingTransaction }: TransactionModalProps) {
  const { toast } = useToast();
  const { data: goals = [] } = useGoals();

  const { data: transactions = [] } = useTransactions();
  const { transactionCategories, addCustomCategory } = useCategories();
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState("");
  
  // Helper function to get current time in HH:MM format
  const getCurrentTime = () => {
    const now = new Date();
    return now.toTimeString().slice(0, 5); // Format: HH:MM
  };

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      amount: "",
      description: "",
      category: "",
      type: "expense",
      date: new Date().toISOString().split('T')[0], // Default to today's date
      time: getCurrentTime(), // Default to current time
      savingsGoalId: "",
      loanId: "",
    },
  });

  const selectedType = form.watch("type");
  const selectedCategory = form.watch("category");

  // Reset form when modal opens/closes or when editing
  useEffect(() => {
    if (isOpen) {
      if (editingTransaction) {
        // Extract time from existing transaction date or use current time as fallback
        const transactionDate = new Date(editingTransaction.date);
        const timeString = editingTransaction.time || transactionDate.toTimeString().slice(0, 5);
        
        form.reset({
          amount: editingTransaction.amount,
          description: editingTransaction.description,
          category: editingTransaction.category,
          type: editingTransaction.type,
          date: new Date(editingTransaction.date).toISOString().split('T')[0],
          time: timeString,
          savingsGoalId: editingTransaction.savingsGoalId?.toString() || "",
          loanId: editingTransaction.loanId?.toString() || "",
        });
      } else {
        form.reset({
          amount: "",
          description: "",
          category: "",
          type: "expense",
          date: new Date().toISOString().split('T')[0],
          time: getCurrentTime(),
          savingsGoalId: "",
          loanId: "",
        });
      }
      setIsAddingCustomCategory(false);
      setCustomCategoryInput("");
    }
  }, [isOpen, editingTransaction, form]);

  const allCategories = transactionCategories;

  const handleAddCustomCategory = () => {
    if (customCategoryInput.trim()) {
      const categoryValue = addCustomCategory(customCategoryInput.trim());
      
      // Set the form value
      form.setValue("category", categoryValue);
      
      // Reset state
      setCustomCategoryInput("");
      setIsAddingCustomCategory(false);
    }
  };

  const createTransactionMutation = useMutation({
    mutationFn: async (data: InsertTransaction) => {
      const response = await apiRequest("POST", "/api/transactions", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({
        title: "Success",
        description: "Transaction added successfully",
      });
      form.reset();
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add transaction",
        variant: "destructive",
      });
    },
  });

  const updateTransactionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertTransaction> }) => {
      const response = await apiRequest("PUT", `/api/transactions/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({
        title: "Success",
        description: "Transaction updated successfully",
      });
      form.reset();
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update transaction",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TransactionFormData) => {
    const transactionData = {
      amount: data.amount,
      description: data.description,
      category: data.category,
      type: data.type,
      date: new Date(data.date),
      time: data.time || getCurrentTime(), // Include time field with fallback to current time
      savingsGoalId: data.savingsGoalId && data.savingsGoalId !== "" ? parseInt(data.savingsGoalId) : undefined,
      loanId: data.loanId && data.loanId !== "" ? parseInt(data.loanId) : undefined,
    };

    if (editingTransaction) {
      updateTransactionMutation.mutate({
        id: editingTransaction.id,
        data: transactionData
      });
    } else {
      createTransactionMutation.mutate(transactionData);
    }
  };

  // Pre-populate form when editing
  React.useEffect(() => {
    if (editingTransaction && isOpen) {
      const transactionDate = new Date(editingTransaction.date);
      const formattedDate = transactionDate.toISOString().split('T')[0];
      
      form.reset({
        amount: editingTransaction.amount,
        description: editingTransaction.description,
        category: editingTransaction.category,
        type: editingTransaction.type,
        date: formattedDate,
        savingsGoalId: editingTransaction.savingsGoalId ? editingTransaction.savingsGoalId.toString() : "",
        loanId: editingTransaction.loanId ? editingTransaction.loanId.toString() : "",
      });
    } else if (!editingTransaction && isOpen) {
      form.reset({
        amount: "",
        description: "",
        category: "",
        type: "expense",
        date: new Date().toISOString().split('T')[0],
        savingsGoalId: "",
        loanId: "",
      });
    }
  }, [editingTransaction, isOpen, form]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
      <div className="w-full max-w-sm mx-auto bg-white rounded-t-3xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {editingTransaction ? "Edit Transaction" : "Add Transaction"}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="w-8 h-8 p-0 bg-gray-100 rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter description"
                      {...field}
                      className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCustomCategory();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={handleAddCustomCategory}
                          className="px-4 py-3 bg-primary text-white rounded-xl"
                        >
                          Add
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setIsAddingCustomCategory(false);
                          setCustomCategoryInput("");
                        }}
                        className="text-sm text-gray-500"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Select 
                        onValueChange={(value) => {
                          if (value === "__add_custom__") {
                            setIsAddingCustomCategory(true);
                            field.onChange("");
                          } else {
                            field.onChange(value);
                          }
                        }} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {allCategories.map((category) => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
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
                    </>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="date"
                      className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="time"
                      className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="Enter time"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transaction Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent">
                        <SelectValue placeholder="Select transaction type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="income">💰 Income</SelectItem>
                      <SelectItem value="expense">💸 Expense</SelectItem>
                      <SelectItem value="savings_deposit">🏦 Savings Deposit</SelectItem>
                      <SelectItem value="savings_withdrawal">🏧 Savings Withdrawal</SelectItem>
                      <SelectItem value="loan_received">📈 Loan Received</SelectItem>
                      <SelectItem value="loan_payment">📉 Loan Payment</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Savings Goal Selector - Show only for savings transactions */}
            {(form.watch("type") === "savings_deposit" || form.watch("type") === "savings_withdrawal") && (
              <FormField
                control={form.control}
                name="savingsGoalId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Savings Goal</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent">
                          <SelectValue placeholder="Select a savings goal" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {goals.length === 0 ? (
                          <SelectItem value="" disabled>No savings goals available</SelectItem>
                        ) : (
                          goals.map((goal) => (
                            <SelectItem key={goal.id} value={goal.id.toString()}>
                              {goal.icon} {goal.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Loan functionality has been removed from the application */}

            <div className="flex space-x-4 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                className="flex-1 py-3"
                disabled={createTransactionMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 py-3 bg-primary text-white"
                disabled={createTransactionMutation.isPending || updateTransactionMutation.isPending}
              >
                {editingTransaction
                  ? (updateTransactionMutation.isPending ? "Updating..." : "Update Transaction")
                  : (createTransactionMutation.isPending ? "Adding..." : "Add Transaction")
                }
              </Button>
            </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
