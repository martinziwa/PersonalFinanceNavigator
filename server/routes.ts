import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertTransactionSchema,
  insertBudgetSchema,
  insertSavingsGoalSchema,
  insertLoanSchema,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Transactions
  app.get("/api/transactions", async (_req, res) => {
    try {
      const transactions = await storage.getTransactions();
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.post("/api/transactions", async (req, res) => {
    try {
      const transaction = insertTransactionSchema.parse(req.body);
      const created = await storage.createTransaction(transaction);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ message: "Invalid transaction data" });
    }
  });

  app.delete("/api/transactions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTransaction(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete transaction" });
    }
  });

  // Budgets
  app.get("/api/budgets", async (_req, res) => {
    try {
      const budgets = await storage.getBudgets();
      res.json(budgets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch budgets" });
    }
  });

  app.post("/api/budgets", async (req, res) => {
    try {
      const budget = insertBudgetSchema.parse(req.body);
      const created = await storage.createBudget(budget);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ message: "Invalid budget data" });
    }
  });

  app.put("/api/budgets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const updated = await storage.updateBudget(id, updates);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ message: "Failed to update budget" });
    }
  });

  app.delete("/api/budgets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBudget(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete budget" });
    }
  });

  // Savings Goals
  app.get("/api/goals", async (_req, res) => {
    try {
      const goals = await storage.getSavingsGoals();
      res.json(goals);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch savings goals" });
    }
  });

  app.post("/api/goals", async (req, res) => {
    try {
      const goal = insertSavingsGoalSchema.parse(req.body);
      const created = await storage.createSavingsGoal(goal);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ message: "Invalid savings goal data" });
    }
  });

  app.put("/api/goals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const updated = await storage.updateSavingsGoal(id, updates);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ message: "Failed to update savings goal" });
    }
  });

  app.delete("/api/goals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSavingsGoal(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete savings goal" });
    }
  });

  // Loans
  app.get("/api/loans", async (_req, res) => {
    try {
      const loans = await storage.getLoans();
      res.json(loans);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch loans" });
    }
  });

  app.post("/api/loans", async (req, res) => {
    try {
      const loan = insertLoanSchema.parse(req.body);
      const created = await storage.createLoan(loan);
      res.status(201).json(created);
    } catch (error) {
      console.error("Loan validation error:", error);
      res.status(400).json({ message: "Invalid loan data", error: error.message });
    }
  });

  app.put("/api/loans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const updated = await storage.updateLoan(id, updates);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ message: "Failed to update loan" });
    }
  });

  app.delete("/api/loans/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteLoan(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete loan" });
    }
  });

  // Financial Summary
  app.get("/api/financial-summary", async (_req, res) => {
    try {
      const summary = await storage.getFinancialSummary();
      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch financial summary" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
