import { pgTable, text, serial, integer, boolean, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  type: text("type").notNull(), // 'income' or 'expense'
  date: timestamp("date").defaultNow().notNull(),
});

export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  category: text("category").notNull().unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  spent: decimal("spent", { precision: 10, scale: 2 }).default("0").notNull(),
  period: text("period").default("monthly").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  icon: text("icon").notNull(),
});

export const savingsGoals = pgTable("savings_goals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  targetAmount: decimal("target_amount", { precision: 10, scale: 2 }).notNull(),
  currentAmount: decimal("current_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  deadline: timestamp("deadline"),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
});

export const loans = pgTable("loans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).notNull(),
  minPayment: decimal("min_payment", { precision: 10, scale: 2 }).notNull(),
  nextPaymentDate: timestamp("next_payment_date").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  date: true,
});

export const insertBudgetSchema = createInsertSchema(budgets).omit({
  id: true,
  spent: true,
});

export const insertSavingsGoalSchema = createInsertSchema(savingsGoals).omit({
  id: true,
  currentAmount: true,
});

export const insertLoanSchema = createInsertSchema(loans).omit({
  id: true,
});

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type Budget = typeof budgets.$inferSelect;

export type InsertSavingsGoal = z.infer<typeof insertSavingsGoalSchema>;
export type SavingsGoal = typeof savingsGoals.$inferSelect;

export type InsertLoan = z.infer<typeof insertLoanSchema>;
export type Loan = typeof loans.$inferSelect;
