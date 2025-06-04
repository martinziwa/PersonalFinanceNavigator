import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Trash2, Calculator, Edit } from "lucide-react";
import Header from "@/components/layout/header";
import BottomNavigation from "@/components/layout/bottom-navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useLoans } from "@/hooks/use-loans";
import { useTransactions } from "@/hooks/use-transactions";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";
import ProgressBar from "@/components/ui/progress-bar";
import type { InsertLoan, Transaction } from "@shared/schema";

const frequencyOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "triweekly", label: "Triweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "bimonthly", label: "Bimonthly" },
  { value: "trimonthly", label: "Trimonthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
];

const loanSchema = z.object({
  name: z.string().min(1, "Loan name is required"),
  principalAmount: z.string().min(1, "Principal amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Principal amount must be a positive number"
  ),
  balance: z.string().optional().refine(
    (val) => !val || (!isNaN(parseFloat(val)) && parseFloat(val) > 0),
    "Balance must be a positive number if provided"
  ),
  interestRate: z.string().optional().refine(
    (val) => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
    "Interest rate must be a valid number if provided"
  ),
  interestType: z.enum(["simple", "compound"], { 
    required_error: "Please select interest type" 
  }),
  interestPeriod: z.enum(["daily", "weekly", "biweekly", "triweekly", "monthly", "bimonthly", "trimonthly", "quarterly", "annually"], {
    required_error: "Please select interest period"
  }),
  useRecurringPayments: z.boolean().default(false),
  repaymentFrequency: z.enum(["daily", "weekly", "biweekly", "triweekly", "monthly", "bimonthly", "trimonthly", "quarterly", "annually"]).optional(),
  minPayment: z.string().optional(),
  payoffTime: z.string().optional(),
  dueDate: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
});

type LoanFormData = z.infer<typeof loanSchema>;

const loanTypes = [
  { value: "personal", label: "Personal Loan", icon: "👤" },
  { value: "auto", label: "Auto Loan", icon: "🚗" },
  { value: "home", label: "Home Loan", icon: "🏠" },
  { value: "education", label: "Education Loan", icon: "🎓" },
  { value: "business", label: "Business Loan", icon: "💼" },
  { value: "credit_card", label: "Credit Card", icon: "💳" },
  { value: "other", label: "Other", icon: "📄" },
];

