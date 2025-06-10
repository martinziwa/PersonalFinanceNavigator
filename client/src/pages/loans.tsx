import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Trash2, Edit, DollarSign, Calendar, Percent } from "lucide-react";
import Header from "@/components/layout/header";
import BottomNavigation from "@/components/layout/bottom-navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLoans } from "@/hooks/use-loans";
import { useTransactions } from "@/hooks/use-transactions";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";
import type { InsertLoan, Transaction } from "@shared/schema";

const loanSchema = z.object({
  name: z.string().min(1, "Loan name is required"),
  principalAmount: z.string().min(1, "Principal amount is required"),
  interestRate: z.string().min(1, "Interest rate is required"),
  loanTermMonths: z.string().min(1, "Loan term is required"),
  monthlyPayment: z.string().optional(),
  nextPaymentDate: z.string().min(1, "Next payment date is required"),
  loanType: z.enum(["personal", "mortgage", "auto", "student", "business", "other"]),
  icon: z.string().default("💳"),
  color: z.string().default("#3B82F6"),
});

type LoanFormData = z.infer<typeof loanSchema>;

export default function Loans() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<any>(null);
  
  const { data: loans = [], isLoading } = useLoans();
  const { data: transactions = [] } = useTransactions();
  const { toast } = useToast();

  const form = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      name: "",
      principalAmount: "",
      interestRate: "",
      loanTermMonths: "",
      monthlyPayment: "",
      nextPaymentDate: new Date().toISOString().split('T')[0],
      loanType: "personal",
      icon: "💳",
      color: "#3B82F6",
    },
  });

  // Calculate monthly payment based on principal, rate, and term
  const calculateMonthlyPayment = (principal: number, annualRate: number, months: number): number => {
    if (annualRate === 0) return principal / months;
    const monthlyRate = annualRate / 100 / 12;
    return (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / 
           (Math.pow(1 + monthlyRate, months) - 1);
  };

  // Auto-calculate monthly payment when inputs change
  React.useEffect(() => {
    const subscription = form.watch((values) => {
      const { principalAmount, interestRate, loanTermMonths } = values;
      if (principalAmount && interestRate && loanTermMonths) {
        const principal = parseFloat(principalAmount);
        const rate = parseFloat(interestRate);
        const months = parseInt(loanTermMonths);
        
        if (!isNaN(principal) && !isNaN(rate) && !isNaN(months)) {
          const payment = calculateMonthlyPayment(principal, rate, months);
          form.setValue("monthlyPayment", payment.toFixed(2));
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const createLoanMutation = useMutation({
    mutationFn: async (data: InsertLoan) => {
      const response = await apiRequest("POST", "/api/loans", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
      handleCloseDialog();
      toast({
        title: "Loan added",
        description: "Your loan has been added successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add loan. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateLoanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertLoan> }) => {
      const response = await apiRequest("PUT", `/api/loans/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
      handleCloseDialog();
      toast({
        title: "Loan updated",
        description: "Your loan has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update loan. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteLoanMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/loans/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
      toast({
        title: "Loan deleted",
        description: "Your loan has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete loan. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateNew = () => {
    setEditingLoan(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const handleEdit = (loan: any) => {
    setEditingLoan(loan);
    form.reset({
      name: loan.name,
      principalAmount: loan.principalAmount?.toString() || "",
      interestRate: loan.interestRate?.toString() || "",
      loanTermMonths: loan.loanTermMonths?.toString() || "",
      monthlyPayment: loan.calculatedPayment || "",
      nextPaymentDate: loan.nextPaymentDate ? new Date(loan.nextPaymentDate).toISOString().split('T')[0] : "",
      loanType: loan.loanType || "personal",
      icon: loan.icon || "💳",
      color: loan.color || "#3B82F6",
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingLoan(null);
    form.reset();
  };

  const onSubmit = (data: LoanFormData) => {
    const submitData: InsertLoan = {
      name: data.name,
      principalAmount: data.principalAmount,
      interestRate: data.interestRate,
      loanTermMonths: parseInt(data.loanTermMonths),
      calculatedPayment: data.monthlyPayment,
      nextPaymentDate: data.nextPaymentDate,
      startDate: new Date().toISOString().split('T')[0],
      loanType: data.loanType,
      icon: data.icon,
      color: data.color,
    };

    if (editingLoan) {
      updateLoanMutation.mutate({ id: editingLoan.id, data: submitData });
    } else {
      createLoanMutation.mutate(submitData);
    }
  };

  // Calculate loan payments from transactions
  const getLoanPayments = (loan: any) => {
    return transactions.filter((transaction: Transaction) => 
      transaction.type === "loan_payment" && 
      transaction.loanId === loan.id
    );
  };

  const getTotalPaid = (loan: any) => {
    const payments = getLoanPayments(loan);
    return payments.reduce((total: number, payment: Transaction) => 
      total + parseFloat(payment.amount), 0
    );
  };

  const getRemainingBalance = (loan: any) => {
    const principal = parseFloat(loan.principalAmount || "0");
    const paid = getTotalPaid(loan);
    return Math.max(0, principal - paid);
  };

  if (isLoading) {
    return (
      <div className="max-w-sm mx-auto bg-white min-h-screen relative flex flex-col">
        <Header title="Loans" subtitle="Manage your debts" />
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
      <Header title="Loans" subtitle="Manage your debts" />
      
      <main className="flex-1 overflow-y-auto pb-20 px-4 space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <Button
            onClick={handleCreateNew}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl"
          >
            <Plus className="h-4 w-4" />
            Add Loan
          </Button>
        </div>

        {/* Loans List */}
        <div className="space-y-4">
          {loans.length === 0 ? (
            <div className="bg-white rounded-xl p-6 border border-gray-100 text-center">
              <div className="text-4xl mb-3">💳</div>
              <p className="text-gray-500">No loans yet</p>
              <p className="text-sm text-gray-400 mt-1">Add your first loan to start tracking payments</p>
            </div>
          ) : (
            loans.map((loan: any) => {
              const totalPaid = getTotalPaid(loan);
              const remainingBalance = getRemainingBalance(loan);
              const principal = parseFloat(loan.principalAmount || "0");
              const progressPercentage = principal > 0 ? (totalPaid / principal) * 100 : 0;
              
              return (
                <div key={loan.id} className="bg-white rounded-xl p-4 border border-gray-100">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">{loan.icon}</div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{loan.name}</h3>
                        <p className="text-sm text-gray-600 capitalize">{loan.loanType} loan</p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(loan)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteLoanMutation.mutate(loan.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="text-center">
                      <p className="text-xs text-gray-600 mb-1">Principal</p>
                      <p className="font-semibold text-blue-600">{formatCurrency(principal)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600 mb-1">Remaining</p>
                      <p className="font-semibold text-red-600">{formatCurrency(remainingBalance)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="text-center">
                      <p className="text-xs text-gray-600 mb-1">Rate</p>
                      <p className="font-semibold text-gray-700">{loan.interestRate}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600 mb-1">Payment</p>
                      <p className="font-semibold text-gray-700">{formatCurrency(parseFloat(loan.calculatedPayment || "0"))}</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Paid</span>
                      <span>{progressPercentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {loan.nextPaymentDate && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span>Next payment: {new Date(loan.nextPaymentDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Add/Edit Loan Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>{editingLoan ? "Edit Loan" : "Add New Loan"}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loan Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Car Loan" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="loanType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loan Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select loan type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="personal">Personal Loan</SelectItem>
                        <SelectItem value="mortgage">Mortgage</SelectItem>
                        <SelectItem value="auto">Auto Loan</SelectItem>
                        <SelectItem value="student">Student Loan</SelectItem>
                        <SelectItem value="business">Business Loan</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="principalAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Principal Amount (MWK)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="500000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="interestRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interest Rate (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="15.5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="loanTermMonths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Loan Term (Months)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="36" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="monthlyPayment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Payment (Auto-calculated)</FormLabel>
                    <FormControl>
                      <Input {...field} readOnly className="bg-gray-50" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nextPaymentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Next Payment Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex space-x-2 pt-4">
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
                  disabled={createLoanMutation.isPending || updateLoanMutation.isPending}
                  className="flex-1"
                >
                  {editingLoan ? "Update" : "Add"} Loan
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <BottomNavigation />
    </div>
  );
}