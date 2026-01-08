import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminLogin } from '@/services/adminService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, X, Eye, EyeOff } from 'lucide-react'; // Added Eye icons

export default function AdminSignup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // Toggle state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // 1. Password Strength Logic
  const requirements = useMemo(() => [
    { label: 'At least 8 characters', test: (pw: string) => pw.length >= 8 },
    { label: 'One uppercase letter', test: (pw: string) => /[A-Z]/.test(pw) },
    { label: 'One lowercase letter', test: (pw: string) => /[a-z]/.test(pw) },
    { label: 'One number', test: (pw: string) => /[0-9]/.test(pw) },
    { label: 'One special character (@$!%*?&)', test: (pw: string) => /[@$!%*?&]/.test(pw) },
  ], []);

  const strengthScore = requirements.filter(req => req.test(password)).length;
  
  const getStrengthColor = () => {
    if (strengthScore <= 2) return 'bg-red-500';
    if (strengthScore <= 4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const isPasswordValid = strengthScore === requirements.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length > 0 && !isPasswordValid) {
      setError('Please fulfill all password requirements');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      const response = await adminLogin(email, password);
      localStorage.setItem('adminToken', response.accessToken);
      localStorage.setItem('admin', JSON.stringify(response.admin));
      navigate('/admin/dashboard');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            Admin & Moderator Access
          </CardTitle>
          <CardDescription className="text-center">
            Sign in to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              {/* --- Show/Hide Toggle Container --- */}
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"} // Dynamic type
                  placeholder="••••••••"
                  className="pr-10" // Space for the icon
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {/* ----------------------------------- */}
              
              {/* Visual Strength Meter */}
              {password.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${getStrengthColor()}`} 
                      style={{ width: `${(strengthScore / requirements.length) * 100}%` }}
                    />
                  </div>
                  
                  {/* Real-time Checklist */}
                  <div className="grid grid-cols-1 gap-1">
                    {requirements.map((req, index) => {
                      const met = req.test(password);
                      return (
                        <div key={index} className={`flex items-center text-xs space-x-2 ${met ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                          {met ? <Check size={12} /> : <X size={12} />}
                          <span>{req.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || (password.length > 0 && !isPasswordValid)}
            >
              {loading ? 'Processing...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