export default function Loans() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<any>(null);
  
  const { data: loans = [], isLoading } = useLoans();
  const { data: transactions = [] } = useTransactions();
  const { toast } = useToast();

  // Calculate loan progress based on principal amount, current balance, and payments
  const calculateLoanProgress = (loanId: number, principalAmount: string, currentBalance: string) => {
    const principal = parseFloat(principalAmount || "0");
    const balance = parseFloat(currentBalance || "0");
    
    // Find all loan payment transactions for this specific loan
    const loanPayments = transactions.filter((transaction: Transaction) => 
      transaction.loanId === loanId && transaction.type === 'loan_payment'
    );
    
    // Calculate total payments made through transactions
    const totalPayments = loanPayments.reduce((total: number, transaction: Transaction) => {
      return total + parseFloat(transaction.amount);
    }, 0);
    
    // Calculate amount repaid: original principal - current balance + additional payments
    const baseRepaid = Math.max(0, principal - balance);
    const totalRepaid = baseRepaid + totalPayments;
    
    // Progress percentage
    const progressPercentage = principal > 0 ? (totalRepaid / principal) * 100 : 0;
    
    return {
      totalRepaid,
      progressPercentage: Math.min(progressPercentage, 100), // Cap at 100%
      remainingBalance: Math.max(0, principal - totalRepaid)
    };
  };

  const form = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      name: "",
      balance: "",
      interestRate: "",
      interestType: "simple",
      interestPeriod: "monthly",
      repaymentFrequency: "monthly",
      minPayment: "",
      dueDate: "",
      startDate: "",
    },
  });

  // Calculate payoff time from payment amount
  const calculatePayoffTime = (balance: number, rate: number, payment: number, interestType: string, interestPeriod: string, repaymentFreq: string): number => {
    if (balance <= 0 || rate < 0 || payment <= 0) return 0;
    
    const periodsPerYear = getPeriodsPerYear(repaymentFreq);
    const interestPeriodsPerYear = getPeriodsPerYear(interestPeriod);
    const effectiveRate = rate / 100 / interestPeriodsPerYear;
    
    if (interestType === "simple") {
      // Simple interest calculation
      const totalInterestPerPeriod = balance * effectiveRate * (interestPeriodsPerYear / periodsPerYear);
      const principalPerPayment = payment - totalInterestPerPeriod;
      if (principalPerPayment <= 0) return Infinity;
      return Math.ceil(balance / principalPerPayment);
    } else {
      // Compound interest calculation
      const periodicRate = effectiveRate * (interestPeriodsPerYear / periodsPerYear);
      if (periodicRate === 0) return Math.ceil(balance / payment);
      if (payment <= balance * periodicRate) return Infinity;
      
      return Math.ceil(Math.log(1 + (balance * periodicRate) / payment) / Math.log(1 + periodicRate));
    }
  };

  // Calculate required payment from payoff time
  const calculateRequiredPayment = (balance: number, rate: number, periods: number, interestType: string, interestPeriod: string, repaymentFreq: string): number => {
    if (balance <= 0 || rate < 0 || periods <= 0) return 0;
    
    const periodsPerYear = getPeriodsPerYear(repaymentFreq);
    const interestPeriodsPerYear = getPeriodsPerYear(interestPeriod);
    const effectiveRate = rate / 100 / interestPeriodsPerYear;
    
    if (interestType === "simple") {
      // Simple interest calculation
      const totalInterestPerPeriod = balance * effectiveRate * (interestPeriodsPerYear / periodsPerYear);
      const principalPerPayment = balance / periods;
      return principalPerPayment + totalInterestPerPeriod;
    } else {
      // Compound interest calculation
      const periodicRate = effectiveRate * (interestPeriodsPerYear / periodsPerYear);
      if (periodicRate === 0) return balance / periods;
      
      return (balance * periodicRate * Math.pow(1 + periodicRate, periods)) / (Math.pow(1 + periodicRate, periods) - 1);
    }
  };

  // Watch form values for real-time calculations
  const watchedValues = form.watch();
  const interestType = form.watch("interestType");
  const useRecurringPayments = form.watch("useRecurringPayments");
  
  // Real-time calculation effect
  React.useEffect(() => {
    const { principalAmount, balance, interestRate, minPayment, payoffTime, interestType, interestPeriod, repaymentFrequency } = watchedValues;
    
    // Use principalAmount as default if balance is not provided
    const effectiveBalance = balance || principalAmount;
    // Use 0% as default if interest rate is not provided
    const effectiveRate = interestRate || "0";
    
    const balanceNum = parseFloat(effectiveBalance || "0");
    const rateNum = parseFloat(effectiveRate);
    const paymentNum = parseFloat(minPayment || "0");
    const timeNum = parseFloat(payoffTime || "0");
    
    if (balanceNum > 0 && rateNum >= 0 && interestType && interestPeriod && repaymentFrequency) {
      // If payment is entered but not payoff time, calculate payoff time
      if (paymentNum > 0 && !payoffTime) {
        const calculatedTime = calculatePayoffTime(balanceNum, rateNum, paymentNum, interestType, interestPeriod, repaymentFrequency);
        if (calculatedTime !== Infinity && calculatedTime > 0) {
          form.setValue("payoffTime", calculatedTime.toString(), { shouldValidate: false });
        }
      }
      // If payoff time is entered but not payment, calculate required payment
      else if (timeNum > 0 && !minPayment) {
        const calculatedPayment = calculateRequiredPayment(balanceNum, rateNum, timeNum, interestType, interestPeriod, repaymentFrequency);
        if (calculatedPayment > 0) {
          form.setValue("minPayment", calculatedPayment.toFixed(2), { shouldValidate: false });
        }
      }
    }
  }, [watchedValues, form]);

  const createLoanMutation = useMutation({
    mutationFn: async (data: InsertLoan) => {
      const response = await apiRequest("POST", "/api/loans", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
      toast({
        title: "Success",
        description: "Loan added successfully",
      });
      form.reset();
      setIsDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add loan",
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
      toast({
        title: "Success",
        description: "Loan updated successfully",
      });
      setIsDialogOpen(false);
      setEditingLoan(null);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update loan",
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
        title: "Success",
        description: "Loan deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete loan",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoanFormData) => {
    const loanData = {
      name: data.name,
      principalAmount: data.principalAmount,
      balance: data.balance || data.principalAmount, // Default to principal amount if not provided
      interestRate: data.interestRate || "0", // Default to 0% if not provided
      interestType: data.interestType,
      interestPeriod: data.interestPeriod,
      useRecurringPayments: data.useRecurringPayments,
      repaymentFrequency: data.repaymentFrequency,
      minPayment: data.minPayment || "0",
      nextPaymentDate: data.dueDate ? new Date(data.dueDate) : new Date(),
      startDate: new Date(data.startDate),
      icon: "💳",
      color: "#DC2626",
    };
    
    if (editingLoan) {
      updateLoanMutation.mutate({ id: editingLoan.id, data: loanData });
    } else {
      createLoanMutation.mutate(loanData);
    }
  };

  const openEditDialog = (loan: any) => {
    setEditingLoan(loan);
    const nextPaymentDate = new Date(loan.nextPaymentDate);
    const formattedDate = nextPaymentDate.toISOString().split('T')[0];
    const startDate = new Date(loan.startDate);
    const formattedStartDate = startDate.toISOString().split('T')[0];
    
    form.reset({
      name: loan.name,
      principalAmount: loan.principalAmount || "",
      balance: loan.balance,
      interestRate: loan.interestRate,
      interestType: loan.interestType || "simple",
      interestPeriod: loan.interestPeriod || "monthly",
      repaymentFrequency: loan.repaymentFrequency || "monthly",
      minPayment: loan.minPayment,
      dueDate: formattedDate,
      startDate: formattedStartDate,
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingLoan(null);
    const today = new Date().toISOString().split('T')[0];
    form.reset({
      name: "",
      principalAmount: "",
      balance: "",
      interestRate: "",
      interestType: "simple",
      interestPeriod: "monthly",
      repaymentFrequency: "monthly",
      minPayment: "",
      dueDate: "",
      startDate: today,
    });
    setIsDialogOpen(true);
  };

  // Convert frequency to periods per year
  const getPeriodsPerYear = (frequency: string) => {
    switch (frequency) {
      case "daily": return 365;
      case "weekly": return 52;
      case "biweekly": return 26;
      case "triweekly": return 17.33; // 52/3
      case "monthly": return 12;
      case "bimonthly": return 6;
      case "trimonthly": return 4;
      case "quarterly": return 4;
      case "annually": return 1;
      default: return 12;
    }
  };

  const calculatePayoffPeriods = (
    balance: number, 
    payment: number, 
    annualRate: number, 
    interestType: string = "compound",
    interestFreq: string = "monthly",
    paymentFreq: string = "monthly"
  ) => {
    if (annualRate === 0) return Math.ceil(balance / payment);
    
    const interestPeriodsPerYear = getPeriodsPerYear(interestFreq);
    const paymentPeriodsPerYear = getPeriodsPerYear(paymentFreq);
    const periodRate = annualRate / 100 / interestPeriodsPerYear;
    
    if (interestType === "simple") {
      // Simple interest: I = P * r * t
      const totalInterest = balance * (annualRate / 100);
      const totalAmount = balance + totalInterest;
      return Math.ceil(totalAmount / payment);
    } else {
      // Compound interest with different frequencies
      if (interestFreq === paymentFreq) {
        // Same frequency - standard formula
        return Math.ceil(Math.log(1 + (balance * periodRate) / payment) / Math.log(1 + periodRate));
      } else {
        // Different frequencies - iterative calculation
        let remainingBalance = balance;
        let periods = 0;
        const maxPeriods = 1000; // Safety limit
        
        while (remainingBalance > 0.01 && periods < maxPeriods) {
          // Apply interest for one payment period
          const interestPeriodsInPaymentPeriod = interestPeriodsPerYear / paymentPeriodsPerYear;
          const effectiveRate = Math.pow(1 + periodRate, interestPeriodsInPaymentPeriod) - 1;
          
          remainingBalance = remainingBalance * (1 + effectiveRate);
          remainingBalance = Math.max(0, remainingBalance - payment);
          periods++;
        }
        
        return periods;
      }
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="max-w-sm mx-auto bg-white min-h-screen relative">
      <Header title="Loans" subtitle="Manage your debts" />
      
      <main className="pb-20 px-4 space-y-6 pt-4">
        {/* Add Loan Button */}
        <Button onClick={openCreateDialog} className="w-full bg-primary text-white rounded-xl py-3">
          <Plus className="h-5 w-5 mr-2" />
          Add Loan
        </Button>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-sm mx-auto max-h-[80vh] overflow-y-auto">
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
                        <Input
                          {...field}
                          placeholder="e.g., Car Loan"
                          className="px-4 py-3 border border-gray-300 rounded-xl"
                        />
                      </FormControl>
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
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          placeholder="Original loan amount"
                          className="px-4 py-3 border border-gray-300 rounded-xl"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="balance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Balance (MWK) - Optional</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          placeholder="Leave empty to use principal amount"
                          className="px-4 py-3 border border-gray-300 rounded-xl"
                        />
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
                      <FormLabel>Annual Interest Rate (%) - Optional</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          placeholder="e.g., 15 (for 15% per year)"
                          className="px-4 py-3 border border-gray-300 rounded-xl"
                        />
                      </FormControl>
                      <p className="text-xs text-gray-600 mt-1">
                        Enter the yearly interest rate. Leave empty for interest-free loan.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="interestType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interest Type</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white"
                        >
                          <option value="">Select interest type</option>
                          <option value="simple">Simple Interest</option>
                          <option value="compound">Compound Interest</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {interestType === "compound" && (
                  <FormField
                    control={form.control}
                    name="interestPeriod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Compounding Frequency</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white"
                          >
                            <option value="">Select compounding frequency</option>
                            {frequencyOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="useRecurringPayments"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="mt-1"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Use recurring payments to settle this loan</FormLabel>
                        <p className="text-xs text-gray-600">
                          Check this if you plan to make regular scheduled payments. Leave unchecked for flexible payment schedules.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {useRecurringPayments && (
                  <>
                    <FormField
                      control={form.control}
                      name="repaymentFrequency"
                      render={({ field }) => (
                    <FormItem>
                      <FormLabel>Repayment Frequency</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white"
                        >
                          <option value="">Select repayment frequency</option>
                          {frequencyOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                    <FormField
                      control={form.control}
                      name="minPayment"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Repayment Amount (MWK)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="px-4 py-3 border border-gray-300 rounded-xl"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="payoffTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payoff Time (periods)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="1"
                              placeholder="Number of payment periods"
                              className="px-4 py-3 border border-gray-300 rounded-xl"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Next Due Date</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="date"
                              className="px-4 py-3 border border-gray-300 rounded-xl"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loan Start Date</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="date"
                          className="px-4 py-3 border border-gray-300 rounded-xl"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full bg-primary text-white rounded-xl"
                  disabled={createLoanMutation.isPending || updateLoanMutation.isPending}
                >
                  {editingLoan
                    ? (updateLoanMutation.isPending ? "Updating..." : "Edit Loan")
                    : (createLoanMutation.isPending ? "Adding..." : "Add Loan")
                  }
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Loans List */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 animate-pulse">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-xl"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                </div>
              </div>
            ))}
          </div>
        ) : loans.length === 0 ? (
          <div className="bg-white rounded-xl p-8 border border-gray-100 text-center">
            <div className="text-4xl mb-4">💳</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No loans yet</h3>
            <p className="text-gray-500 mb-4">
              Add your first loan to start tracking your debt payments
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {loans.map((loan) => {
              const balance = parseFloat(loan.balance || "0");
              const minPayment = parseFloat(loan.minPayment || "0");
              const interestRate = parseFloat(loan.interestRate || "0");
              const interestType = loan.interestType || "compound";
              const interestPeriod = loan.interestPeriod || "monthly";
              const repaymentFreq = loan.repaymentFrequency || "monthly";
              
              const payoffPeriods = calculatePayoffPeriods(
                balance,
                minPayment,
                interestRate,
                interestType,
                interestPeriod,
                repaymentFreq
              );
              
              const totalInterest = payoffPeriods * minPayment - balance;
              
              // Convert periods to a readable format
              const getTimeDisplay = (periods: number, frequency: string) => {
                if (frequency === "daily") return `${periods} days`;
                if (frequency === "weekly") return `${periods} weeks`;
                if (frequency === "biweekly") return `${Math.round(periods / 26 * 12)} months`;
                if (frequency === "monthly") return `${periods} months`;
                if (frequency === "quarterly") return `${periods} quarters`;
                if (frequency === "annually") return `${periods} years`;
                return `${periods} payments`;
              };

              const loanProgress = calculateLoanProgress(loan.id, loan.principalAmount || "0", loan.balance);
              
              return (
                <div key={loan.id} className="bg-white rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                        <span className="text-sm">💳</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{loan.name}</h3>
                        <p className="text-sm text-gray-500">
                          {loan.nextPaymentDate ? `Due: ${formatDate(loan.nextPaymentDate as Date)}` : "No due date set"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(loan)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteLoanMutation.mutate(loan.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Loan Progress Bar */}
                  {loan.principalAmount && parseFloat(loan.principalAmount) > 0 && (
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">
                          Repaid: {formatCurrency(loanProgress.totalRepaid)}
                        </span>
                        <span className="font-medium text-green-600">
                          {Math.round(loanProgress.progressPercentage)}%
                        </span>
                      </div>
                      <ProgressBar
                        percentage={loanProgress.progressPercentage}
                        color="#10B981"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        {formatCurrency(loanProgress.remainingBalance)} remaining of {formatCurrency(parseFloat(loan.principalAmount))} original loan
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Balance:</span>
                      <span className="font-semibold text-red-600">
                        {formatCurrency(balance)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Interest Rate:</span>
                      <span className="font-medium">{interestRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Repayment Amount:</span>
                      <span className="font-medium">{formatCurrency(minPayment)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Repayments Needed:</span>
                      <span className="font-medium text-blue-600">
                        {payoffPeriods} payments
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-sm text-gray-500">Payoff Time:</span>
                      <span className="font-medium text-orange-600">
                        {getTimeDisplay(payoffPeriods, repaymentFreq)}
                      </span>
                    </div>
                    {totalInterest > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Total Interest:</span>
                        <span className="font-medium text-red-600">
                          {formatCurrency(totalInterest)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <BottomNavigation />
    </div>
  );
}