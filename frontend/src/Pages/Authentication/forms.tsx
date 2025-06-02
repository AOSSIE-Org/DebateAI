import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../../context/authContext';

interface LoginFormProps {
  startForgotPassword: () => void;
  infoMessage?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({ startForgotPassword, infoMessage }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const authContext = useContext(AuthContext);

  if (!authContext) {
    throw new Error("LoginForm must be used within an AuthProvider");
  }

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError("Invalid email format");
      return false;
    }
    setEmailError("");
    return true;
  };

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return false;
    }
    setPasswordError("");
    return true;
  };

  const { login, googleLogin, error, loading } = authContext;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
  };

  const handleGoogleLogin = (response: { credential: string; select_by: string }) => {
    const idToken = response.credential;
    googleLogin(idToken);
  };

  useEffect(() => {
    const google = window.google;
    if (!google?.accounts) {
      console.warn('Google Sign-In script not loaded');
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
      {infoMessage && (
        <p className="text-sm text-green-500 mb-2">{infoMessage}</p>
      )}
      <Input
        type="email"
        placeholder="name@example.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          validateEmail(e.target.value);
        }}
        className="mb-2"
      />
      {emailError && <p className="text-sm text-red-500 mb-2">{emailError}</p>}
      <Input
        type={passwordVisible ? "text" : "password"}
        placeholder="password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          validatePassword(e.target.value);
        }}
        className="mb-1"
      />
      {passwordError && (
        <p className="text-sm text-red-500 mb-2">{passwordError}</p>
      )}
      <div className="w-full flex justify-start items-center pl-1">
        <div className="w-4">
          <Input
            type="checkbox"
            checked={passwordVisible}
            onChange={(e) => setPasswordVisible(e.target.checked)}
          />
        </div>
        <div className="pl-2">show password</div>
      </div>
      {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
      <p className="text-sm text-muted mb-4">
        Forgot your password?{" "}
        <span
          className="underline cursor-pointer"
          onClick={startForgotPassword}
        >
          Reset Password
        </span>
      </p>
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
    throw new Error("SignUpForm must be used within an AuthProvider");
  }

  const { signup, googleLogin, error, loading } = authContext;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      authContext.handleError("Passwords do not match");
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
      console.warn('Google Sign-In script not loaded');
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
      <Input
        type={passwordVisible ? "text" : "password"}
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mb-2"
      />
      <Input
        type={passwordVisible ? "text" : "password"}
        placeholder="confirm password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        className="mb-4"
      />
      <div className="w-full flex justify-start items-center pl-1">
        <div className="w-4">
          <Input
            type="checkbox"
            checked={passwordVisible}
            onChange={(e) => setPasswordVisible(e.target.checked)}
          />
        </div>
        <div className="pl-2">show password</div>
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

export const OTPVerificationForm: React.FC<OTPVerificationFormProps> = ({
  email,
  handleOtpVerified,
}) => {
  const [otp, setOtp] = useState("");
  const authContext = useContext(AuthContext);

  if (!authContext) {
    throw new Error("OTPVerificationForm must be used within an AuthProvider");
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
      <p className="mb-4">
        Enter the OTP sent to your email to complete the sign-up process.
      </p>
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
          {loading ? "Verifying..." : "Verify OTP"}
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
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const baseURL = import.meta.env.VITE_BASE_URL;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch(`${baseURL}/forgotPassword`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        setError("Failed to send reset password code. Please try again.");
        return;
      }

      startResetPassword(email);
    } catch {
      setError("An unexpected error occurred. Please try again later.");
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
    throw new Error("ResetPasswordForm must be used within an AuthProvider");
  }

  const { confirmForgotPassword, login, error, loading } = authContext;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmNewPassword) {
      authContext.handleError("Passwords do not match");
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
        <Input
          type={passwordVisible ? "text" : "password"}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New Password"
          className="w-full mb-2"
        />
        <Input
          type={passwordVisible ? "text" : "password"}
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
          placeholder="Confirm New Password"
          className="w-full mb-4"
        />
        <div className="w-full flex justify-start items-center pl-1">
          <div className="w-4">
            <Input
              type="checkbox"
              checked={passwordVisible}
              onChange={(e) => setPasswordVisible(e.target.checked)}
            />
          </div>
          <div className="pl-2">show password</div>
        </div>
        {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Resetting Password..." : "Reset Password"}
        </Button>
      </form>
    </div>
  );
};