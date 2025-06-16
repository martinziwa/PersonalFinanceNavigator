import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Trash2, Filter, Plus, Edit2, Search } from "lucide-react";
import Header from "@/components/layout/header";
import BottomNavigation from "@/components/layout/bottom-navigation";
import TransactionModal from "@/components/modals/transaction-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTransactions } from "@/hooks/use-transactions";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";

export default function Transactions() {
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentFloatingDate, setCurrentFloatingDate] = useState<string>("");
  const scrollContainerRef = useRef<HTMLElement>(null);
  const dateHeaderRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  
  const { data: transactions = [], isLoading } = useTransactions();
  const { toast } = useToast();

  const deleteTransactionMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({
        title: "Success",
        description: "Transaction deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete transaction",
        variant: "destructive",
      });
    },
  });

  const openEditDialog = (transaction: any) => {
    setEditingTransaction(transaction);
    setIsTransactionModalOpen(true);
  };

  const closeModal = () => {
    setIsTransactionModalOpen(false);
    setEditingTransaction(null);
  };

  const filteredAndSortedTransactions = transactions
    .filter((transaction) => {
      if (categoryFilter !== "all" && transaction.category !== categoryFilter) return false;
      if (typeFilter !== "all" && transaction.type !== typeFilter) return false;
      
      // Search functionality - check category, type, and description
      if (searchQuery !== "") {
        const query = searchQuery.toLowerCase();
        const categoryMatch = transaction.category.toLowerCase().includes(query);
        const typeMatch = transaction.type.toLowerCase().includes(query);
        const descriptionMatch = transaction.description.toLowerCase().includes(query);
        
        if (!categoryMatch && !typeMatch && !descriptionMatch) return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case "date":
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case "amount":
          aValue = parseFloat(a.amount);
          bValue = parseFloat(b.amount);
          break;
        case "description":
          aValue = a.description.toLowerCase();
          bValue = b.description.toLowerCase();
          break;
        case "category":
          aValue = a.category.toLowerCase();
          bValue = b.category.toLowerCase();
          break;
        case "type":
          aValue = a.type.toLowerCase();
          bValue = b.type.toLowerCase();
          break;
        default:
          return 0;
      }
      
      if (sortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  // Calculate aggregate amounts
  const totalIncome = filteredAndSortedTransactions
    .filter(t => t.type === "income" || t.type === "savings_withdrawal" || t.type === "loan_received")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const totalExpenses = filteredAndSortedTransactions
    .filter(t => t.type === "expense" || t.type === "savings_deposit" || t.type === "loan_payment")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const netAmount = totalIncome - totalExpenses;



  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getCategoryIcon = (category: string, type: string) => {
    // Special icons for different transaction types
    if (type === "income") return "💰";
    if (type === "savings_deposit") return "🏦";
    if (type === "savings_withdrawal") return "🏧";
    if (type === "loan_received") return "📈";
    if (type === "loan_payment") return "📉";
    
    const icons: Record<string, string> = {
      food: "🍽️",
      transportation: "🚗",
      shopping: "🛍️",
      entertainment: "🎬",
      bills: "📄",
      healthcare: "🏥",
      education: "📚",
      savings: "💳",
      loan: "🏛️",
      other: "📝",
    };
    return icons[category] || "📝";
  };

  // Predefined categories
  const predefinedCategories = [
    { value: "food", label: "Food & Dining" },
    { value: "transportation", label: "Transportation" },
    { value: "shopping", label: "Shopping" },
    { value: "entertainment", label: "Entertainment" },
    { value: "bills", label: "Bills & Utilities" },
    { value: "healthcare", label: "Healthcare" },
    { value: "education", label: "Education" },
    { value: "income", label: "Income" },
    { value: "savings", label: "Savings Account" },
    { value: "loan", label: "Loan" },
    { value: "other", label: "Other" },
  ];

  // Get unique categories from existing transactions
  const uniqueCategories = new Set<string>();
  transactions.forEach(t => uniqueCategories.add(t.category));
  const existingCategories = Array.from(uniqueCategories);
  
  // Combine predefined and custom categories
  const allAvailableCategories = [
    ...predefinedCategories,
    ...existingCategories
      .filter(cat => !predefinedCategories.some(predef => predef.value === cat))
      .map(cat => ({ value: cat, label: cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ') }))
  ].sort((a, b) => a.label.localeCompare(b.label));

  const categories = [
    { value: "all", label: "All Categories" },
    ...allAvailableCategories
  ];

  // Group transactions by date for better visualization
  const groupTransactionsByDate = (transactions: any[]) => {
    const grouped: { [key: string]: any[] } = {};
    
    transactions.forEach(transaction => {
      const date = new Date(transaction.date);
      const dateKey = date.toDateString();
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(transaction);
    });
    
    return grouped;
  };

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  };

  const groupedTransactions = groupTransactionsByDate(filteredAndSortedTransactions);
  const sortedDateKeys = Object.keys(groupedTransactions).sort((a, b) => {
    return sortOrder === 'desc' 
      ? new Date(b).getTime() - new Date(a).getTime()
      : new Date(a).getTime() - new Date(b).getTime();
  });

  // Handle scroll to update floating date header
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollContainerRef.current || sortedDateKeys.length === 0) return;

      const containerRect = scrollContainerRef.current.getBoundingClientRect();
      const floatingHeaderTop = 80; // Position where floating header appears
      
      let newVisibleDate = sortedDateKeys[0]; // Default to first date
      
      console.log('Scroll detected, checking', sortedDateKeys.length, 'date sections');
      
      // Find the current visible date section
      for (let i = sortedDateKeys.length - 1; i >= 0; i--) {
        const dateKey = sortedDateKeys[i];
        const element = dateHeaderRefs.current[dateKey];
        
        if (element) {
          const rect = element.getBoundingClientRect();
          const relativeTop = rect.top - containerRect.top;
          
          console.log(`Date ${dateKey}: relativeTop = ${relativeTop}, threshold = ${floatingHeaderTop}`);
          
          // If this date header has passed the floating header position
          if (relativeTop <= floatingHeaderTop) {
            newVisibleDate = dateKey;
            console.log(`Setting visible date to: ${dateKey}`);
            break;
          }
        }
      }
      
      if (newVisibleDate !== currentFloatingDate) {
        console.log('Updating floating date from', currentFloatingDate, 'to', newVisibleDate);
        setCurrentFloatingDate(newVisibleDate);
      }
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
      // Set initial floating date
      handleScroll();
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [sortedDateKeys]);

  // Initialize floating date when data changes
  useEffect(() => {
    if (sortedDateKeys.length > 0) {
      setCurrentFloatingDate(sortedDateKeys[0]);
    }
  }, [sortedDateKeys]);

  return (
    <div className="max-w-sm mx-auto bg-white min-h-screen relative flex flex-col">
      <Header title="Transactions" subtitle="Track your finances" />
      
      <main ref={scrollContainerRef} className="flex-1 overflow-y-auto pb-20 space-y-4 pt-4" style={{ scrollBehavior: 'smooth' }}>
        {/* Transaction Summary */}
        {filteredAndSortedTransactions.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100 mx-4">
            <h3 className="font-semibold text-gray-900 mb-3">Transaction Summary</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-sm text-gray-500">Total Revenue</div>
                <div className="font-semibold text-green-600">
                  {formatCurrency(totalIncome)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-500">Total Expenditure</div>
                <div className="font-semibold text-red-600">
                  {formatCurrency(totalExpenses)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-500">Net</div>
                <div className={`font-semibold ${netAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(netAmount)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative mx-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search by category, type, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters and Sorting */}
        <div className="space-y-3 mx-4">
          <div className="flex space-x-3">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="income">💰 Income</SelectItem>
                <SelectItem value="expense">💸 Expense</SelectItem>
                <SelectItem value="savings_deposit">🏦 Savings Deposit</SelectItem>
                <SelectItem value="savings_withdrawal">🏧 Savings Withdrawal</SelectItem>
                <SelectItem value="loan_received">📈 Loan Received</SelectItem>
                <SelectItem value="loan_payment">📉 Loan Payment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex space-x-3">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="amount">Amount</SelectItem>
                <SelectItem value="description">Description</SelectItem>
                <SelectItem value="category">Category</SelectItem>
                <SelectItem value="type">Type</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascending</SelectItem>
                <SelectItem value="desc">Descending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Transactions List */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 animate-pulse">
                <div className="flex items-center space-x-3">
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
        ) : filteredAndSortedTransactions.length === 0 ? (
          <div className="bg-white rounded-xl p-8 border border-gray-100 text-center mx-4">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No transactions found</h3>
            <p className="text-gray-500 mb-4">
              {transactions.length === 0
                ? "Start tracking your finances by adding your first transaction"
                : "Try adjusting your filters or add a new transaction"
              }
            </p>
            <Button
              onClick={() => setIsTransactionModalOpen(true)}
              className="bg-primary text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </Button>
          </div>
        ) : (
          <div className="space-y-0 relative">
            {/* Floating Date Header */}
            {currentFloatingDate && (
              <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
                <div className="bg-gray-800 text-white px-4 py-2 rounded-full shadow-lg backdrop-blur-sm bg-opacity-90 text-sm font-medium">
                  {formatDateHeader(currentFloatingDate)}
                </div>
              </div>
            )}

            {sortedDateKeys.map((dateKey) => (
              <div key={dateKey} className="space-y-0">
                {/* Date Header */}
                <div 
                  ref={(el) => { dateHeaderRefs.current[dateKey] = el; }}
                  className="bg-gray-50 border-b border-gray-200 px-4 py-3 mx-0"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-gray-900 flex items-center">
                      <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                      {formatDateHeader(dateKey)}
                    </h3>
                    <div className="text-sm font-medium text-blue-600 bg-blue-100 px-3 py-1 rounded-full border border-blue-200">
                      {groupedTransactions[dateKey].length} transaction{groupedTransactions[dateKey].length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                {/* Transactions for this date */}
                <div className="space-y-3 px-4 pt-3 pb-6">
                  {groupedTransactions[dateKey].map((transaction) => (
                    <div key={transaction.id} className="bg-white rounded-xl p-4 border border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            transaction.type === "income" || transaction.type === "savings_withdrawal" || transaction.type === "loan_received"
                              ? "bg-green-100" : "bg-red-100"
                          }`}>
                            <span className="text-sm">{getCategoryIcon(transaction.category, transaction.type)}</span>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{transaction.description}</h3>
                            <p className="text-sm text-gray-500 capitalize">
                              {transaction.category.replace('_', ' ')} • {transaction.time || "12:00 AM"}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          <div className={`font-semibold ${
                            transaction.type === "income" || transaction.type === "savings_withdrawal" || transaction.type === "loan_received"
                              ? "text-green-600" : "text-red-600"
                          }`}>
                            {(transaction.type === "income" || transaction.type === "savings_withdrawal" || transaction.type === "loan_received") ? "+" : "-"}
                            {formatCurrency(parseFloat(transaction.amount))}
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(transaction)}
                            className="p-2 text-blue-600 hover:bg-blue-50"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteTransactionMutation.mutate(transaction.id)}
                            disabled={deleteTransactionMutation.isPending}
                            className="p-2 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <button
        onClick={() => setIsTransactionModalOpen(true)}
        className="fixed bottom-20 right-4 w-14 h-14 bg-primary rounded-full shadow-lg flex items-center justify-center z-20"
      >
        <Plus className="h-6 w-6 text-white" />
      </button>

      <BottomNavigation />
      
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={closeModal}
        editingTransaction={editingTransaction}
      />
    </div>
  );
}
