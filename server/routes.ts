import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  insertTransactionSchema,
  insertBudgetSchema,
  insertSavingsGoalSchema,
  insertLoanSchema,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Guest login route
  app.get('/api/guest-login', (req: any, res) => {
    // Create a guest session
    const guestUser = {
      claims: {
        sub: `guest-${Date.now()}`,
        email: null,
        first_name: "Guest",
        last_name: "User",
        profile_image_url: null
      },
      access_token: "guest-token",
      refresh_token: null,
      expires_at: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    };
    
    req.login(guestUser, (err: any) => {
      if (err) {
        return res.status(500).json({ message: "Failed to create guest session" });
      }
      res.redirect('/');
    });
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user && userId.startsWith('guest-')) {
        // Create guest user on first access
        const guestUser = await storage.upsertUser({
          id: userId,
          email: null,
          firstName: "Guest",
          lastName: "User",
          profileImageUrl: null
        });
        return res.json(guestUser);
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Transactions
  app.get("/api/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const transactions = await storage.getTransactions(userId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.post("/api/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const transaction = insertTransactionSchema.parse(req.body);
      const created = await storage.createTransaction(userId, transaction);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ message: "Invalid transaction data" });
    }
  });

  app.put("/api/transactions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const updates = req.body;
      console.log("Update request:", { userId, id, updates });
      
      // Validate the update data
      const validatedUpdates = insertTransactionSchema.partial().parse(updates);
      console.log("Validated updates:", validatedUpdates);
      
      const updated = await storage.updateTransaction(userId, id, validatedUpdates);
      res.json(updated);
    } catch (error) {
      console.error("Transaction update error:", error);
      res.status(400).json({ message: "Failed to update transaction", error: error.message });
    }
  });

  app.delete("/api/transactions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      await storage.deleteTransaction(userId, id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete transaction" });
    }
  });

  // Budgets
  app.get("/api/budgets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const budgets = await storage.getBudgets(userId);
      res.json(budgets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch budgets" });
    }
  });

  app.post("/api/budgets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const budget = insertBudgetSchema.parse(req.body);
      const created = await storage.createBudget(userId, budget);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ message: "Invalid budget data" });
    }
  });

  app.put("/api/budgets/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const updates = req.body;
      const updated = await storage.updateBudget(userId, id, updates);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ message: "Failed to update budget" });
    }
  });

  app.delete("/api/budgets/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      await storage.deleteBudget(userId, id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete budget" });
    }
  });

  // Savings Goals
  app.get("/api/goals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const goals = await storage.getSavingsGoals(userId);
      res.json(goals);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch savings goals" });
    }
  });

  app.post("/api/goals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const goal = insertSavingsGoalSchema.parse(req.body);
      const created = await storage.createSavingsGoal(userId, goal);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ message: "Invalid savings goal data" });
    }
  });

  app.put("/api/goals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const updates = req.body;
      const updated = await storage.updateSavingsGoal(userId, id, updates);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ message: "Failed to update savings goal" });
    }
  });

  app.delete("/api/goals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      await storage.deleteSavingsGoal(userId, id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete savings goal" });
    }
  });

  // Loans
  app.get("/api/loans", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const loans = await storage.getLoans(userId);
      res.json(loans);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch loans" });
    }
  });

  app.post("/api/loans", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const loan = insertLoanSchema.parse(req.body);
      const created = await storage.createLoan(userId, loan);
      res.status(201).json(created);
    } catch (error) {
      console.error("Loan validation error:", error);
      res.status(400).json({ message: "Invalid loan data", error: error.message });
    }
  });

  app.put("/api/loans/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const updates = req.body;
      const updated = await storage.updateLoan(userId, id, updates);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ message: "Failed to update loan" });
    }
  });

  app.delete("/api/loans/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      await storage.deleteLoan(userId, id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete loan" });
    }
  });

  // Financial Summary
  app.get("/api/financial-summary", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const summary = await storage.getFinancialSummary(userId);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch financial summary" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
