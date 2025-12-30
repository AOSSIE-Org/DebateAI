
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../../context/authContext';
import { Eye, EyeOff } from 'lucide-react';

interface LoginFormProps {
  startForgotPassword: () => void;
  infoMessage?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({ startForgotPassword, infoMessage }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const authContext = useContext(AuthContext);

  if (!authContext) {
    throw new Error('LoginForm must be used within an AuthProvider');
  }

  const { login, googleLogin, error, loading } = authContext;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Store remember me preference for session persistence
    if (rememberMe) {
      localStorage.setItem('rememberMe', 'true');
    } else {
      localStorage.removeItem('rememberMe');
    }
    await login(email, password);
  };

  const handleGoogleLogin = (response: { credential: string; select_by: string }) => {
    const idToken = response.credential;
    googleLogin(idToken);
  };

  useEffect(() => {
    const google = window.google;
    if (!google?.accounts) {
      return;
    }

    google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: handleGoogleLogin,
    });

    const buttonElement = document.getElementById('googleSignInButton');
    if (buttonElement) {
      google.accounts.id.renderButton(buttonElement, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        width: '100%',
      });
    }

    return () => {
      google.accounts.id.cancel();
    };
  }, []);

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
      {/* Password field with eye icon toggle */}
      <div className="relative mb-2">
        <Input
          type={passwordVisible ? "text" : "password"}
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setPasswordVisible(!passwordVisible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={passwordVisible ? "Hide password" : "Show password"}
        >
          {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {/* Remember me and Forgot password row */}
      <div className="flex justify-between items-center mb-4">
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          Remember me
        </label>
        <span
          className="text-sm text-primary hover:text-primary/80 underline cursor-pointer transition-colors"
          onClick={startForgotPassword}
        >
          Forgot Password?
        </span>
      </div>

      {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
      <Button type="submit" className="w-full mb-2" disabled={loading}>
        {loading ? 'Signing In...' : 'Sign In With Email'}
      </Button>
      <div id="googleSignInButton" className="w-full"></div>
    </form>
  );
};

interface SignUpFormProps {
  startOtpVerification: (email: string) => void;
}

export const SignUpForm: React.FC<SignUpFormProps> = ({ startOtpVerification }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const authContext = useContext(AuthContext);

  if (!authContext) {
    throw new Error('SignUpForm must be used within an AuthProvider');
  }

  const { signup, googleLogin, error, loading } = authContext;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      authContext.handleError('Passwords do not match');
      return;
    }

    await signup(email, password);
    startOtpVerification(email);
  };

  const handleGoogleLogin = (response: { credential: string; select_by: string }) => {
    const idToken = response.credential;
    googleLogin(idToken);
  };

  useEffect(() => {
    const google = window.google;
    if (!google?.accounts) {
      return;
    }

    google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: handleGoogleLogin,
    });

    const buttonElement = document.getElementById('googleSignUpButton');
    if (buttonElement) {
      google.accounts.id.renderButton(buttonElement, {
        theme: 'outline',
        size: 'large',
        text: 'signup_with',
        width: '100%',
      });
    }

    return () => {
      google.accounts.id.cancel();
    };
  }, []);

  return (
    <form className="w-full" onSubmit={handleSubmit}>
      <Input
        type="email"
        placeholder="name@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mb-2"
      />
      {/* Password field with eye icon toggle */}
      <div className="relative mb-2">
        <Input
          type={passwordVisible ? "text" : "password"}
          placeholder="Create a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setPasswordVisible(!passwordVisible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={passwordVisible ? "Hide password" : "Show password"}
        >
          {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {/* Confirm password field with eye icon toggle */}
      <div className="relative mb-4">
        <Input
          type={passwordVisible ? "text" : "password"}
          placeholder="Confirm your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setPasswordVisible(!passwordVisible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={passwordVisible ? "Hide password" : "Show password"}
        >
          {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
      <Button type="submit" className="w-full mb-2" disabled={loading}>
        {loading ? 'Creating Account...' : 'Sign Up With Email'}
      </Button>
      <div id="googleSignUpButton" className="w-full"></div>
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
  startResetPassword: (email: string) => void;
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
  const [passwordVisible, setPasswordVisible] = useState(false);
  const authContext = useContext(AuthContext);

  if (!authContext) {
    throw new Error('ResetPasswordForm must be used within an AuthProvider');
  }

  const { confirmForgotPassword, login, error, loading } = authContext;

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
      <h3 className="text-2xl font-medium my-4 text-foreground">Reset Your Password</h3>
      <form onSubmit={handleSubmit} className="w-full">
        <Input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter Code"
          className="w-full mb-2"
        />
        {/* New password field with eye icon */}
        <div className="relative mb-2">
          <Input
            type={passwordVisible ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New Password"
            className="w-full pr-10"
          />
          <button
            type="button"
            onClick={() => setPasswordVisible(!passwordVisible)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={passwordVisible ? "Hide password" : "Show password"}
          >
            {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {/* Confirm new password field with eye icon */}
        <div className="relative mb-4">
          <Input
            type={passwordVisible ? "text" : "password"}
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            placeholder="Confirm New Password"
            className="w-full pr-10"
          />
          <button
            type="button"
            onClick={() => setPasswordVisible(!passwordVisible)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={passwordVisible ? "Hide password" : "Show password"}
          >
            {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Resetting Password...' : 'Reset Password'}
        </Button>
      </form>
    </div>
  );
};
