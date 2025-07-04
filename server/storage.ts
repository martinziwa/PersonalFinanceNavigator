import {
  transactions,
  budgets,
  savingsGoals,
  loans,
  users,
  type Transaction,
  type InsertTransaction,
  type Budget,
  type InsertBudget,
  type SavingsGoal,
  type InsertSavingsGoal,
  type Loan,
  type InsertLoan,
  type User,
  type UpsertUser,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte } from "drizzle-orm";

export interface IStorage {
  // User operations (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Transactions
  getTransactions(userId: string): Promise<Transaction[]>;
  getTransactionsByCategory(userId: string, category: string): Promise<Transaction[]>;
  createTransaction(userId: string, transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(userId: string, id: number, transaction: Partial<InsertTransaction>): Promise<Transaction>;
  deleteTransaction(userId: string, id: number): Promise<void>;

  // Budgets
  getBudgets(userId: string): Promise<Budget[]>;
  getBudget(userId: string, id: number): Promise<Budget | undefined>;
  createBudget(userId: string, budget: InsertBudget): Promise<Budget>;
  updateBudget(userId: string, id: number, budget: Partial<Budget>): Promise<Budget>;
  deleteBudget(userId: string, id: number): Promise<void>;

  // Savings Goals
  getSavingsGoals(userId: string): Promise<SavingsGoal[]>;
  getSavingsGoal(userId: string, id: number): Promise<SavingsGoal | undefined>;
  createSavingsGoal(userId: string, goal: InsertSavingsGoal): Promise<SavingsGoal>;
  updateSavingsGoal(userId: string, id: number, goal: Partial<SavingsGoal>): Promise<SavingsGoal>;
  deleteSavingsGoal(userId: string, id: number): Promise<void>;

  // Loans
  getLoans(userId: string): Promise<Loan[]>;
  getLoan(userId: string, id: number): Promise<Loan | undefined>;
  createLoan(userId: string, loan: InsertLoan): Promise<Loan>;
  updateLoan(userId: string, id: number, loan: Partial<Loan>): Promise<Loan>;
  deleteLoan(userId: string, id: number): Promise<void>;
  calculateLoanInterest(userId: string, loan: Loan): Promise<{
    totalInterest: number;
    currentBalance: number;
    monthlyPayment: number;
    payoffDate: Date | null;
  }>;
  calculateLoanProgress(userId: string, loan: Loan): Promise<{
    principalProgress: number | null;
    interestProgress: number | null;
    totalPaid: number;
    principalPaid: number;
    interestPaid: number;
    currentBalance: number;
  }>;

  // Financial Summary
  getFinancialSummary(userId: string): Promise<{
    netWorth: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    totalSavings: number;
    totalDebt: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // Helper method to calculate amortized monthly payment with different compounding frequencies
  private calculateAmortizedPayment(principal: number, annualRate: number, termMonths: number, compoundFrequency: string = "monthly"): number {
    if (annualRate === 0) {
      // If no interest, simply divide principal by term
      return principal / termMonths;
    }
    
    // Get compounding periods per year
    const compoundingPeriodsPerYear = this.getCompoundingPeriodsPerYear(compoundFrequency);
    
    // Calculate effective monthly rate
    const annualRateDecimal = annualRate / 100;
    const effectiveAnnualRate = Math.pow(1 + (annualRateDecimal / compoundingPeriodsPerYear), compoundingPeriodsPerYear) - 1;
    const monthlyRate = Math.pow(1 + effectiveAnnualRate, 1/12) - 1;
    
    // Standard amortization formula with effective monthly rate
    const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
                   (Math.pow(1 + monthlyRate, termMonths) - 1);
    
    return payment;
  }

  // Helper method to get compounding periods per year
  private getCompoundingPeriodsPerYear(frequency: string): number {
    switch (frequency) {
      case "daily": return 365;
      case "weekly": return 52;
      case "biweekly": return 26;
      case "monthly": return 12;
      case "quarterly": return 4;
      case "semiannually": return 2;
      case "annually": return 1;
      default: return 12; // Default to monthly
    }
  }

  // Calculate principal progress for any loan type
  private async calculatePrincipalProgress(userId: string, loan: Loan): Promise<number> {
    const principal = parseFloat(loan.principal);
    
    if (loan.interestType === "simple") {
      // For simple interest, use payment-based calculation
      const repayments = await this.getLoanRepayments(userId, loan.id);
      const totalPaid = repayments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
      
      const annualRate = parseFloat(loan.interestRate) / 100;
      const termYears = (loan.termMonths || 12) / 12;
      const totalInterest = principal * annualRate * termYears;
      
      // For simple interest, payments go to interest first, then principal
      let principalPaid = 0;
      if (totalPaid > totalInterest) {
        principalPaid = totalPaid - totalInterest;
      }
      
      return Math.min((principalPaid / principal) * 100, 100);
    } else {
      // For compound interest, calculate based on time elapsed and amortization schedule
      const now = new Date();
      const startDate = new Date(loan.startDate);
      const termMonths = loan.termMonths || 12;
      const monthlyPayment = parseFloat(loan.monthlyPayment || "0");
      const annualRate = parseFloat(loan.interestRate) / 100;
      const monthlyRate = annualRate / 12;
      
      // Calculate months elapsed since loan start
      const monthsElapsed = Math.max(0, 
        (now.getFullYear() - startDate.getFullYear()) * 12 + 
        (now.getMonth() - startDate.getMonth())
      );
      
      // Don't exceed the loan term
      const effectiveMonthsElapsed = Math.min(monthsElapsed, termMonths);
      
      if (effectiveMonthsElapsed === 0 || monthlyPayment === 0) {
        return 0;
      }
      
      // Use standard amortization formula to calculate remaining balance
      if (monthlyRate === 0) {
        // No interest case
        const principalPaid = Math.min(effectiveMonthsElapsed * monthlyPayment, principal);
        return (principalPaid / principal) * 100;
      }
      
      // Standard amortization formula for remaining balance
      const remainingBalance = principal * Math.pow(1 + monthlyRate, effectiveMonthsElapsed) - 
        monthlyPayment * ((Math.pow(1 + monthlyRate, effectiveMonthsElapsed) - 1) / monthlyRate);
      
      const principalPaid = Math.max(0, principal - Math.max(0, remainingBalance));
      return Math.min((principalPaid / principal) * 100, 100);
    }
  }

  // Calculate dynamic current balance based on principal progress
  private async calculateDynamicBalance(userId: string, loan: Loan): Promise<number> {
    const principal = parseFloat(loan.principal);
    const principalProgress = await this.calculatePrincipalProgress(userId, loan);
    
    // Current balance = principal - (principal * progress percentage)
    return principal - (principal * (principalProgress / 100));
  }

  // User operations (IMPORTANT) these user operations are mandatory for Replit Auth.
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Transactions
  async getTransactions(userId: string): Promise<Transaction[]> {
    const result = await db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(transactions.date);
    return result.reverse();
  }

  async getTransactionsByCategory(userId: string, category: string): Promise<Transaction[]> {
    return await db.select().from(transactions).where(and(eq(transactions.userId, userId), eq(transactions.category, category)));
  }

  async createTransaction(userId: string, insertTransaction: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db
      .insert(transactions)
      .values({ ...insertTransaction, userId })
      .returning();

    // Loan repayment handling - balance is now calculated dynamically
    // No manual balance updates needed as currentBalance is computed from payments

    // Update budget spent amount if it's an expense or loan payment and within budget period
    if (transaction.type === "expense" || transaction.type === "loan_repayment") {
      const matchingBudgets = await db
        .select()
        .from(budgets)
        .where(
          and(
            eq(budgets.userId, userId),
            eq(budgets.category, transaction.category),
            lte(budgets.startDate, transaction.date),
            gte(budgets.endDate, transaction.date)
          )
        );

      for (const budget of matchingBudgets) {
        const newSpent = parseFloat(budget.spent) + parseFloat(transaction.amount);
        await db
          .update(budgets)
          .set({ spent: newSpent.toString() })
          .where(eq(budgets.id, budget.id));
      }
    }

    return transaction;
  }

  async updateTransaction(userId: string, id: number, updates: Partial<InsertTransaction>): Promise<Transaction> {
    const currentTransaction = await db.select().from(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
    if (!currentTransaction[0]) {
      throw new Error("Transaction not found");
    }

    const transaction = currentTransaction[0];

    // If this is a loan_received transaction, sync changes to the loan
    if (transaction.type === "loan_received" && transaction.loanId) {
      const loanUpdates: any = {};
      if (updates.description) loanUpdates.name = updates.description;
      if (updates.amount) {
        loanUpdates.principal = updates.amount;
        loanUpdates.currentBalance = updates.amount; // Update current balance to match new principal
      }
      if (updates.date) loanUpdates.startDate = updates.date;

      if (Object.keys(loanUpdates).length > 0) {
        console.log('Updating loan with:', loanUpdates, 'for loan ID:', transaction.loanId);
        await db
          .update(loans)
          .set(loanUpdates)
          .where(and(eq(loans.id, transaction.loanId), eq(loans.userId, userId)));
      }
    }

    const [updatedTransaction] = await db
      .update(transactions)
      .set(updates)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .returning();
    return updatedTransaction;
  }

  async deleteTransaction(userId: string, id: number): Promise<void> {
    const [transaction] = await db.select().from(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
    
    // If this is a loan_received transaction, delete the corresponding loan
    if (transaction && transaction.type === "loan_received" && transaction.loanId) {
      await db.delete(loans).where(and(eq(loans.id, transaction.loanId), eq(loans.userId, userId)));
    }

    // Loan repayment reversal handling - balance is now calculated dynamically
    // No manual balance updates needed as currentBalance is computed from payments

    if (transaction && (transaction.type === "expense" || transaction.type === "loan_repayment")) {
      // Update budget spent amount if within budget period
      const matchingBudgets = await db
        .select()
        .from(budgets)
        .where(
          and(
            eq(budgets.userId, userId),
            eq(budgets.category, transaction.category),
            lte(budgets.startDate, transaction.date),
            gte(budgets.endDate, transaction.date)
          )
        );

      for (const budget of matchingBudgets) {
        const newSpent = parseFloat(budget.spent) - parseFloat(transaction.amount);
        await db
          .update(budgets)
          .set({ spent: Math.max(0, newSpent).toString() })
          .where(eq(budgets.id, budget.id));
      }
    }
    
    await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  }

  // Budgets
  async getBudgets(userId: string): Promise<Budget[]> {
    return await db.select().from(budgets).where(eq(budgets.userId, userId));
  }

  async getBudget(userId: string, id: number): Promise<Budget | undefined> {
    const [budget] = await db.select().from(budgets).where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
    return budget || undefined;
  }

  async createBudget(userId: string, insertBudget: InsertBudget): Promise<Budget> {
    const [budget] = await db
      .insert(budgets)
      .values({ ...insertBudget, userId })
      .returning();
    return budget;
  }

  async updateBudget(userId: string, id: number, updates: Partial<Budget>): Promise<Budget> {
    const [updated] = await db
      .update(budgets)
      .set(updates)
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
      .returning();
    
    if (!updated) {
      throw new Error("Budget not found");
    }
    return updated;
  }

  async deleteBudget(userId: string, id: number): Promise<void> {
    await db.delete(budgets).where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
  }

  // Savings Goals
  async getSavingsGoals(userId: string): Promise<SavingsGoal[]> {
    return await db.select().from(savingsGoals).where(eq(savingsGoals.userId, userId));
  }

  async getSavingsGoal(userId: string, id: number): Promise<SavingsGoal | undefined> {
    const [goal] = await db.select().from(savingsGoals).where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)));
    return goal || undefined;
  }

  async createSavingsGoal(userId: string, insertGoal: InsertSavingsGoal): Promise<SavingsGoal> {
    const [goal] = await db
      .insert(savingsGoals)
      .values({ ...insertGoal, userId })
      .returning();
    return goal;
  }

  async updateSavingsGoal(userId: string, id: number, updates: Partial<SavingsGoal>): Promise<SavingsGoal> {
    const [updated] = await db
      .update(savingsGoals)
      .set(updates)
      .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)))
      .returning();
    
    if (!updated) {
      throw new Error("Savings goal not found");
    }
    return updated;
  }

  async deleteSavingsGoal(userId: string, id: number): Promise<void> {
    await db.delete(savingsGoals).where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)));
  }

  // Loans
  async getLoans(userId: string): Promise<Loan[]> {
    return await db.select().from(loans).where(eq(loans.userId, userId));
  }

  async getLoan(userId: string, id: number): Promise<Loan | undefined> {
    const [loan] = await db.select().from(loans).where(and(eq(loans.id, id), eq(loans.userId, userId)));
    return loan;
  }

  async createLoan(userId: string, insertLoan: InsertLoan): Promise<Loan> {
    let monthlyPayment = null;
    
    // Only calculate monthly payment for compound interest loans
    if (insertLoan.interestType === "compound") {
      monthlyPayment = this.calculateAmortizedPayment(
        parseFloat(insertLoan.principal),
        parseFloat(insertLoan.interestRate || "0"),
        insertLoan.termMonths,
        insertLoan.compoundFrequency || "monthly"
      ).toFixed(2);
    }

    const [loan] = await db
      .insert(loans)
      .values({ 
        ...insertLoan, 
        userId,
        monthlyPayment: monthlyPayment,
        compoundFrequency: insertLoan.interestType === "simple" ? null : insertLoan.compoundFrequency
      })
      .returning();

    // Create corresponding loan_received transaction
    await db
      .insert(transactions)
      .values({
        userId,
        amount: insertLoan.principal,
        description: insertLoan.name,
        category: "loan",
        type: "loan_received",
        date: insertLoan.startDate,
        time: null,
        loanId: loan.id
      });

    return loan;
  }

  async updateLoan(userId: string, id: number, updates: Partial<Loan>): Promise<Loan> {
    const currentLoan = await this.getLoan(userId, id);
    if (!currentLoan) {
      throw new Error("Loan not found");
    }

    // If key loan parameters are being updated, recalculate monthly payment
    if (updates.principal || updates.interestRate || updates.termMonths || updates.compoundFrequency || updates.interestType) {
      const principal = parseFloat(updates.principal || currentLoan.principal);
      const interestRate = parseFloat(updates.interestRate || currentLoan.interestRate);
      const termMonths = updates.termMonths || currentLoan.termMonths;
      const interestType = updates.interestType || currentLoan.interestType || "compound";
      
      if (interestType === "compound") {
        const compoundFrequency = updates.compoundFrequency || currentLoan.compoundFrequency || "monthly";
        const monthlyPayment = this.calculateAmortizedPayment(principal, interestRate, termMonths, compoundFrequency);
        updates.monthlyPayment = monthlyPayment.toFixed(2);
      } else {
        // Simple interest loans don't use monthly payments or compound frequency
        updates.monthlyPayment = null;
        updates.compoundFrequency = null;
      }
    }

    const [loan] = await db
      .update(loans)
      .set(updates)
      .where(and(eq(loans.id, id), eq(loans.userId, userId)))
      .returning();

    // Update corresponding loan_received transaction if relevant fields changed
    if (updates.name || updates.principal || updates.startDate) {
      const transactionUpdates: any = {};
      if (updates.name) transactionUpdates.description = updates.name;
      if (updates.principal) transactionUpdates.amount = updates.principal;
      if (updates.startDate) transactionUpdates.date = updates.startDate;

      console.log('Updating transaction with:', transactionUpdates, 'for loan ID:', id);
      await db
        .update(transactions)
        .set(transactionUpdates)
        .where(and(
          eq(transactions.loanId, id),
          eq(transactions.userId, userId),
          eq(transactions.type, "loan_received")
        ));
    }

    // Ensure currentBalance is updated when principal changes
    if (updates.principal && !updates.currentBalance) {
      updates.currentBalance = updates.principal;
    }

    return loan;
  }

  async deleteLoan(userId: string, id: number): Promise<void> {
    // Delete corresponding loan_received transaction first
    await db.delete(transactions).where(and(
      eq(transactions.loanId, id),
      eq(transactions.userId, userId),
      eq(transactions.type, "loan_received")
    ));
    
    await db.delete(loans).where(and(eq(loans.id, id), eq(loans.userId, userId)));
  }

  // Loan balance management for simple interest loans


  // Get loan repayment transactions for a specific loan
  async getLoanRepayments(userId: string, loanId: number): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(and(
        eq(transactions.userId, userId),
        eq(transactions.type, "loan_repayment"),
        eq(transactions.loanId, loanId)
      ))
      .orderBy(transactions.date);
  }

  async calculateLoanInterest(userId: string, loan: Loan): Promise<{
    totalInterest: number;
    currentBalance: number;
    monthlyPayment: number;
    payoffDate: Date | null;
  }> {
    const principal = parseFloat(loan.principal);
    const currentBalance = await this.calculateDynamicBalance(userId, loan);
    const annualRate = parseFloat(loan.interestRate) / 100;
    const termMonths = loan.termMonths || 12;
    
    if (loan.interestType === "simple") {
      // Simple interest calculation: I = P * R * T
      const termYears = termMonths / 12;
      const totalInterest = principal * annualRate * termYears;
      const totalAmount = principal + totalInterest;
      const suggestedMonthlyPayment = totalAmount / termMonths;
      
      return {
        totalInterest,
        currentBalance,
        monthlyPayment: suggestedMonthlyPayment, // Suggested payment for simple interest
        payoffDate: null, // Will be calculated based on actual payments
      };
    } else {
      // Compound interest (amortized loan) calculation
      const monthlyPayment = parseFloat(loan.monthlyPayment || "0");
      const now = new Date();
      
      let totalInterest = 0;
      let payoffDate: Date | null = null;
      
      // For amortized loans with monthly payments
      if (monthlyPayment > 0) {
        const monthlyRate = annualRate / 12;
        
        if (monthlyRate > 0) {
          // Calculate remaining months to pay off the loan
          const remainingMonths = Math.ceil(
            -Math.log(1 - (currentBalance * monthlyRate) / monthlyPayment) / 
            Math.log(1 + monthlyRate)
          );
          
          if (remainingMonths > 0 && isFinite(remainingMonths)) {
            // Calculate total interest that will be paid
            totalInterest = (monthlyPayment * remainingMonths) - currentBalance;
            
            // Calculate payoff date
            payoffDate = new Date(now);
            payoffDate.setMonth(payoffDate.getMonth() + remainingMonths);
          }
        } else {
          // No interest case
          const remainingMonths = Math.ceil(currentBalance / monthlyPayment);
          payoffDate = new Date(now);
          payoffDate.setMonth(payoffDate.getMonth() + remainingMonths);
        }
      }
      
      return {
        totalInterest: Math.max(0, totalInterest),
        currentBalance,
        monthlyPayment,
        payoffDate
      };
    }
  }

  // Calculate loan progress for any loan type with dynamic balance
  async calculateLoanProgress(userId: string, loan: Loan): Promise<{
    principalProgress: number | null;
    interestProgress: number | null;
    totalPaid: number;
    principalPaid: number;
    interestPaid: number;
    currentBalance: number;
  }> {
    // Get all loan repayment transactions
    const repayments = await this.getLoanRepayments(userId, loan.id);
    const totalPaid = repayments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

    const principal = parseFloat(loan.principal);
    let principalProgress = 0;
    let interestProgress = 0;
    let principalPaid = 0;
    let interestPaid = 0;

    if (loan.interestType === "simple") {
      const annualRate = parseFloat(loan.interestRate) / 100;
      const termYears = (loan.termMonths || 12) / 12;
      const totalInterest = principal * annualRate * termYears;

      // For simple interest, payments go to interest first, then principal
      if (totalPaid <= totalInterest) {
        // Still paying off interest
        interestPaid = totalPaid;
        principalPaid = 0;
      } else {
        // Interest fully paid, now paying principal
        interestPaid = totalInterest;
        principalPaid = totalPaid - totalInterest;
      }

      principalProgress = (principalPaid / principal) * 100;
      interestProgress = totalInterest > 0 ? (interestPaid / totalInterest) * 100 : 100;
    } else {
      // For compound interest, use time-based calculation
      principalProgress = await this.calculatePrincipalProgress(userId, loan);
      
      // For compound loans, calculate interest progress based on time elapsed
      const now = new Date();
      const startDate = new Date(loan.startDate);
      const termMonths = loan.termMonths || 12;
      const monthsElapsed = Math.max(0, 
        (now.getFullYear() - startDate.getFullYear()) * 12 + 
        (now.getMonth() - startDate.getMonth())
      );
      const effectiveMonthsElapsed = Math.min(monthsElapsed, termMonths);
      
      // Interest progress based on time elapsed
      interestProgress = termMonths > 0 ? (effectiveMonthsElapsed / termMonths) * 100 : 0;
      
      // Calculate principal and interest paid based on progress
      principalPaid = (principalProgress / 100) * principal;
      
      // For compound loans, interest paid is more complex, use simplified calculation
      const monthlyPayment = parseFloat(loan.monthlyPayment || "0");
      const totalScheduledPayments = monthlyPayment * effectiveMonthsElapsed;
      interestPaid = Math.max(0, totalScheduledPayments - principalPaid);
    }

    // Calculate dynamic current balance
    const currentBalance = await this.calculateDynamicBalance(userId, loan);

    return {
      principalProgress: Math.min(principalProgress, 100),
      interestProgress: Math.min(interestProgress, 100),
      totalPaid,
      principalPaid,
      interestPaid,
      currentBalance,
    };
  }

  // Financial Summary
  async getFinancialSummary(userId: string): Promise<{
    netWorth: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    totalSavings: number;
    totalDebt: number;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const monthlyTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, startOfMonth),
          lte(transactions.date, endOfMonth)
        )
      );

    const monthlyIncome = monthlyTransactions
      .filter(t => parseFloat(t.amount) > 0)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const monthlyExpenses = monthlyTransactions
      .filter(t => parseFloat(t.amount) < 0)
      .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

    // Get all user transactions for total calculations
    const allUserTransactions = await this.getTransactions(userId);

    // Get savings goals
    const userSavingsGoals = await this.getSavingsGoals(userId);
    let totalSavings = 0;
    
    for (const goal of userSavingsGoals) {
      // Calculate saved amount for each goal
      const goalTransactions = allUserTransactions.filter(transaction => 
        transaction.description?.toLowerCase().includes(goal.name.toLowerCase()) ||
        transaction.category === 'savings'
      );
      
      const goalSavings = goalTransactions
        .filter(t => parseFloat(t.amount) > 0)
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      totalSavings += goalSavings;
    }

    // Get loans for debt calculation
    const userLoans = await this.getLoans(userId);
    const totalDebt = userLoans.reduce((sum, loan) => {
      return sum + parseFloat(loan.currentBalance);
    }, 0);

    // Calculate net worth (simplified as savings - debt)
    const netWorth = totalSavings - totalDebt;

    return {
      netWorth,
      monthlyIncome,
      monthlyExpenses,
      totalSavings,
      totalDebt
    };
  }
}

export const storage = new DatabaseStorage();