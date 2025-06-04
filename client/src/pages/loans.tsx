import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Trash2, Plus, Edit, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/currency";
import { useLoans } from "@/hooks/use-loans";
import { useTransactions } from "@/hooks/use-transactions";
import type { InsertLoan } from "@shared/schema";
import type { Transaction } from "@shared/schema";
import Header from "@/components/layout/header";
import BottomNavigation from "@/components/layout/bottom-navigation";

const frequencyOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "triweekly", label: "Tri-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "bimonthly", label: "Bi-monthly" },
  { value: "trimonthly", label: "Tri-monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
];

const loanSchema = z.object({
  name: z.string().min(1, "Loan name is required"),
  principalAmount: z.string().min(1, "Principal amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Principal amount must be a positive number"
  ),
  interestRate: z.string().optional().refine(
    (val) => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
    "Interest rate must be a valid number if provided"
  ),
  interestType: z.enum(["simple", "compound"], { 
    required_error: "Please select interest type" 
  }),
  currentRepayment: z.string().optional().refine(
    (val) => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
    "Current repayment must be a positive number if provided"
  ),
  interestPeriod: z.enum(["daily", "weekly", "biweekly", "triweekly", "monthly", "bimonthly", "trimonthly", "quarterly", "annually"], {
    required_error: "Please select interest period"
  }),
  isAmortized: z.boolean().default(false),
  repaymentFrequency: z.enum(["daily", "weekly", "biweekly", "triweekly", "monthly", "bimonthly", "trimonthly", "quarterly", "annually"]).optional(),
  loanTermYears: z.string().optional(),
  loanTermMonths: z.string().optional(),
  dueDate: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
});

type LoanFormData = z.infer<typeof loanSchema>;

const loanTypes = [
  { value: "simple", label: "Simple Interest" },
  { value: "compound", label: "Compound Interest" },
];

