import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Plus, Edit, Trash2, DollarSign, Calendar, TrendingUp, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/currency";
import { insertLoanSchema, type Loan, type InsertLoan } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/layout/header";
import BottomNavigation from "@/components/layout/bottom-navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import ProgressBar from "@/components/ui/progress-bar";

const loanFormSchema = z.object({
  name: z.string().min(1, "Loan name is required"),
  principal: z.string().min(1, "Principal amount is required"),
  interestRate: z.string().regex(/^\d*\.?\d*$/, "Must be a valid number"),
  interestType: z.string().default("compound"),
  termYears: z.string().default("0"),
  termMonths: z.string().default("0"),
  compoundFrequency: z.string().optional(),
  paybackFrequency: z.string().optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  loanType: z.string(),
  lender: z.string().optional(),
  description: z.string().optional(),
  status: z.string().default("active")
}).refine((data) => {
  const years = parseInt(data.termYears) || 0;
  const months = parseInt(data.termMonths) || 0;
  return (years * 12 + months) > 0;
}, {
  message: "Loan term must be at least 1 month",
  path: ["termMonths"]
});

type LoanFormData = z.infer<typeof loanFormSchema>;

const loanTypeIcons: Record<string, string> = {
  personal: "👤",
  mortgage: "🏠",
  auto: "🚗",
  student: "🎓",
  business: "💼",
  credit_card: "💳",
  other: "📝"
};

const loanTypeLabels: Record<string, string> = {
  personal: "Personal Loan",
  mortgage: "Mortgage",
  auto: "Auto Loan",
  student: "Student Loan",
  business: "Business Loan",
  credit_card: "Credit Card",
  other: "Other"
};

const compoundFrequencyOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semi-annually", label: "Semi-Annually" },
  { value: "annually", label: "Annually" }
];

// Helper functions for payback frequency display
const getPaymentLabel = (frequency: string = "monthly") => {
  switch (frequency) {
    case "daily": return "Daily Payment";
    case "weekly": return "Weekly Payment";
    case "biweekly": return "Bi-Weekly Payment";
    case "monthly": return "Monthly Payment";
    case "quarterly": return "Quarterly Payment";
    case "semiannually": return "Semi-Annual Payment";
    case "annually": return "Annual Payment";
    default: return "Monthly Payment";
  }
};

const getTimeElapsedLabel = (frequency: string = "monthly") => {
  switch (frequency) {
    case "daily": return "days elapsed";
    case "weekly": return "weeks elapsed";
    case "biweekly": return "bi-weeks elapsed";
    case "monthly": return "months elapsed";
    case "quarterly": return "quarters elapsed";
    case "semiannually": return "semi-years elapsed";
    case "annually": return "years elapsed";
    default: return "months elapsed";
  }
};

const getTotalTermLabel = (frequency: string = "monthly") => {
  switch (frequency) {
    case "daily": return "total days";
    case "weekly": return "total weeks";
    case "biweekly": return "total bi-weeks";
    case "monthly": return "total months";
    case "quarterly": return "total quarters";
    case "semiannually": return "total semi-years";
    case "annually": return "total years";
    default: return "total months";
  }
};

// Helper function to convert months to payment periods
const convertMonthsToPaymentPeriods = (months: number, frequency: string = "monthly") => {
  const years = months / 12;
  switch (frequency) {
    case "daily": return Math.floor(years * 365);
    case "weekly": return Math.floor(years * 52);
    case "biweekly": return Math.floor(years * 26);
    case "monthly": return months;
    case "quarterly": return Math.floor(years * 4);
    case "semiannually": return Math.floor(years * 2);
    case "annually": return Math.floor(years);
    default: return months;
  }
};

