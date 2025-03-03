import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useContext, useState } from 'react';
import { AuthContext } from '../../context/authContext'; // Adjust import path

// Loading Spinner Component
const LoadingSpinner = () => (
  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
);

// Main Container for the Page
const AuthPageContainer = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen flex">
    {/* Left Side: Visual Section */}
    <div className="hidden lg:block w-1/2 bg-gradient-to-br from-blue-600 to-purple-600">
      <div className="h-full flex items-center justify-center p-12">
        <div className="text-white text-center">
          <h1 className="text-5xl font-bold mb-4">Welcome Back</h1>
          <p className="text-lg">Your journey starts here. Sign in or create an account to get started.</p>
        </div>
      </div>
    </div>

    {/* Right Side: Form Section */}
    <div className="w-full lg:w-1/2 bg-gray-50 dark:bg-gray-400 flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  </div>
);

// Reusable Form Input Component
const FormInput = ({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
}) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
    </label>
    <Input
      type={type}
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="mt-1 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
    />
  </div>
);

// Reusable Form Button Component
const FormButton = ({
  loading,
  children,
}: {
  loading: boolean;
  children: React.ReactNode;
}) => (
  <Button
    type="submit"
    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-all transform hover:scale-105"
    disabled={loading}
  >
    {loading ? <LoadingSpinner /> : children}
  </Button>
);

// Error Display Component
const ErrorMessage = ({ error }: { error: string | null }) => (
  error && <p className="text-sm text-red-500 mb-4">{error}</p>
);

// Login Form
interface LoginFormProps {
  startForgotPassword: () => void;
  infoMessage?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({ startForgotPassword, infoMessage }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false)
  const authContext = useContext(AuthContext);

  if (!authContext) {
    throw new Error('LoginForm must be used within an AuthProvider');
  }

  const { login, error, loading } = authContext;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {infoMessage && <p className="text-sm text-green-500 mb-4">{infoMessage}</p>}
      <FormInput
        id="email"
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="name@example.com"
      />
      <Input
        type={passwordVisible ? "text" : "password"}
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="password"
      />
      <div className='w-full flex justify-start items-center pl-1'>
        <div className='w-4'>
          <Input
            type='checkbox'
            checked={passwordVisible}
            onChange={(e) => setPasswordVisible(e.target.checked)}
          />
        </div>
        <div className='pl-2'>show password</div>
      </div>
      {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
      <p className="text-sm text-muted mb-4">
        Forgot your password?{' '}
        <span className="underline cursor-pointer" onClick={startForgotPassword}>
          Reset Password
        </span>
      </p>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Signing In...' : 'Sign In With Email'}
      </Button>
    </form>
  );
};

// SignUp Form
interface SignUpFormProps {
  startOtpVerification: (email: string) => void;
}

export const SignUpForm: React.FC<SignUpFormProps> = ({ startOtpVerification }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('');
  const authContext = useContext(AuthContext);

  if (!authContext) {
    throw new Error('SignUpForm must be used within an AuthProvider');
  }

  const { signup, error, loading } = authContext;

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
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormInput
        id="email"
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="name@example.com"
      />
      <Input
        type={passwordVisible ? "text" : "password"}
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="password"
      />
      <Input
        type={passwordVisible ? "text" : "password"}
        placeholder="confirm password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="confirm password"
      />
      <div className='w-full flex justify-start items-center pl-1'>
        <div className='w-4'>
          <Input
            type='checkbox'
            checked={passwordVisible}
            onChange={(e) => setPasswordVisible(e.target.checked)}
          />
        </div>
        <div className='pl-2'>show password</div>
      </div>
      {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Creating Account...' : 'Sign Up With Email'}
      </Button>
    </form>
  );
};

// OTP Verification Form
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
    <div className="space-y-6">
      <h3 className="text-2xl font-medium text-gray-900 dark:text-white mb-4">Verify Your Email</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">Enter the OTP sent to your email to complete the sign-up process.</p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <FormInput
          id="otp"
          label="OTP"
          type="text"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          placeholder="Enter OTP"
        />
        <ErrorMessage error={error} />
        <FormButton loading={loading}>Verify OTP</FormButton>
      </form>
    </div>
  );
};

// Forgot Password Form
interface ForgotPasswordFormProps {
  startResetPassword: (email: string) => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ startResetPassword }) => {
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
    <div className="space-y-6">
      <h3 className="text-2xl font-medium text-gray-900 dark:text-white mb-4">Reset Password</h3>
      <p className="text-gray-600 dark:text-gray-400 mb-6">Enter your email to receive a password reset code.</p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <FormInput
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
        />
        <ErrorMessage error={error} />
        <FormButton loading={false}>Send Reset Code</FormButton>
      </form>
    </div>
  );
};

// Reset Password Form
interface ResetPasswordFormProps {
  email: string;
  handlePasswordReset: () => void;
}

export const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({ email, handlePasswordReset }) => {
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false)
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
    <div className="space-y-6">
      <h3 className="text-2xl font-medium text-gray-900 dark:text-white mb-4">Reset Your Password</h3>
      <form onSubmit={handleSubmit} className="space-y-6">
        <FormInput
          id="code"
          label="Reset Code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter Code"
        />
        <Input
          type={passwordVisible ? "text" : "password"}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New Password"
        />
        <Input
          type={passwordVisible ? "text" : "password"}
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
          placeholder="Confirm New Password"
        />
      <div className='w-full flex justify-start items-center pl-1'>
        <div className='w-4'>
          <Input
            type='checkbox'
            checked={passwordVisible}
            onChange={(e) => setPasswordVisible(e.target.checked)}
          />
        </div>
        <div className='pl-2'>show password</div>
      </div>
        {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Resetting Password...' : 'Reset Password'}
        </Button>
      </form>
    </div>
  );
};

// Main Page Component
export const AuthPage = () => {
  const [currentForm, setCurrentForm] = useState<'login' | 'signup' | 'otp' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('');

  return (
    <AuthPageContainer>
      {currentForm === 'login' && (
        <LoginForm
          startForgotPassword={() => setCurrentForm('forgot')}
        />
      )}
      {currentForm === 'signup' && (
        <SignUpForm
          startOtpVerification={(email) => {
            setEmail(email);
            setCurrentForm('otp');
          }}
        />
      )}
      {currentForm === 'otp' && (
        <OTPVerificationForm
          email={email}
          handleOtpVerified={() => setCurrentForm('login')}
        />
      )}
      {currentForm === 'forgot' && (
        <ForgotPasswordForm
          startResetPassword={(email) => {
            setEmail(email);
            setCurrentForm('reset');
          }}
        />
      )}
      {currentForm === 'reset' && (
        <ResetPasswordForm
          email={email}
          handlePasswordReset={() => setCurrentForm('login')}
        />
      )}
    </AuthPageContainer>
  );
};