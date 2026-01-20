import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useContext, useState, useEffect, useRef } from 'react';
import { AuthContext } from '../../context/authContext';
import { useCallback } from "react";

interface LoginFormProps {
  startForgotPassword: () => void;
  infoMessage?: string;
}

// Email autocomplete component
interface EmailInputWithSuggestionsProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const EmailInputWithSuggestions: React.FC<EmailInputWithSuggestionsProps> = ({
  value,
  onChange,
  placeholder = "name@example.com",
  className = ""
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const emailDomains = ['@gmail.com', '@yahoo.com', '@outlook.com', '@hotmail.com'];

  const getEmailSuggestions = (email: string) => {
    if (!email || email.includes('@')) return [];
    return emailDomains.map(domain => email + domain);
  };

  const suggestions = getEmailSuggestions(value);

  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    if (newValue && !newValue.includes('@')) {
      setShowSuggestions(true);
      setActiveSuggestionIndex(-1);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex(prev =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter' && activeSuggestionIndex >= 0) {
      e.preventDefault();
      handleSuggestionClick(suggestions[activeSuggestionIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <Input
        type="text"
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => value && !value.includes('@') && setShowSuggestions(true)}
        placeholder={placeholder}
        className={className}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-300 dark:border-white rounded-md shadow-lg max-h-48 overflow-auto">
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion}
              onClick={() => handleSuggestionClick(suggestion)}
              className={`px-4 py-2 cursor-pointer ${
                index === activeSuggestionIndex
                  ? 'bg-gray-100 dark:bg-slate-700'
                  : 'hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const LoginForm: React.FC<LoginFormProps> = ({ startForgotPassword, infoMessage }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const authContext = useContext(AuthContext);

  if (!authContext) {
    throw new Error('LoginForm must be used within an AuthProvider');
  }

  const { login, googleLogin, error, loading } = authContext;

  const [localError, setLocalError] = useState<string | null>(null);

  const MIN_PASSWORD_LENGTH = 8;

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    // Validate email
    if (!email.trim()) {
      setLocalError('Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      setLocalError('Please enter a valid email address');
      return;
    }

    // Validate password
    if (!password) {
      setLocalError('Please enter your password');
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setLocalError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    await login(email, password);
  };

  const handleGoogleLogin = useCallback(
    (response: { credential: string; select_by: string }) => {
      const idToken = response.credential;
      googleLogin(idToken);
    },
    [googleLogin]
  );

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
  }, [handleGoogleLogin]);

  return (
    <form className="w-full" onSubmit={handleSubmit}>
      {infoMessage && <p className="text-sm text-green-500 mb-2">{infoMessage}</p>}
      <EmailInputWithSuggestions
        value={email}
        onChange={setEmail}
        placeholder="name@example.com"
        className="mb-2 dark:border-white"
      />
      <Input
        type={passwordVisible ? "text" : "password"}
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mb-1 dark:border-white"
      />
      {localError && (
        <p className="text-red-500 text-sm mt-2 mb-2">
          {localError}
        </p>
      )}
      <div className='w-full flex justify-start items-center pl-1'>
        <div className='w-4'>
          <Input
            type='checkbox'
            className="dark:border-white"
            checked={passwordVisible}
            onChange={(e) => setPasswordVisible(e.target.checked)}
          />
        </div>
        <div className='pl-2'>show password</div>
      </div>
      {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
      <p className="text-sm text-muted-foreground dark:text-white mb-4">
        Forgot your password?{' '}
        <span className="underline cursor-pointer" onClick={startForgotPassword}>
          Reset Password
        </span>
      </p>
      <Button type="submit" className="w-full mb-2 border dark:border-white" disabled={loading}>
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

  const [localError, setLocalError] = useState<string | null>(null);

  const MIN_PASSWORD_LENGTH = 8;

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    // Validate email
    if (!email.trim()) {
      setLocalError('Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      setLocalError('Please enter a valid email address');
      return;
    }

    // Validate password
    if (!password) {
      setLocalError('Please enter a password');
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setLocalError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    // Validate confirm password
    if (!confirmPassword) {
      setLocalError('Please confirm your password');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    await signup(email, password);
    startOtpVerification(email);
  };

  const handleGoogleLogin = useCallback(
    (response: { credential: string; select_by: string }) => {
      const idToken = response.credential;
      googleLogin(idToken);
    },
    [googleLogin]
  );

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
  }, [handleGoogleLogin]);

  return (
    <form className="w-full" onSubmit={handleSubmit}>
      <EmailInputWithSuggestions
        value={email}
        onChange={setEmail}
        placeholder="name@example.com"
        className="mb-2 dark:border-white"
      />
      <Input
        type={passwordVisible ? "text" : "password"}
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mb-2 dark:border-white"
      />
      <Input
        type={passwordVisible ? "text" : "password"}
        placeholder="confirm password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        className="mb-4 dark:border-white"
      />
      <div className='w-full flex justify-start items-center pl-1'>
        <div className='w-4'>
          <Input
            type='checkbox'
            className="dark:border-white"
            checked={passwordVisible}
            onChange={(e) => setPasswordVisible(e.target.checked)}
          />
        </div>
        <div className='pl-2'>show password</div>
      </div>
      {localError && <p className="text-sm text-red-500 mb-2">{localError}</p>}
      {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
      <Button type="submit" className="w-full mb-2 border dark:border-white" disabled={loading}>
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
          className="w-full mb-4 dark:border-white"
        />
        {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
        <Button type="submit" className="w-full border dark:border-white" disabled={loading}>
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
        <EmailInputWithSuggestions
          value={email}
          onChange={setEmail}
          placeholder="name@example.com"
          className="w-full mb-4 dark:border-white"
        />
        {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
        <Button type="submit" className="w-full border dark:border-white">
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
      <h3 className="text-2xl font-medium my-4">Reset Your Password</h3>
      <form onSubmit={handleSubmit} className="w-full">
        <Input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter Code"
          className="w-full mb-2 border dark:border-white"
        />
        <Input
          type={passwordVisible ? "text" : "password"}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New Password"
          className="w-full mb-2 dark:border-white"
        />
        <Input
          type={passwordVisible ? "text" : "password"}
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
          placeholder="Confirm New Password"
          className="w-full mb-4 dark:border-white"
        />
        <div className='w-full flex justify-start items-center pl-1'>
          <div className='w-4'>
            <Input
              type='checkbox'
              className="dark:border-white"
              checked={passwordVisible}
              onChange={(e) => setPasswordVisible(e.target.checked)}
            />
          </div>
          <div className='pl-2'>show password</div>
        </div>
        {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
        <Button type="submit" className="w-full border dark:border-white" disabled={loading}>
          {loading ? 'Resetting Password...' : 'Reset Password'}
        </Button>
      </form>
    </div>
  );
};