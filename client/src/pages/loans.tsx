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
  currentBalance: z.string().optional(),
  interestRate: z.string().regex(/^\d*\.?\d*$/, "Must be a valid number"),
  termYears: z.string().default("0"),
  termMonths: z.string().default("0"),
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
      termYears: "0",
      termMonths: "12",
      startDate: new Date().toISOString().split('T')[0],
      endDate: "",
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
    // Calculate total months from years and months
    const years = parseInt(data.termYears) || 0;
    const months = parseInt(data.termMonths) || 0;
    const totalMonths = (years * 12) + months;

    const submitData = {
      name: data.name,
      principal: data.principal,
      currentBalance: data.currentBalance || data.principal, // Use principal if current balance is empty
      interestRate: data.interestRate,
      termMonths: totalMonths,
      startDate: data.startDate,
      endDate: data.endDate || null,
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
    
    // Convert total months back to years and months for editing
    const totalMonths = loan.termMonths || 12;
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    
    form.reset({
      name: loan.name,
      principal: loan.principal,
      currentBalance: loan.currentBalance,
      interestRate: loan.interestRate,
      termYears: years.toString(),
      termMonths: months.toString(),
      startDate: new Date(loan.startDate).toISOString().split('T')[0],
      endDate: loan.endDate ? new Date(loan.endDate).toISOString().split('T')[0] : "",
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
    const monthlyPayment = parseFloat(loan.monthlyPayment || "0");
    const termMonths = loan.termMonths || 12;
    
    // For amortized loans, calculate total interest over the life of the loan
    let totalInterest = 0;
    
    if (monthlyPayment > 0) {
      totalInterest = (monthlyPayment * termMonths) - principal;
    }

    return {
      totalInterest: Math.max(0, totalInterest),
      calculatedBalance: currentBalance,
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
                        <p className="font-semibold">{loan.interestRate}% (Amortized)</p>
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

                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <TrendingUp className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">
                            Amortized Loan ({loan.termMonths} months)
                          </span>
                        </div>
                        <p className="text-xs text-blue-600 mt-1">
                          Monthly Payment: {formatCurrency(parseFloat(loan.monthlyPayment || "0"))}
                        </p>
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
                        <FormLabel>Current Balance (MWK)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="Leave empty to use principal amount" {...field} />
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
                                <Input type="number" placeholder="0" min="0" max="50" {...field} />
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
                                <Input type="number" placeholder="0" min="0" max="11" {...field} />
                                <p className="text-xs text-gray-500 text-center">Months</p>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="bg-blue-50 p-2 rounded-lg">
                      <p className="text-sm text-blue-700 text-center">
                        Total: {(() => {
                          const years = parseInt(form.watch("termYears")) || 0;
                          const months = parseInt(form.watch("termMonths")) || 0;
                          const total = (years * 12) + months;
                          return `${total} month${total !== 1 ? 's' : ''}`;
                        })()}
                      </p>
                    </div>
                  </div>
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