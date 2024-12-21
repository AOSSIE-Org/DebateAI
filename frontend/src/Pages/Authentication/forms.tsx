import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useState } from 'react';

let baseURL = import.meta.env.VITE_BASE_URL


interface LoginFormProps {
  startForgotPassword: () => void;
  infoMessage?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({ startForgotPassword, infoMessage }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const baseURL = import.meta.env.VITE_BASE_URL;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch(`${baseURL}/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.message || 'Failed to sign in. Please try again.');
        return;
      }

      // Handle successful login
    } catch {
      setError('An unexpected error occurred. Please try again later.');
    }
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
      <Input
        type="password"
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mb-1"
      />
      {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
      <p className="text-sm text-muted mb-4">
        Forgot your password?{' '}
        <span className="underline cursor-pointer" onClick={startForgotPassword}>
          Reset Password
        </span>
      </p>
      <Button type="submit" className="w-full">
        Sign In With Email
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
  const [error, setError] = useState('');

  const baseURL = import.meta.env.VITE_BASE_URL;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      const response = await fetch(`${baseURL}/signup`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.message || 'Failed to sign up. Please try again.');
        return;
      }

      // Start OTP verification phase
      startOtpVerification(email);
    } catch {
      setError('An unexpected error occurred. Please try again later.');
    }
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
      <Input
        type="password"
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mb-2"
      />
      <Input
        type="password"
        placeholder="confirm password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        className="mb-4"
      />
      {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
      <Button type="submit" className="w-full">
        Sign Up With Email
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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const baseURL = import.meta.env.VITE_BASE_URL;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${baseURL}/verifyEmail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, confirmationCode: otp }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.message || 'Failed to verify OTP. Please try again.');
        setLoading(false);
        return;
      }

      // OTP verified successfully
      handleOtpVerified();
    } catch {
      setError('An unexpected error occurred. Please try again later.');
      setLoading(false);
    }
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

export const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({
  email,
  handlePasswordReset,
}) => {
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const baseURL = import.meta.env.VITE_BASE_URL;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${baseURL}/confirmForgotPassword`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          code,
          newPassword,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.message || 'Failed to reset password. Please try again.');
        setLoading(false);
        return;
      }

      // Password reset successfully
      handlePasswordReset();
    } catch {
      setError('An unexpected error occurred. Please try again later.');
      setLoading(false);
    }
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
        <Input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New Password"
          className="w-full mb-2"
        />
        <Input
          type="password"
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
          placeholder="Confirm New Password"
          className="w-full mb-4"
        />
        {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Resetting Password...' : 'Reset Password'}
        </Button>
      </form>
    </div>
  );
};