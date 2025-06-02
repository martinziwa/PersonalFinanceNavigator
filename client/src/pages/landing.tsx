import { Button } from "@/components/ui/button";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="max-w-sm mx-auto bg-white min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center space-y-6">
        {/* App Logo/Icon */}
        <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mb-8">
          <span className="text-4xl text-white">💰</span>
        </div>

        {/* App Title */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Personal Finance Tracker
          </h1>
          <p className="text-gray-600 text-lg">
            Take control of your finances
          </p>
        </div>

        {/* Features */}
        <div className="space-y-4 py-8">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-green-600">📊</span>
            </div>
            <span className="text-gray-700">Track expenses and income</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-blue-600">🎯</span>
            </div>
            <span className="text-gray-700">Set and achieve savings goals</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-purple-600">💳</span>
            </div>
            <span className="text-gray-700">Manage budgets and loans</span>
          </div>
        </div>

        {/* Login Buttons */}
        <div className="space-y-3">
          <Button 
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl text-lg"
          >
            Get Started
          </Button>
          
          <Button 
            onClick={() => window.location.href = '/api/guest-login'}
            variant="outline"
            className="w-full border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-semibold py-4 rounded-xl text-lg"
          >
            Try as Guest
          </Button>
        </div>

        <p className="text-sm text-gray-500 mt-4">
          Secure login powered by Replit
        </p>
      </div>
    </div>
  );
}