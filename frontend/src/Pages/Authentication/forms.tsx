import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useContext, useState, useEffect, useMemo, useRef } from 'react';
import { AuthContext } from '../../context/authContext';
import { Check, X, Eye, EyeOff, PartyPopper } from 'lucide-react';

// --- Shared Strength Meter with Animation & Toast ---
const PasswordStrengthMeter = ({ password }: { password: string }) => {
  const [showToast, setShowToast] = useState(false);
  const toastTimeout = useRef<NodeJS.Timeout | null>(null);

  const requirements = useMemo(() => [
    { label: 'At least 8 characters', test: (pw: string) => pw.length >= 8 },
    { label: 'One uppercase letter', test: (pw: string) => /[A-Z]/.test(pw) },
    { label: 'One lowercase letter', test: (pw: string) => /[a-z]/.test(pw) },
    { label: 'One number', test: (pw: string) => /[0-9]/.test(pw) },
    { label: 'One special character (@$!%*?&)', test: (pw: string) => /[@$!%*?&]/.test(pw) },
  ], []);

  const strengthScore = requirements.filter(req => req.test(password)).length;

  // Trigger Success Toast when score hits 5
  useEffect(() => {
    if (strengthScore === 5) {
      setShowToast(true);
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
      toastTimeout.current = setTimeout(() => setShowToast(false), 3000);
    } else {
      setShowToast(false);
    }
  }, [strengthScore]);

  const getStrengthColor = () => {
    if (strengthScore <= 2) return 'bg-red-500';
    if (strengthScore <= 4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (!password) return null;

  return (
    <div className="space-y-2 mt-2 mb-4 text-left relative">
      {/* Success Toast Notification */}
      {showToast && (
        <div className="absolute -top-10 left-0 right-0 flex justify-center animate-bounce">
          <div className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-md border border-green-200 flex items-center gap-1 shadow-sm">
            <PartyPopper size={12} /> Password Secure!
          </div>
        </div>
      )}

      {/* Progress Bar with Custom Animation Class */}
      <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div 
          className={`h-full strength-bar-transition ${getStrengthColor()}`} 
          style={{ width: `${(strengthScore / requirements.length) * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-1 gap-1">
        {requirements.map((req, index) => {
          const met = req.test(password);
          return (
            <div key={index} className={`flex items-center text-[10px] space-x-2 transition-colors duration-300 ${met ? 'text-green-600' : 'text-gray-400'}`}>
              {met ? <Check size={10} className="animate-in zoom-in" /> : <X size={10} />}
              <span>{req.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- LoginForm ---
interface LoginFormProps {
  startForgotPassword: () => void;
  infoMessage?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({ startForgotPassword, infoMessage }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const authContext = useContext(AuthContext);

  if (!authContext) throw new Error('LoginForm must be used within an AuthProvider');
  const { login, googleLogin, error, loading } = authContext;

  useEffect(() => {
    const google = window.google;
    if (!google?.accounts) return;
    google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: (res: any) => googleLogin(res.credential),
    });
    const btn = document.getElementById('googleSignInButton');
    if (btn) google.accounts.id.renderButton(btn, { theme: 'outline', size: 'large', text: 'signin_with', width: '300' });
  }, [googleLogin]);

  return (
    <form className="w-full" onSubmit={(e) => { e.preventDefault(); login(email, password); }}>
      {infoMessage && <p className="text-sm text-green-500 mb-2">{infoMessage}</p>}
      <Input type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="mb-2" required />
      <div className="relative mb-2 text-left">
        <Input
          type={passwordVisible ? "text" : "password"}
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="button" onClick={() => setPasswordVisible(!passwordVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
          {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      <p className="text-sm text-muted mb-4 text-left px-1">
        Forgot password? <span className="underline cursor-pointer font-medium" onClick={startForgotPassword}>Reset</span>
      </p>
      {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
      <Button type="submit" className="w-full mb-2" disabled={loading}>{loading ? 'Signing In...' : 'Sign In With Email'}</Button>
      <div id="googleSignInButton" className="flex justify-center w-full"></div>
    </form>
  );
};

// --- SignUpForm ---
interface SignUpFormProps {
  startOtpVerification: (email: string) => void;
}

export const SignUpForm: React.FC<SignUpFormProps> = ({ startOtpVerification }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const authContext = useContext(AuthContext);

  if (!authContext) throw new Error('SignUpForm error');
  const { signup, googleLogin, error, loading } = authContext;

  const isPasswordValid = password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password) && /[@$!%*?&]/.test(password);

  useEffect(() => {
    const google = window.google;
    if (!google?.accounts) return;
    google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: (res: any) => googleLogin(res.credential),
    });
    const btn = document.getElementById('googleSignUpButton');
    if (btn) google.accounts.id.renderButton(btn, { theme: 'outline', size: 'large', text: 'signup_with', width: '300' });
  }, [googleLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { authContext.handleError('Passwords do not match'); return; }
    await signup(email, password);
    startOtpVerification(email);
  };

  return (
    <form className="w-full" onSubmit={handleSubmit}>
      <Input type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="mb-2" required />
      <div className="relative mb-2">
        <Input
          type={passwordVisible ? "text" : "password"}
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="button" onClick={() => setPasswordVisible(!passwordVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
          {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      <PasswordStrengthMeter password={password} />
      <Input
        type={passwordVisible ? "text" : "password"}
        placeholder="confirm password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        className="mb-4"
        required
      />
      {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
      <Button type="submit" className="w-full mb-2" disabled={loading || (password.length > 0 && !isPasswordValid)}>
        {loading ? 'Creating Account...' : 'Sign Up With Email'}
      </Button>
      <div id="googleSignUpButton" className="flex justify-center w-full"></div>
    </form>
  );
};

// --- OTPVerificationForm ---
export const OTPVerificationForm = ({ email, handleOtpVerified }: { email: string; handleOtpVerified: () => void }) => {
  const [otp, setOtp] = useState('');
  const authContext = useContext(AuthContext);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await authContext?.verifyEmail(email, otp);
    handleOtpVerified();
  };
  return (
    <div className="w-full flex flex-col items-center">
      <h3 className="text-2xl font-medium my-4 text-center">Verify Email</h3>
      <p className="mb-4 text-sm text-muted-foreground">OTP sent to {email}</p>
      <form onSubmit={handleSubmit} className="w-full">
        <Input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Enter OTP" className="w-full mb-4 text-center" required />
        <Button type="submit" className="w-full" disabled={authContext?.loading}>Verify</Button>
      </form>
    </div>
  );
};

// --- ForgotPasswordForm ---
export const ForgotPasswordForm = ({ startResetPassword }: { startResetPassword: (email: string) => void }) => {
  const [email, setEmail] = useState('');
  const baseURL = import.meta.env.VITE_BASE_URL;
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${baseURL}/forgotPassword`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    startResetPassword(email);
  };
  return (
    <div className="w-full flex flex-col items-center">
      <h3 className="text-2xl font-medium my-4">Reset Password</h3>
      <form onSubmit={handleSubmit} className="w-full">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="w-full mb-4" required />
        <Button type="submit" className="w-full">Send Reset Code</Button>
      </form>
    </div>
  );
};

// --- ResetPasswordForm ---
export const ResetPasswordForm = ({ email, handlePasswordReset }: { email: string; handlePasswordReset: () => void }) => {
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const authContext = useContext(AuthContext);

  const isPasswordValid = newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) && /[0-9]/.test(newPassword) && /[@$!%*?&]/.test(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await authContext?.confirmForgotPassword(email, code, newPassword);
    await authContext?.login(email, newPassword);
    handlePasswordReset();
  };

  return (
    <div className="w-full flex flex-col items-center">
      <h3 className="text-2xl font-medium my-4">New Password</h3>
      <form onSubmit={handleSubmit} className="w-full text-left">
        <Input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Reset Code" className="mb-2" required />
        <div className="relative mb-2">
          <Input type={passwordVisible ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New Password" required />
          <button type="button" onClick={() => setPasswordVisible(!passwordVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
            {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <PasswordStrengthMeter password={newPassword} />
        <Input type={passwordVisible ? "text" : "password"} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="Confirm" className="mb-4" required />
        <Button type="submit" className="w-full" disabled={!isPasswordValid}>Reset Password</Button>
      </form>
    </div>
  );
};