export default function Loans() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<any>(null);
  const [transactionHistoryLoan, setTransactionHistoryLoan] = useState<any>(null);
  
  const { data: loans = [], isLoading } = useLoans();
  const { data: transactions = [] } = useTransactions();
  const { toast } = useToast();

  // Calculate total interest based on loan type and terms
  const calculateTotalInterest = (loan: any) => {
    const principal = parseFloat(loan?.principalAmount || "0");
    const rate = parseFloat(loan?.interestRate || "0") / 100;
    const termMonths = loan?.loanTermMonths || 12;
    
    if (!loan || principal <= 0 || rate < 0) return 0;
    
    if (loan.interestType === "simple") {
      // Simple Interest: I = P * R * T (T in years)
      return principal * rate * (termMonths / 12);
    } else {
      // Compound Interest: Calculate based on payment schedule
      if (loan.isAmortized && loan.calculatedPayment) {
        const monthlyPayment = parseFloat(loan.calculatedPayment || "0");
        const totalPaid = monthlyPayment * termMonths;
        return Math.max(0, totalPaid - principal);
      } else {
        // Compound interest without amortization
        const monthlyRate = rate / 12;
        const compoundAmount = principal * Math.pow(1 + monthlyRate, termMonths);
        return compoundAmount - principal;
      }
    }
  };

  // Calculate payment allocation for simple interest loans
  const calculatePaymentAllocation = (totalPayment: number, principal: number, totalInterest: number) => {
    const totalDue = principal + totalInterest;
    if (totalDue <= 0) return { principalPortion: 0, interestPortion: 0 };
    
    const principalRatio = principal / totalDue;
    const interestRatio = totalInterest / totalDue;
    
    return {
      principalPortion: totalPayment * principalRatio,
      interestPortion: totalPayment * interestRatio
    };
  };

  // Calculate comprehensive loan progress with interest tracking
  const calculateLoanProgress = (loan: any) => {
    if (!loan) {
      return {
        totalAmountDue: 0,
        totalInterest: 0,
        totalPaymentsMade: 0,
        totalRemaining: 0,
        principalAmount: 0,
        principalPaid: 0,
        principalRemaining: 0,
        principalProgressPercentage: 0,
        interestPaid: 0,
        interestRemaining: 0,
        interestProgressPercentage: 0,
        totalProgressPercentage: 0
      };
    }

    const principal = parseFloat(loan.principalAmount || "0");
    const totalInterest = calculateTotalInterest(loan);
    const totalAmountDue = principal + totalInterest;
    
    // Find all loan payment transactions for this specific loan
    const loanPayments = transactions.filter((transaction: Transaction) => 
      transaction.loanId === loan.id && transaction.type === 'loan_payment'
    );
    
    // Calculate total payments made through transactions
    const transactionPayments = loanPayments.reduce((total: number, transaction: Transaction) => {
      return total + parseFloat(transaction.amount || "0");
    }, 0);
    
    // Add current repayment for simple interest loans
    let currentRepaymentAmount = 0;
    if (loan.interestType === "simple" && loan.currentRepayment) {
      currentRepaymentAmount = parseFloat(loan.currentRepayment || "0");
    }
    
    const totalPaymentsMade = transactionPayments + currentRepaymentAmount;
    
    // Calculate payment allocation
    let principalPaid = 0;
    let interestPaid = 0;
    
    if (loan.interestType === "simple") {
      // For simple interest, allocate payments proportionally
      const currentAllocation = calculatePaymentAllocation(currentRepaymentAmount, principal, totalInterest);
      const transactionAllocation = calculatePaymentAllocation(transactionPayments, principal, totalInterest);
      
      principalPaid = currentAllocation.principalPortion + transactionAllocation.principalPortion;
      interestPaid = currentAllocation.interestPortion + transactionAllocation.interestPortion;
    } else {
      // For compound interest with amortization, use existing logic
      const currentBalance = parseFloat(loan.balance || loan.principalAmount || "0");
      principalPaid = Math.max(0, principal - currentBalance);
      interestPaid = Math.max(0, totalPaymentsMade - principalPaid);
    }
    
    // Remaining amounts
    const principalRemaining = Math.max(0, principal - principalPaid);
    const interestRemaining = Math.max(0, totalInterest - interestPaid);
    const totalRemaining = principalRemaining + interestRemaining;
    
    // Progress percentages
    const totalProgressPercentage = totalAmountDue > 0 ? (totalPaymentsMade / totalAmountDue) * 100 : 0;
    const principalProgressPercentage = principal > 0 ? (principalPaid / principal) * 100 : 0;
    const interestProgressPercentage = totalInterest > 0 ? (interestPaid / totalInterest) * 100 : 0;
    
    return {
      // Total amounts
      totalAmountDue,
      totalInterest,
      totalPaymentsMade,
      totalRemaining,
      
      // Principal breakdown
      principalAmount: principal,
      principalPaid,
      principalRemaining,
      principalProgressPercentage: Math.min(principalProgressPercentage, 100),
      
      // Interest breakdown
      interestPaid,
      interestRemaining,
      interestProgressPercentage: Math.min(interestProgressPercentage, 100),
      
      // Overall progress
      totalProgressPercentage: Math.min(totalProgressPercentage, 100)
    };
  };

  const form = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      name: "",
      principalAmount: "",
      interestRate: "",
      interestType: "simple",
      currentRepayment: "",
      interestPeriod: "monthly",
      isAmortized: false,
      repaymentFrequency: "monthly",
      loanTermYears: "",
      loanTermMonths: "",
      dueDate: "",
      startDate: new Date().toISOString().split('T')[0],
    },
  });

  // Calculate amortized payment amount
  const calculateAmortizedPayment = (principal: number, rate: number, termMonths: number): number => {
    if (principal <= 0 || rate <= 0 || termMonths <= 0) return 0;
    
    const monthlyRate = rate / 100 / 12;
    
    if (monthlyRate === 0) {
      return principal / termMonths;
    }
    
    return (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
           (Math.pow(1 + monthlyRate, termMonths) - 1);
  };

  // Watch form values for amortization calculations
  const watchedValues = form.watch(['principalAmount', 'interestRate', 'loanTermYears', 'loanTermMonths', 'interestType', 'isAmortized']);

  // Calculate payment amount for amortized loans
  const [calculatedPayment, setCalculatedPayment] = useState<string>("");

  useEffect(() => {
    const [principal, interestRate, termYears, termMonths, interestType, isAmortized] = watchedValues;
    
    if (isAmortized && interestType === 'compound' && principal && interestRate) {
      const principalNum = parseFloat(principal);
      const rateNum = parseFloat(interestRate);
      const yearsNum = parseInt(termYears || "0");
      const monthsNum = parseInt(termMonths || "0");
      const totalMonths = yearsNum * 12 + monthsNum;
      
      if (principalNum > 0 && rateNum >= 0 && totalMonths > 0) {
        const payment = calculateAmortizedPayment(principalNum, rateNum, totalMonths);
        setCalculatedPayment(payment.toFixed(2));
      } else {
        setCalculatedPayment("");
      }
    } else {
      setCalculatedPayment("");
    }
  }, watchedValues);

  const mutation = useMutation({
    mutationFn: async (data: InsertLoan) => {
      if (editingLoan) {
        return apiRequest("PATCH", `/api/loans/${editingLoan.id}`, data);
      } else {
        return apiRequest("POST", "/api/loans", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      setIsModalOpen(false);
      setEditingLoan(null);
      form.reset();
      setCalculatedPayment("");
      toast({
        title: "Success",
        description: `Loan ${editingLoan ? "updated" : "created"} successfully`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/loans/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      toast({
        title: "Success",
        description: "Loan deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoanFormData) => {
    console.log("Form submission data:", data);
    console.log("Form errors:", form.formState.errors);
    
    // Convert loan term to total months for database storage
    const yearsNum = parseInt(data.loanTermYears || "0");
    const monthsNum = parseInt(data.loanTermMonths || "0");
    const totalMonths = yearsNum * 12 + monthsNum;

    const submitData: InsertLoan = {
      name: data.name,
      principalAmount: data.principalAmount,
      balance: data.interestType === "simple" ? 
        (parseFloat(data.principalAmount) - parseFloat(data.currentRepayment || "0")).toString() : 
        data.principalAmount,
      currentRepayment: data.interestType === "simple" ? (data.currentRepayment || "0") : null,
      interestRate: data.interestRate || "0",
      interestType: data.interestType,
      interestPeriod: data.interestType === "compound" ? data.interestPeriod : null,
      isAmortized: data.isAmortized,
      repaymentFrequency: data.repaymentFrequency,
      loanTermMonths: totalMonths > 0 ? totalMonths : undefined,
      calculatedPayment: data.isAmortized && calculatedPayment ? calculatedPayment : undefined,
      nextPaymentDate: data.dueDate || new Date().toISOString().split('T')[0],
      startDate: data.startDate,
      icon: "💰",
      color: "#3b82f6",
    };

    console.log("Submit data:", submitData);
    mutation.mutate(submitData);
  };

  const handleEdit = (loan: any) => {
    setEditingLoan(loan);
    
    // Convert total months back to years and months for display
    const totalMonths = loan.loanTermMonths || 0;
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;

    form.reset({
      name: loan.name,
      principalAmount: loan.principalAmount,
      currentRepayment: loan.currentRepayment || "",
      interestRate: loan.interestRate,
      interestType: loan.interestType,
      interestPeriod: loan.interestPeriod,
      isAmortized: loan.isAmortized || false,
      repaymentFrequency: loan.repaymentFrequency,
      loanTermYears: years > 0 ? years.toString() : "",
      loanTermMonths: months > 0 ? months.toString() : "",
      dueDate: loan.nextPaymentDate ? new Date(loan.nextPaymentDate).toISOString().split('T')[0] : "",
      startDate: new Date(loan.startDate).toISOString().split('T')[0],
    });
    
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this loan?")) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header title="Loans" subtitle="Track your loan repayments" />
      
      <div className="px-4 py-6 pb-20">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your Loans</h2>
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Loan
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
          {loans.map((loan: any) => {
            const progress = calculateLoanProgress(loan);
            
            return (
              <Card key={loan.id} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{loan.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTransactionHistoryLoan(loan)}
                        title="View Payment History"
                      >
                        <History className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(loan)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(loan.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription>
                    {loan.interestType === "compound" ? "Compound" : "Simple"} Interest • {loan.interestRate}% Annual
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Loan Overview */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Principal Amount:</span>
                          <span className="font-medium">{formatCurrency(progress.principalAmount)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Total Interest:</span>
                          <span className="font-medium">{formatCurrency(progress.totalInterest)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-semibold border-t pt-2">
                          <span className="text-gray-900 dark:text-gray-100">Total Amount Due:</span>
                          <span className="text-blue-600 dark:text-blue-400">{formatCurrency(progress.totalAmountDue)}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Total Paid:</span>
                          <span className="font-medium text-green-600">{formatCurrency(progress.totalPaymentsMade)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Remaining:</span>
                          <span className="font-medium text-orange-600">{formatCurrency(progress.totalRemaining)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-semibold border-t pt-2">
                          <span className="text-gray-900 dark:text-gray-100">Overall Progress:</span>
                          <span className="text-blue-600 dark:text-blue-400">{progress.totalProgressPercentage.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Payment Breakdown */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                      <h4 className="text-sm font-medium mb-3 text-gray-900 dark:text-gray-100">Payment Breakdown</h4>
                      
                      <div className="space-y-3">
                        {/* Principal Progress */}
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600 dark:text-gray-400">Principal</span>
                            <span className="font-medium">{progress.principalProgressPercentage.toFixed(1)}%</span>
                          </div>
                          <Progress value={progress.principalProgressPercentage} className="h-2" />
                          <div className="flex justify-between text-xs mt-1">
                            <span className="text-green-600">Paid: {formatCurrency(progress.principalPaid)}</span>
                            <span className="text-orange-600">Remaining: {formatCurrency(progress.principalRemaining)}</span>
                          </div>
                        </div>

                        {/* Interest Progress */}
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600 dark:text-gray-400">Interest</span>
                            <span className="font-medium">{progress.interestProgressPercentage.toFixed(1)}%</span>
                          </div>
                          <Progress value={progress.interestProgressPercentage} className="h-2 [&>div]:bg-orange-500" />
                          <div className="flex justify-between text-xs mt-1">
                            <span className="text-green-600">Paid: {formatCurrency(progress.interestPaid)}</span>
                            <span className="text-orange-600">Remaining: {formatCurrency(progress.interestRemaining)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Loan Details */}
                    {loan.isAmortized && (
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Payment Frequency:</span>
                            <span className="font-medium capitalize">{loan.repaymentFrequency}</span>
                          </div>
                          {loan.calculatedPayment && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Payment Amount:</span>
                              <span className="font-medium">{formatCurrency(parseFloat(loan.calculatedPayment))}</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          {loan.loanTermMonths && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Loan Term:</span>
                              <span className="font-medium">
                                {Math.floor(loan.loanTermMonths / 12) > 0 && `${Math.floor(loan.loanTermMonths / 12)}y `}
                                {loan.loanTermMonths % 12 > 0 && `${loan.loanTermMonths % 12}m`}
                              </span>
                            </div>
                          )}
                          {loan.nextPaymentDate && (
                            <div className="flex justify-between">
                              <span className="text-gray-600 dark:text-gray-400">Next Payment:</span>
                              <span className="font-medium">
                                {new Date(loan.nextPaymentDate).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Payment Transaction History Modal */}
        {transactionHistoryLoan && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Payment History - {transactionHistoryLoan.name}</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTransactionHistoryLoan(null)}
                  >
                    ×
                  </Button>
                </div>
                
                {(() => {
                  const loanPayments = transactions.filter((transaction: Transaction) => 
                    transaction.loanId === transactionHistoryLoan.id && transaction.type === 'loan_payment'
                  );
                  
                  if (loanPayments.length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-500">
                        No payment transactions found for this loan.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {loanPayments.map((transaction: Transaction) => {
                        const amount = parseFloat(transaction.amount || "0");
                        const totalInterest = calculateTotalInterest(transactionHistoryLoan);
                        const allocation = calculatePaymentAllocation(amount, parseFloat(transactionHistoryLoan.principalAmount), totalInterest);
                        
                        return (
                          <div key={transaction.id} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <div className="font-medium">{formatCurrency(amount)}</div>
                                <div className="text-sm text-gray-500">
                                  {new Date(transaction.date).toLocaleDateString()}
                                </div>
                              </div>
                              <div className="text-sm text-gray-600">
                                {transaction.description && (
                                  <div className="mb-1">{transaction.description}</div>
                                )}
                                <div className="text-xs">
                                  Category: {transaction.category}
                                </div>
                              </div>
                            </div>
                            
                            {transactionHistoryLoan.interestType === "simple" && (
                              <div className="bg-gray-50 dark:bg-gray-700 rounded p-3 text-sm">
                                <div className="font-medium mb-1">Payment Allocation:</div>
                                <div className="flex justify-between">
                                  <span>Principal:</span>
                                  <span className="text-green-600">{formatCurrency(allocation.principalPortion)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Interest:</span>
                                  <span className="text-orange-600">{formatCurrency(allocation.interestPortion)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Loan Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">
                  {editingLoan ? "Edit Loan" : "Add New Loan"}
                </h3>
                
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Loan Name</Label>
                      <Input
                        id="name"
                        {...form.register("name")}
                        placeholder="e.g., Car Loan"
                      />
                      {form.formState.errors.name && (
                        <p className="text-red-500 text-sm mt-1">{form.formState.errors.name.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="principalAmount">Principal Amount (MWK)</Label>
                      <Input
                        id="principalAmount"
                        type="number"
                        step="0.01"
                        {...form.register("principalAmount")}
                        placeholder="e.g., 1000000"
                      />
                      {form.formState.errors.principalAmount && (
                        <p className="text-red-500 text-sm mt-1">{form.formState.errors.principalAmount.message}</p>
                      )}
                    </div>

                    {/* Current Repayment field - only for simple interest */}
                    {form.watch("interestType") === "simple" && (
                      <div>
                        <Label htmlFor="currentRepayment">Current Repayment (MWK)</Label>
                        <Input
                          id="currentRepayment"
                          type="number"
                          step="0.01"
                          {...form.register("currentRepayment")}
                          placeholder="Amount already paid toward this loan"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          This amount will be allocated between principal and interest based on the loan ratio
                        </p>
                        {form.formState.errors.currentRepayment && (
                          <p className="text-red-500 text-sm mt-1">{form.formState.errors.currentRepayment.message}</p>
                        )}
                      </div>
                    )}

                    <div>
                      <Label htmlFor="interestRate">Annual Interest Rate (%)</Label>
                      <Input
                        id="interestRate"
                        type="number"
                        step="0.01"
                        {...form.register("interestRate")}
                        placeholder="e.g., 15.5 (for 15.5% annual)"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Examples: 10 (for 10%), 15.5 (for 15.5%), 25 (for 25%)
                      </p>
                      {form.formState.errors.interestRate && (
                        <p className="text-red-500 text-sm mt-1">{form.formState.errors.interestRate.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="interestType">Interest Type</Label>
                      <Select
                        value={form.watch("interestType")}
                        onValueChange={(value) => form.setValue("interestType", value as "simple" | "compound")}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select interest type" />
                        </SelectTrigger>
                        <SelectContent>
                          {loanTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.formState.errors.interestType && (
                        <p className="text-red-500 text-sm mt-1">{form.formState.errors.interestType.message}</p>
                      )}
                    </div>

                    {/* Interest Compounding Frequency - only for compound interest */}
                    {form.watch("interestType") === "compound" && (
                      <div>
                        <Label htmlFor="interestPeriod">Interest Compounding Frequency</Label>
                        <Select
                          value={form.watch("interestPeriod")}
                          onValueChange={(value) => form.setValue("interestPeriod", value as any)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                          <SelectContent>
                            {frequencyOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {form.formState.errors.interestPeriod && (
                          <p className="text-red-500 text-sm mt-1">{form.formState.errors.interestPeriod.message}</p>
                        )}
                      </div>
                    )}

                    <div>
                      <Label htmlFor="startDate">Start Date</Label>
                      <Input
                        id="startDate"
                        type="date"
                        {...form.register("startDate")}
                      />
                      {form.formState.errors.startDate && (
                        <p className="text-red-500 text-sm mt-1">{form.formState.errors.startDate.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Loan Term - Always visible for both simple and compound interest */}
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="font-medium">Loan Term</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {form.watch("interestType") === "simple" 
                        ? "Required for simple interest calculation (Principal × Rate × Time)"
                        : "Required for compound interest calculation"
                      }
                    </p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="loanTermYears">Loan Term (Years)</Label>
                        <Input
                          id="loanTermYears"
                          type="number"
                          min="0"
                          {...form.register("loanTermYears")}
                          placeholder="e.g., 5"
                        />
                      </div>

                      <div>
                        <Label htmlFor="loanTermMonths">Additional Months</Label>
                        <Input
                          id="loanTermMonths"
                          type="number"
                          min="0"
                          max="11"
                          {...form.register("loanTermMonths")}
                          placeholder="e.g., 6"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Amortization Checkbox - Only show for compound interest */}
                  {form.watch("interestType") === "compound" && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isAmortized"
                        checked={form.watch("isAmortized")}
                        onCheckedChange={(checked) => form.setValue("isAmortized", !!checked)}
                      />
                      <Label htmlFor="isAmortized">Use amortization (fixed payment schedule)</Label>
                    </div>
                  )}

                  {/* Amortization Fields - Only show when amortization is enabled */}
                  {form.watch("isAmortized") && form.watch("interestType") === "compound" && (
                    <div className="space-y-4 border-t pt-4">
                      <h4 className="font-medium">Amortization Details</h4>
                      
                      <div>
                        <Label htmlFor="repaymentFrequency">Payment Frequency</Label>
                        <Select
                          value={form.watch("repaymentFrequency")}
                          onValueChange={(value) => form.setValue("repaymentFrequency", value as any)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                          <SelectContent>
                            {frequencyOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>



                      {calculatedPayment && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                          <Label className="text-sm font-medium">Calculated Payment Amount</Label>
                          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            {formatCurrency(parseFloat(calculatedPayment))}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Based on loan amount, interest rate, and term
                          </p>
                        </div>
                      )}

                      <div>
                        <Label htmlFor="dueDate">Next Payment Due Date</Label>
                        <Input
                          id="dueDate"
                          type="date"
                          {...form.register("dueDate")}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsModalOpen(false);
                        setEditingLoan(null);
                        form.reset();
                        setCalculatedPayment("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={mutation.isPending}>
                      {mutation.isPending ? "Saving..." : editingLoan ? "Update Loan" : "Add Loan"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
}