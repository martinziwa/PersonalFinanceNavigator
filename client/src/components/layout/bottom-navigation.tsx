import { Link, useLocation } from "wouter";
import { Home, List, PieChart, Target, DollarSign, MoreHorizontal } from "lucide-react";

const navItems = [
  { path: "/", label: "Home", icon: Home },
  { path: "/transactions", label: "Transactions", icon: List },
  { path: "/budgets", label: "Budgets", icon: PieChart },
  { path: "/goals", label: "Goals", icon: Target },
  { path: "/loans", label: "Loans", icon: DollarSign },
  { path: "/other", label: "Other", icon: MoreHorizontal },
];

export default function BottomNavigation() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
      <div className="max-w-sm mx-auto px-4">
        <div className="flex items-center justify-around py-2">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link key={path} href={path}>
              <button
                className={`flex flex-col items-center py-2 px-3 ${
                  location === path ? "text-primary" : "text-gray-400"
                }`}
              >
                <Icon className="h-5 w-5 mb-1" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
