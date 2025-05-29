import { Link } from "wouter";
import { BarChart3, Settings, HelpCircle, Shield, CreditCard } from "lucide-react";
import Header from "@/components/layout/header";
import BottomNavigation from "@/components/layout/bottom-navigation";
import { Button } from "@/components/ui/button";

const menuItems = [
  {
    path: "/reports",
    label: "Reports",
    description: "View financial reports and analytics",
    icon: BarChart3,
    color: "bg-blue-100",
    iconColor: "text-blue-600"
  },
  {
    path: "/loans",
    label: "Loans",
    description: "Manage your loans and debt payments",
    icon: CreditCard,
    color: "bg-red-100",
    iconColor: "text-red-600"
  },
  {
    path: "/settings",
    label: "Settings",
    description: "Manage app preferences and account",
    icon: Settings,
    color: "bg-gray-100",
    iconColor: "text-gray-600",
    disabled: true
  },
  {
    path: "/help",
    label: "Help & Support",
    description: "Get help and contact support",
    icon: HelpCircle,
    color: "bg-green-100",
    iconColor: "text-green-600",
    disabled: true
  },
  {
    path: "/security",
    label: "Security",
    description: "Privacy settings and data security",
    icon: Shield,
    color: "bg-purple-100",
    iconColor: "text-purple-600",
    disabled: true
  }
];

export default function Other() {
  return (
    <div className="max-w-sm mx-auto bg-white min-h-screen relative">
      <Header title="More Options" subtitle="Additional features" />
      
      <div className="px-4 pb-20 pt-6 space-y-4">
        {menuItems.map((item) => {
          const content = (
            <div className={`bg-white rounded-xl p-4 border border-gray-100 ${
              item.disabled ? 'opacity-50' : 'hover:bg-gray-50'
            } transition-colors`}>
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${item.color}`}>
                  <item.icon className={`h-6 w-6 ${item.iconColor}`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{item.label}</h3>
                  <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                </div>
                {item.disabled && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                    Coming Soon
                  </span>
                )}
              </div>
            </div>
          );

          if (item.disabled) {
            return (
              <div key={item.path} className="cursor-not-allowed">
                {content}
              </div>
            );
          }

          return (
            <Link key={item.path} href={item.path}>
              <button className="w-full text-left">
                {content}
              </button>
            </Link>
          );
        })}
      </div>

      <BottomNavigation />
    </div>
  );
}