import { User } from "lucide-react";

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export default function Header({ title = "Personal Finance Navigator", subtitle = "Good morning" }: HeaderProps) {
  return (
    <header className="bg-white shadow-sm px-4 py-3 flex items-center justify-between relative z-10">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
          <i className="fas fa-chart-line text-white text-lg"></i>
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
      </div>
      <button className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
        <User className="h-5 w-5 text-gray-600" />
      </button>
    </header>
  );
}
