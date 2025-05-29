import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Trash2, Calculator } from "lucide-react";
import Header from "@/components/layout/header";
import BottomNavigation from "@/components/layout/bottom-navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useLoans } from "@/hooks/use-loans";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";
import type { InsertLoan } from "@shared/schema";

const loanSchema = z.object({
  name: z.string().min(1, "Loan name is required"),
  principalAmount: z.string().min(1, "Principal amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Principal amount must be a positive number"
  ),
  balance: z.string().min(1, "Current balance is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Balance must be a positive number"
  ),
  interestRate: z.string().min(1, "Interest rate is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0,
    "Interest rate must be a valid number"
  ),
  interestType: z.enum(["simple", "compound"], { 
    required_error: "Please select interest type" 
  }),
  minPayment: z.string().min(1, "Minimum payment is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Minimum payment must be a positive number"
  ),
  dueDate: z.string().min(1, "Due date is required"),
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
  
  const { data: loans = [], isLoading } = useLoans();
  const { toast } = useToast();

  const form = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      name: "",
      balance: "",
      interestRate: "",
      minPayment: "",
      dueDate: "",
    },
  });

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
      balance: data.balance,
      interestRate: data.interestRate,
      interestType: data.interestType,
      minPayment: data.minPayment,
      nextPaymentDate: data.dueDate,
      icon: "💳",
      color: "#DC2626",
    };
    createLoanMutation.mutate(loanData);
  };

  const calculateMonthsToPayoff = (balance: number, payment: number, rate: number, interestType: string = "compound") => {
    if (rate === 0) return Math.ceil(balance / payment);
    
    if (interestType === "simple") {
      // For simple interest, we approximate the payoff time
      const monthlyRate = rate / 100 / 12;
      const totalInterest = balance * monthlyRate;
      return Math.ceil((balance + totalInterest) / payment);
    } else {
      // Compound interest calculation
      const monthlyRate = rate / 100 / 12;
      return Math.ceil(Math.log(1 + (balance * monthlyRate) / payment) / Math.log(1 + monthlyRate));
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
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full bg-primary text-white rounded-xl py-3">
              <Plus className="h-5 w-5 mr-2" />
              Add Loan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm mx-auto">
            <DialogHeader>
              <DialogTitle>Add New Loan</DialogTitle>
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
                      <FormLabel>Current Balance (MWK)</FormLabel>
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
                  name="interestRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interest Rate (%)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          placeholder="5.00"
                          className="px-4 py-3 border border-gray-300 rounded-xl"
                        />
                      </FormControl>
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

                <FormField
                  control={form.control}
                  name="minPayment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum Payment</FormLabel>
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

                <Button 
                  type="submit" 
                  className="w-full bg-primary text-white rounded-xl"
                  disabled={createLoanMutation.isPending}
                >
                  {createLoanMutation.isPending ? "Adding..." : "Add Loan"}
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
              const balance = parseFloat(loan.balance);
              const minPayment = parseFloat(loan.minPayment);
              const interestRate = parseFloat(loan.interestRate);
              const monthsToPayoff = calculateMonthsToPayoff(balance, minPayment, interestRate);
              const totalInterest = (minPayment * monthsToPayoff) - balance;

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
                          Due: {formatDate(loan.nextPaymentDate)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteLoanMutation.mutate(loan.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

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
                      <span className="text-sm text-gray-500">Min Payment:</span>
                      <span className="font-medium">{formatCurrency(minPayment)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-sm text-gray-500">Payoff Time:</span>
                      <span className="font-medium text-orange-600">
                        {monthsToPayoff} months
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