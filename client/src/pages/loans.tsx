import { useState } from "react";
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
  currentBalance: z.string().min(1, "Current balance is required"),
  interestRate: z.string().regex(/^\d*\.?\d*$/, "Must be a valid number"),
  interestType: z.string().default("simple"),
  compoundFrequency: z.string().optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  monthlyPayment: z.string().optional(),
  loanType: z.string(),
  lender: z.string().optional(),
  description: z.string().optional(),
  status: z.string().default("active")
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
      currentBalance: "",
      interestRate: "0",
      interestType: "simple",
      compoundFrequency: "monthly",
      startDate: new Date().toISOString().split('T')[0],
      endDate: "",
      monthlyPayment: "",
      loanType: "personal",
      lender: "",
      description: "",
      status: "active"
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/loans", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });
      if (!response.ok) throw new Error("Failed to create loan");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
      setIsModalOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Loan created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create loan",
        variant: "destructive",
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/loans/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });
      if (!response.ok) throw new Error("Failed to update loan");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
      setIsModalOpen(false);
      setEditingLoan(null);
      form.reset();
      toast({
        title: "Success",
        description: "Loan updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update loan",
        variant: "destructive",
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/loans/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete loan");
      return response.json();
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
    }
  });

  const onSubmit = (data: LoanFormData) => {
    const submitData = {
      name: data.name,
      principal: data.principal,
      currentBalance: data.currentBalance,
      interestRate: data.interestRate,
      interestType: data.interestType || "simple",
      compoundFrequency: data.compoundFrequency || "monthly",
      startDate: data.startDate,
      endDate: data.endDate || null,
      monthlyPayment: data.monthlyPayment || null,
      loanType: data.loanType,
      lender: data.lender || null,
      description: data.description || null,
      status: data.status || "active",
    };

    if (editingLoan) {
      updateMutation.mutate({ id: editingLoan.id, data: submitData as any });
    } else {
      createMutation.mutate(submitData as any);
    }
  };

  const handleEdit = (loan: Loan) => {
    setEditingLoan(loan);
    form.reset({
      name: loan.name,
      principal: loan.principal,
      currentBalance: loan.currentBalance,
      interestRate: loan.interestRate,
      interestType: loan.interestType,
      compoundFrequency: loan.compoundFrequency || "monthly",
      startDate: new Date(loan.startDate).toISOString().split('T')[0],
      endDate: loan.endDate ? new Date(loan.endDate).toISOString().split('T')[0] : "",
      monthlyPayment: loan.monthlyPayment || "",
      loanType: loan.loanType,
      lender: loan.lender || "",
      description: loan.description || "",
      status: loan.status
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this loan?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleCreateNew = () => {
    setEditingLoan(null);
    form.reset();
    setIsModalOpen(true);
  };

  const calculateInterestDisplay = (loan: Loan) => {
    const principal = parseFloat(loan.principal);
    const currentBalance = parseFloat(loan.currentBalance);
    const annualRate = parseFloat(loan.interestRate) / 100;
    const startDate = new Date(loan.startDate);
    const now = new Date();
    
    // Calculate time elapsed in years
    const timeElapsed = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    
    let totalInterest = 0;
    let calculatedBalance = currentBalance;

    if (loan.interestType === "simple") {
      // Simple Interest: I = P * r * t
      totalInterest = principal * annualRate * timeElapsed;
      calculatedBalance = principal + totalInterest;
    } else {
      // Compound Interest: A = P(1 + r/n)^(nt)
      const frequency = loan.compoundFrequency === "daily" ? 365 : 
                       loan.compoundFrequency === "quarterly" ? 4 : 
                       loan.compoundFrequency === "annually" ? 1 : 12; // monthly default
      const compoundAmount = principal * Math.pow(1 + (annualRate / frequency), frequency * timeElapsed);
      totalInterest = compoundAmount - principal;
      calculatedBalance = compoundAmount;
    }

    return {
      totalInterest,
      calculatedBalance,
      paidAmount: principal - currentBalance
    };
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading loans...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Loans" subtitle="Track and manage your loans with interest calculations" />
      
      <main className="container mx-auto px-4 py-6 pb-20">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Your Loans</h1>
          <Button onClick={handleCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add Loan
          </Button>
        </div>

        {loans.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No loans yet</h3>
            <p className="text-gray-500 mb-6">Start tracking your loans and monitor interest calculations</p>
            <Button onClick={handleCreateNew} className="mx-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Loan
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {loans.map((loan: Loan) => {
              const { totalInterest, calculatedBalance, paidAmount } = calculateInterestDisplay(loan);
              const paymentProgress = parseFloat(loan.principal) > 0 ? 
                (paidAmount / parseFloat(loan.principal)) * 100 : 0;
              
              return (
                <Card key={loan.id} className="overflow-hidden">
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
                        <Button variant="outline" size="sm" onClick={() => handleEdit(loan)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(loan.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500">Principal</p>
                        <p className="font-semibold">{formatCurrency(parseFloat(loan.principal))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Current Balance</p>
                        <p className="font-semibold text-red-600">{formatCurrency(parseFloat(loan.currentBalance))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Interest Rate</p>
                        <p className="font-semibold">{loan.interestRate}% ({loan.interestType})</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Monthly Payment</p>
                        <p className="font-semibold">
                          {loan.monthlyPayment ? formatCurrency(parseFloat(loan.monthlyPayment)) : "Not set"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Interest Accrued: {formatCurrency(totalInterest)}</span>
                        <span className="text-gray-600">Paid: {formatCurrency(paidAmount)}</span>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Payment Progress</span>
                          <span>{paymentProgress.toFixed(1)}% paid off</span>
                        </div>
                        <ProgressBar 
                          percentage={Math.min(paymentProgress, 100)} 
                          color={paymentProgress > 75 ? 'bg-green-500' : paymentProgress > 50 ? 'bg-yellow-500' : 'bg-red-500'}
                        />
                      </div>

                      {loan.interestType === "compound" && (
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <TrendingUp className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">
                              Compound Interest ({loan.compoundFrequency})
                            </span>
                          </div>
                          <p className="text-xs text-blue-600 mt-1">
                            Current calculated balance: {formatCurrency(calculatedBalance)}
                          </p>
                        </div>
                      )}

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
            })}
          </div>
        )}

        {/* Loan Form Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingLoan ? "Edit Loan" : "Add New Loan"}
              </DialogTitle>
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
                          <Input placeholder="Car Loan, Mortgage, etc." {...field} />
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

                  <FormField
                    control={form.control}
                    name="currentBalance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Current Balance (MWK) *</FormLabel>
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
                        <FormLabel>Interest Rate (%)</FormLabel>
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
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
                          <FormLabel>Compound Frequency</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                              <SelectItem value="annually">Annually</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date *</FormLabel>
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

                  <FormField
                    control={form.control}
                    name="monthlyPayment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Payment (MWK)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                              <SelectValue />
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
                          placeholder="Additional details about this loan..."
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingLoan ? "Update Loan" : "Add Loan"}
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