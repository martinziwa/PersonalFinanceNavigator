import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  icon: ReactNode;
  iconBg?: string;
  changeColor?: string;
}

export default function StatCard({
  title,
  value,
  change,
  icon,
  iconBg = "bg-gray-100",
  changeColor = "text-gray-500",
}: StatCardProps) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-600 text-sm">{title}</span>
        <div className={`w-6 h-6 ${iconBg} rounded flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <div className="text-xl font-semibold text-gray-900">{value}</div>
      {change && <div className={`text-xs ${changeColor}`}>{change}</div>}
    </div>
  );
}
