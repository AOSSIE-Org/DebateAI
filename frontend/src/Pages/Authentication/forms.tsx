import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useContext, useState } from 'react';
import { AuthContext } from '../../context/authContext'; // Adjust import path
import PasswordInput  from '@/components/PasswordInput';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface LoginFormProps {
  startForgotPassword: () => void;
  infoMessage?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({ startForgotPassword, infoMessage }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const authContext = useContext(AuthContext);
  const [checked, setChecked] = useState(false);

  if (!authContext) {
    throw new Error('LoginForm must be used within an AuthProvider');
  }

  const { login,  loading } = authContext;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
  };

  return (
    <form className="w-full" onSubmit={handleSubmit}>
      {infoMessage && <p className="text-sm text-green-500 mb-2">{infoMessage}</p>}
      <Input
        type="email"
        placeholder="name@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mb-2"
      />
      <div className="space-y-2">
        <PasswordInput
          id="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className='flex items-center justify-between py-4 gap-2'>
        <div className='flex items-center ml-1 gap-2'>
          <Checkbox
            id="remember"
            checked={checked}
            onCheckedChange={(checked) => setChecked(checked === true)}
            className='w-3 h-3 border border-primary rounded-full focus:ring-2 focus:ring-primary'
          />
          <Label htmlFor="remember" className="text-xs text-muted text-muted-foreground">
            Remember me
          </Label>
        </div>

        <div className='flex mr-1 gap-2'>
          <p className="text-xs text-muted text-muted-foreground cursor-pointer hover:text-primary" onClick={startForgotPassword}>Forgot Password?</p>
        </div>

      </div>
      
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Signing In...' : 'Sign In With Email'}
      </Button>
    </form>
  );
};


interface SignUpFormProps {
  startOtpVerification: (email: string) => void;
}

export const SignUpForm: React.FC<SignUpFormProps> = ({ startOtpVerification }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const authContext = useContext(AuthContext);

  if (!authContext) {
    throw new Error('SignUpForm must be used within an AuthProvider');
  }

  const { signup, loading } = authContext;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      authContext.handleError('Passwords do not match');
      return;
    }

    await signup(email, password);
    startOtpVerification(email);
  };

  return (
    <form className="w-full" onSubmit={handleSubmit}>
      <Input
        type="email"
        placeholder="name@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mb-2"
      />
      <div className="space-y-2 mb-2">
        <PasswordInput
          id="password"
          placeholder="Create a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2 mb-6">
        <PasswordInput
          id="confirmPassword"
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Creating Account...' : 'Sign Up With Email'}
      </Button>
    </form>
  );
};

interface OTPVerificationFormProps {
  email: string;
  handleOtpVerified: () => void;
}

export const OTPVerificationForm: React.FC<OTPVerificationFormProps> = ({ email, handleOtpVerified }) => {
  const [otp, setOtp] = useState('');
  const authContext = useContext(AuthContext);

  if (!authContext) {
    throw new Error('OTPVerificationForm must be used within an AuthProvider');
  }

  const { verifyEmail, error, loading } = authContext;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await verifyEmail(email, otp);
    handleOtpVerified();
  };

  return (
    <div className="w-full flex flex-col items-center">
      <h3 className="text-2xl font-medium my-4">Verify Your Email</h3>
      <p className="mb-4">Enter the OTP sent to your email to complete the sign-up process.</p>
      <form onSubmit={handleSubmit} className="w-full">
        <Input
          type="text"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          placeholder="Enter OTP"
          className="w-full mb-4"
        />
        {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Verifying...' : 'Verify OTP'}
        </Button>
      </form>
    </div>
  );
};


interface ForgotPasswordFormProps {
  startResetPassword: (email: string) => void; // Accept the new prop
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  startResetPassword,
}) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const baseURL = import.meta.env.VITE_BASE_URL;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch(`${baseURL}/forgotPassword`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        setError('Failed to send reset password code. Please try again.');
        return;
      }

      // Move to the ResetPasswordForm
      startResetPassword(email);
    } catch {
      setError('An unexpected error occurred. Please try again later.');
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      <h3 className="text-2xl font-medium my-4">Reset Password</h3>
      <p className="mb-4">Enter your email to receive a password reset code.</p>
      <form onSubmit={handleSubmit} className="w-full">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          className="w-full mb-4"
        />
        {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
        <Button type="submit" className="w-full">
          Send Reset Code
        </Button>
      </form>
    </div>
  );
};


interface ResetPasswordFormProps {
  email: string;
  handlePasswordReset: () => void;
}

export const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({ email, handlePasswordReset }) => {
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const authContext = useContext(AuthContext);

  if (!authContext) {
    throw new Error('ResetPasswordForm must be used within an AuthProvider');
  }

  const { confirmForgotPassword, login, loading } = authContext;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmNewPassword) {
      authContext.handleError('Passwords do not match');
      return;
    }

    await confirmForgotPassword(email, code, newPassword);
    await login(email, newPassword);
    handlePasswordReset();
  };

  return (
    <div className="w-full flex flex-col items-center">
      <h3 className="text-2xl font-medium my-4">Reset Your Password</h3>
      <form onSubmit={handleSubmit} className="w-full">
        <Input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter Code"
          className="w-full mb-2"
        />
        <div className="space-y-2">
          <PasswordInput
            id="newPassword"
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}

          />
        </div>
        <div className="space-y-2">
          <PasswordInput
            id="confirmNewPassword"
            placeholder="Confirm new password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Resetting Password...' : 'Reset Password'}
        </Button>
      </form>
    </div>
  );
};