export default function Loans() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: loans = [], isLoading } = useQuery<Loan[]>({
    queryKey: ["/api/loans"],
  });

  const form = useForm<LoanFormData>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: {
      name: "",
      principal: "",
      interestRate: "",
      interestType: "compound",
      termYears: "0",
      termMonths: "0",
      compoundFrequency: "monthly",
      paybackFrequency: "monthly",
      startDate: "",
      endDate: "",
      loanType: "",
      lender: "",
      description: "",
      status: "active"
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertLoan) => {
      return await apiRequest("POST", "/api/loans", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
      toast({ title: "Loan added successfully!" });
      handleCloseModal();
    },
    onError: () => {
      toast({ title: "Failed to add loan", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: InsertLoan & { id: number }) => {
      return await apiRequest("PUT", `/api/loans/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
      // Invalidate all loan progress queries to trigger recalculation
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes("/progress");
        }
      });
      toast({ title: "Loan updated successfully!" });
      handleCloseModal();
    },
    onError: () => {
      toast({ title: "Failed to update loan", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/loans/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
      toast({ title: "Loan deleted successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to delete loan", variant: "destructive" });
    },
  });

  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const onSubmit = (data: LoanFormData) => {
    const submitData: InsertLoan = {
      name: data.name,
      principal: data.principal,
      currentBalance: data.principal, // Initialize with principal amount
      interestRate: data.interestRate,
      interestType: data.interestType as "simple" | "compound",
      termMonths: (parseInt(data.termYears) || 0) * 12 + (parseInt(data.termMonths) || 0),
      compoundFrequency: data.compoundFrequency,
      paybackFrequency: data.paybackFrequency,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      loanType: data.loanType as "personal" | "mortgage" | "auto" | "student" | "business" | "credit_card" | "other",
      lender: data.lender,
      description: data.description,
      status: data.status as "active" | "paid_off" | "defaulted"
    };

    if (editingLoan) {
      updateMutation.mutate({ ...submitData, id: editingLoan.id });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleEdit = (loan: Loan) => {
    setEditingLoan(loan);
    const termYears = Math.floor((loan.termMonths || 0) / 12);
    const termMonths = (loan.termMonths || 0) % 12;
    
    form.reset({
      name: loan.name,
      principal: loan.principal,

      interestRate: loan.interestRate || "",
      interestType: loan.interestType || "compound",
      termYears: termYears.toString(),
      termMonths: termMonths.toString(),
      compoundFrequency: loan.compoundFrequency || "monthly",
      paybackFrequency: loan.paybackFrequency || "monthly",
      startDate: formatDateForInput(new Date(loan.startDate)),
      endDate: loan.endDate ? formatDateForInput(new Date(loan.endDate)) : "",
      loanType: loan.loanType,
      lender: loan.lender || "",
      description: loan.description || "",
      status: loan.status || "active"
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingLoan(null);
    form.reset();
  };

  const handleTermChange = () => {
    const startDate = form.getValues("startDate");
    const years = parseInt(form.getValues("termYears")) || 0;
    const months = parseInt(form.getValues("termMonths")) || 0;
    
    if (startDate && (years > 0 || months > 0)) {
      const start = new Date(startDate);
      const end = new Date(start);
      end.setFullYear(start.getFullYear() + years);
      end.setMonth(start.getMonth() + months);
      form.setValue("endDate", formatDateForInput(end));
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading loans...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-6xl mx-auto px-4 pt-20 pb-20 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Loans</h1>
            <p className="text-gray-600">Manage your loans and track repayment progress</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Loan
          </Button>
        </div>

        {loans && loans.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No loans yet</h3>
            <p className="text-gray-600 mb-6">Start by adding your first loan to track repayment progress</p>
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Loan
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {loans && loans.map((loan: Loan) => (
              <LoanCard 
                key={loan.id} 
                loan={loan} 
                onEdit={handleEdit}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </main>

      <BottomNavigation />

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLoan ? "Edit Loan" : "Add New Loan"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Loan Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Car Loan, Personal Loan" {...field} />
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
                      <FormLabel>Loan Type *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select loan type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(loanTypeLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {loanTypeIcons[value]} {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="principal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Principal Amount (MWK) *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="interestRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Annual Interest Rate (%)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
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
                      <Select onValueChange={(value) => {
                        field.onChange(value);
                        if (value === "simple") {
                          form.setValue("compoundFrequency", undefined);
                          form.setValue("paybackFrequency", undefined);
                        } else {
                          form.setValue("compoundFrequency", "monthly");
                          form.setValue("paybackFrequency", "monthly");
                        }
                      }} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select interest type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="simple">Simple Interest</SelectItem>
                          <SelectItem value="compound">Compound Interest</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("interestType") === "compound" && (
                  <FormField
                    control={form.control}
                    name="compoundFrequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Compounding Frequency</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value || "monthly"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {compoundFrequencyOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {form.watch("interestType") === "compound" && (
                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="paybackFrequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Frequency</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value || "monthly"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select payment frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="biweekly">Bi-Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="semiannually">Semi-Annually</SelectItem>
                            <SelectItem value="annually">Annually</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}



              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="date" 
                          onChange={(e) => {
                            field.onChange(e);
                            setTimeout(handleTermChange, 0);
                          }}
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
                          {...field} 
                          type="date" 
                          onChange={(e) => {
                            field.onChange(e);
                            setTimeout(handleTermChange, 0);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-2">
                <FormLabel>Loan Term *</FormLabel>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="termYears"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="space-y-1">
                            <Input 
                              type="number" 
                              placeholder="0" 
                              min="0" 
                              max="50" 
                              {...field} 
                              onChange={(e) => {
                                field.onChange(e);
                                setTimeout(handleTermChange, 0);
                              }}
                            />
                            <p className="text-xs text-gray-500 text-center">Years</p>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="termMonths"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="space-y-1">
                            <Input 
                              type="number" 
                              placeholder="0" 
                              min="0" 
                              max="11" 
                              {...field} 
                              onChange={(e) => {
                                field.onChange(e);
                                setTimeout(handleTermChange, 0);
                              }}
                            />
                            <p className="text-xs text-gray-500 text-center">Months</p>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="lender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lender</FormLabel>
                      <FormControl>
                        <Input placeholder="Bank name, institution, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="paid_off">Paid Off</SelectItem>
                          <SelectItem value="defaulted">Defaulted</SelectItem>
                        </SelectContent>
                      </Select>
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
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Additional notes about this loan..." 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex space-x-4 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCloseModal}
                  className="flex-1"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingLoan
                    ? (updateMutation.isPending ? "Updating..." : "Update Loan")
                    : (createMutation.isPending ? "Adding..." : "Add Loan")
                  }
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Separate component for individual loan cards with progress tracking
function LoanCard({ 
  loan, 
  onEdit, 
  onDelete 
}: { 
  loan: Loan; 
  onEdit: (loan: Loan) => void; 
  onDelete: (id: number) => void; 
}) {
  // Fetch real progress data for all loan types (needed for dynamic balance calculation)
  // Include all relevant loan parameters in query key to ensure cache busting on changes
  const { data: progressData, refetch: refetchProgress } = useQuery({
    queryKey: [`/api/loans/${loan.id}/progress`, loan.startDate, loan.endDate, loan.principal, loan.interestRate, loan.termMonths, loan.interestType, loan.paybackFrequency, loan.compoundFrequency, Date.now()],
    enabled: true, // Enable for both simple and compound loans
    refetchOnWindowFocus: true,
    staleTime: 0, // Force fresh data
    cacheTime: 0, // Don't cache results
  });

  // Debug: log progress data for simple interest loans
  if (loan.interestType === "simple") {
    console.log(`Progress data for loan ${loan.id}:`, progressData);
    console.log(`Progress data type:`, typeof progressData);
    console.log(`Is array:`, Array.isArray(progressData));
  }

  // Calculate interest display data
  const calculateInterestDisplay = (loan: Loan) => {
    const principal = parseFloat(loan.principal);
    const currentBalance = parseFloat(loan.currentBalance);
    const termMonths = loan.termMonths || 12;
    const interestRate = parseFloat(loan.interestRate || "0") / 100;
    const interestType = loan.interestType || "compound";
    
    // Calculate months elapsed since loan start
    const startDate = new Date(loan.startDate);
    const currentDate = new Date();
    const monthsElapsed = Math.max(0, Math.min(termMonths, 
      (currentDate.getFullYear() - startDate.getFullYear()) * 12 + 
      (currentDate.getMonth() - startDate.getMonth())
    ));
    
    if (interestType === "simple") {
      // Simple interest calculations
      const termYears = termMonths / 12;
      const totalSimpleInterest = principal * interestRate * termYears;
      
      return {
        totalInterest: Math.max(0, totalSimpleInterest),
        calculatedBalance: currentBalance,
        paidAmount: null,
        monthsElapsed,
        principalProgress: null, // Will be fetched from API
        interestProgress: null, // Will be fetched from API
        scheduledInterestPaid: null // Will be fetched from API
      };
    } else {
      // Compound interest calculations with payback frequency consideration
      const payment = parseFloat(loan.monthlyPayment || "0");
      const paybackFrequency = loan.paybackFrequency ?? "monthly";
      
      // Calculate total payments based on payback frequency
      const paybackPeriodsPerYear = paybackFrequency === "daily" ? 365 : 
                                  paybackFrequency === "weekly" ? 52 : 
                                  paybackFrequency === "biweekly" ? 26 : 
                                  paybackFrequency === "monthly" ? 12 : 
                                  paybackFrequency === "quarterly" ? 4 : 
                                  paybackFrequency === "semiannually" ? 2 : 
                                  paybackFrequency === "annually" ? 1 : 12;
      
      const totalPayments = (termMonths / 12) * paybackPeriodsPerYear;
      const totalLoanInterest = payment > 0 ? (payment * totalPayments) - principal : 0;
      
      // Convert months elapsed to payment periods elapsed
      const paymentsElapsed = convertMonthsToPaymentPeriods(monthsElapsed, paybackFrequency);
      
      const scheduledPrincipalPaid = calculateScheduledPrincipalPaid(
        principal, interestRate, payment, paymentsElapsed
      );
      const principalProgress = principal > 0 ? (scheduledPrincipalPaid / principal) * 100 : 0;
      
      const scheduledInterestPaid = (payment * paymentsElapsed) - scheduledPrincipalPaid;
      const interestProgress = totalLoanInterest > 0 ? (scheduledInterestPaid / totalLoanInterest) * 100 : 0;

      return {
        totalInterest: Math.max(0, totalLoanInterest),
        calculatedBalance: currentBalance,
        paidAmount: scheduledPrincipalPaid,
        monthsElapsed,
        principalProgress: Math.min(100, Math.max(0, principalProgress)),
        interestProgress: Math.min(100, Math.max(0, interestProgress)),
        scheduledInterestPaid: Math.max(0, scheduledInterestPaid)
      };
    }
  };

  // Helper function to calculate how much principal should be paid by a given month
  const calculateScheduledPrincipalPaid = (
    principal: number, 
    annualRate: number, 
    monthlyPayment: number, 
    monthsElapsed: number
  ): number => {
    if (annualRate === 0 || monthlyPayment === 0) {
      return Math.min(principal, monthlyPayment * monthsElapsed);
    }

    const monthlyRate = annualRate / 12;
    let remainingBalance = principal;
    let totalPrincipalPaid = 0;

    for (let month = 1; month <= monthsElapsed; month++) {
      if (remainingBalance <= 0) break;
      
      const interestPayment = remainingBalance * monthlyRate;
      const principalPayment = Math.min(monthlyPayment - interestPayment, remainingBalance);
      
      totalPrincipalPaid += Math.max(0, principalPayment);
      remainingBalance -= Math.max(0, principalPayment);
    }

    return totalPrincipalPaid;
  };

  // Calculate suggested monthly payment for simple interest loans
  const getSuggestedPayment = (loan: Loan): number => {
    if (loan.interestType !== "simple") return 0;
    
    const principal = parseFloat(loan.principal);
    const annualRate = parseFloat(loan.interestRate) / 100;
    const termMonths = loan.termMonths || 12;
    const termYears = termMonths / 12;
    
    const totalInterest = principal * annualRate * termYears;
    const totalAmount = principal + totalInterest;
    
    return totalAmount / termMonths;
  };

  const { 
    totalInterest, 
    calculatedBalance, 
    paidAmount, 
    monthsElapsed, 
    principalProgress: defaultPrincipalProgress, 
    interestProgress: defaultInterestProgress, 
    scheduledInterestPaid: defaultScheduledInterestPaid 
  } = calculateInterestDisplay(loan);

  // Use real progress data for simple interest loans, fallback to calculated for compound
  const principalProgress = loan.interestType === "simple" && progressData 
    ? (progressData as any).principalProgress 
    : defaultPrincipalProgress;
  
  const interestProgress = loan.interestType === "simple" && progressData 
    ? (progressData as any).interestProgress 
    : defaultInterestProgress;
  
  const scheduledInterestPaid = loan.interestType === "simple" && progressData 
    ? (progressData as any).interestPaid 
    : defaultScheduledInterestPaid;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">{loanTypeIcons[loan.loanType]}</div>
            <div>
              <h3 className="font-semibold text-gray-900">{loan.name}</h3>
              <p className="text-sm text-gray-500">{loanTypeLabels[loan.loanType]}</p>
              {loan.lender && (
                <p className="text-xs text-gray-400">{loan.lender}</p>
              )}
            </div>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={() => onEdit(loan)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => onDelete(loan.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500">Principal</p>
            <p className="font-semibold">{formatCurrency(parseFloat(loan.principal))}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Remaining Balance</p>
            <p className="font-semibold text-red-600">
              {(() => {
                // Use dynamic currentBalance from progress API if available
                if (progressData && (progressData as any).currentBalance !== undefined) {
                  return formatCurrency((progressData as any).currentBalance);
                }
                // Fallback to stored currentBalance for loading states
                return formatCurrency(parseFloat(loan.currentBalance));
              })()}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Interest Rate</p>
            <p className="font-semibold">
              {loan.interestRate}% ({loan.interestType === "simple" ? "Simple" : "Amortized"})
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">
              {loan.interestType === "simple" 
                ? `Suggested ${getPaymentLabel(loan.paybackFrequency ?? "monthly")}`
                : getPaymentLabel(loan.paybackFrequency ?? "monthly")
              }
            </p>
            <p className="font-semibold">
              {loan.interestType === "simple" 
                ? formatCurrency(getSuggestedPayment(loan))
                : (loan.monthlyPayment ? formatCurrency(parseFloat(loan.monthlyPayment)) : "Not set")
              }
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Start Date</p>
            <p className="font-semibold text-sm">
              {loan.startDate ? new Date(loan.startDate).toLocaleDateString() : "Not set"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">End Date</p>
            <p className="font-semibold text-sm">
              {loan.endDate ? new Date(loan.endDate).toLocaleDateString() : "Not set"}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total Interest: {formatCurrency(totalInterest)}</span>
            <span className="text-gray-600">Interest Paid: {scheduledInterestPaid !== null ? formatCurrency(scheduledInterestPaid) : "Pending"}</span>
          </div>
          
          <div className="space-y-3">
            {/* Principal Progress */}
            {principalProgress !== null && typeof principalProgress === 'number' ? (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Principal Progress</span>
                  <span>{principalProgress.toFixed(1)}% paid down</span>
                </div>
                <ProgressBar 
                  percentage={principalProgress} 
                  color={principalProgress > 75 ? 'bg-green-500' : principalProgress > 50 ? 'bg-yellow-500' : 'bg-red-500'}
                />
              </div>
            ) : (
              <div className="bg-gray-100 p-2 rounded-lg">
                <div className="text-xs text-gray-500 text-center">
                  Principal progress calculation pending
                </div>
              </div>
            )}

            {/* Interest Progress */}
            {interestProgress !== null && typeof interestProgress === 'number' ? (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Interest Progress</span>
                  <span>{interestProgress.toFixed(1)}% of total interest paid</span>
                </div>
                <ProgressBar 
                  percentage={interestProgress} 
                  color={interestProgress > 75 ? 'bg-blue-500' : interestProgress > 50 ? 'bg-purple-500' : 'bg-orange-500'}
                />
              </div>
            ) : (
              <div className="bg-gray-100 p-2 rounded-lg">
                <div className="text-xs text-gray-500 text-center">
                  Interest progress calculation pending
                </div>
              </div>
            )}

            {/* Time Progress Indicator */}
            <div className="bg-gray-50 p-2 rounded-lg">
              <div className="flex justify-between text-xs text-gray-600">
                <span>{getTimeElapsedLabel(loan.paybackFrequency ?? "monthly").charAt(0).toUpperCase() + getTimeElapsedLabel(loan.paybackFrequency ?? "monthly").slice(1)}: {convertMonthsToPaymentPeriods(monthsElapsed, loan.paybackFrequency ?? "monthly")}</span>
                <span>{getTotalTermLabel(loan.paybackFrequency ?? "monthly").charAt(0).toUpperCase() + getTotalTermLabel(loan.paybackFrequency ?? "monthly").slice(1)}: {convertMonthsToPaymentPeriods(loan.termMonths, loan.paybackFrequency ?? "monthly")}</span>
              </div>
            </div>
          </div>

          <div className={`p-3 rounded-lg ${loan.interestType === "simple" ? "bg-green-50" : "bg-blue-50"}`}>
            <div className="flex items-center space-x-2">
              <TrendingUp className={`h-4 w-4 ${loan.interestType === "simple" ? "text-green-600" : "text-blue-600"}`} />
              <span className={`text-sm font-medium ${loan.interestType === "simple" ? "text-green-800" : "text-blue-800"}`}>
                {loan.interestType === "simple" 
                  ? `Simple Interest Loan (${loan.termMonths} months)`
                  : `Amortized Loan (${loan.termMonths} months)`
                }
              </span>
            </div>
            {loan.interestType === "compound" && (
              <p className="text-xs text-blue-600 mt-1">
                Monthly Payment: {formatCurrency(parseFloat(loan.monthlyPayment || "0"))}
              </p>
            )}
            {loan.interestType === "simple" && (
              <p className="text-xs text-green-600 mt-1">
                Interest calculated using simple interest formula
              </p>
            )}
          </div>

          {loan.status !== "active" && (
            <div className="bg-gray-100 p-3 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-800 capitalize">
                  Status: {loan.status.replace("_", " ")}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}