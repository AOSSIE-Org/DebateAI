import React, { useState, useContext } from 'react';
import { Button } from '@/components/ui/button';
import { LoginForm, SignUpForm, OTPVerificationForm, ForgotPasswordForm, ResetPasswordForm } from './Authentication/forms.tsx';
import { Link } from 'react-router-dom';
import DebateCover from '../assets/DebateCover4.svg';
import { ThemeContext } from '../context/theme-provider';
import { Moon, Sun } from 'lucide-react';

const LeftSection = () => (
  <div className="hidden md:flex w-full h-full flex-col justify-between bg-muted p-10 text-foreground">
    <div className="flex items-center text-lg font-medium">
      <Link to="/" className="flex items-center hover:opacity-80 transition">
        <svg>
          {/* SVG Content */}
        </svg>
        Arguehub
      </Link>
    </div>
    <div className="flex items-center justify-center flex-1 px-8">
      <img src={DebateCover} alt="Debate Illustration" className="w-full max-w-xl object-contain" />
    </div>
    <div>
      <blockquote className="space-y-2">
        <p className="text-lg text-foreground">
          "We cannot solve our problems with the same thinking we used when we created them."
        </p>
        <footer className="text-sm text-muted-foreground">Albert Einstein</footer>
      </blockquote>
    </div>
  </div>
);



interface RightSectionProps {
  authMode: 'login' | 'signup' | 'otpVerification' | 'forgotPassword' | 'resetPassword';
  toggleAuthMode: () => void;
  startOtpVerification: (email: string) => void;
  handleOtpVerified: () => void;
  startForgotPassword: () => void;
  startResetPassword: (email: string) => void;
  handlePasswordReset: () => void;
  emailForOTP: string;
  emailForPasswordReset: string;
  infoMessage: string;
}

const RightSection: React.FC<RightSectionProps> = ({
  authMode,
  toggleAuthMode,
  startOtpVerification,
  handleOtpVerified,
  startForgotPassword,
  startResetPassword,
  handlePasswordReset,
  emailForOTP,
  emailForPasswordReset,
  infoMessage,
}) => (
  <div className="flex items-center justify-center w-full h-full relative px-4">
    {authMode !== 'otpVerification' && authMode !== 'resetPassword' && (
      <Button
        className="absolute right-4 top-4 md:right-8 md:top-8"
        onClick={toggleAuthMode}
        variant="outline"
      >
        {authMode === 'signup' ? 'Sign In' : 'Sign Up'}
      </Button>
    )}
    <div className="flex flex-col items-center justify-center h-full w-full max-w-lg text-center">
      {authMode === 'login' && (
        <>
          <h3 className="text-2xl font-medium my-4 text-foreground">Sign in to your account</h3>
          <LoginForm startForgotPassword={startForgotPassword} infoMessage={infoMessage} />
        </>
      )}
      {authMode === 'signup' && (
        <>
          <h3 className="text-2xl font-medium my-4 text-foreground">Create an account</h3>
          <SignUpForm startOtpVerification={startOtpVerification} />
        </>
      )}
      {authMode === 'otpVerification' && (
        <OTPVerificationForm email={emailForOTP} handleOtpVerified={handleOtpVerified} />
      )}
      {authMode === 'forgotPassword' && (
        <ForgotPasswordForm startResetPassword={startResetPassword} />
      )}
      {authMode === 'resetPassword' && (
        <ResetPasswordForm
          email={emailForPasswordReset}
          handlePasswordReset={handlePasswordReset}
        />
      )}
    </div>
  </div>
);


const Authentication = () => {
  // Extend authMode to include 'resetPassword'
  const [authMode, setAuthMode] = useState<
    'login' | 'signup' | 'otpVerification' | 'forgotPassword' | 'resetPassword'
  >('login');

  const [emailForOTP, setEmailForOTP] = useState('');
  const [emailForPasswordReset, setEmailForPasswordReset] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const toggleAuthMode = () => {
    setAuthMode((prevMode) => (prevMode === 'login' ? 'signup' : 'login'));
  };

  // Start OTP verification process
  const startOtpVerification = (email: string) => {
    setEmailForOTP(email);
    setAuthMode('otpVerification');
  };

  // Handle successful OTP verification
  const handleOtpVerified = () => {
    setAuthMode('login');
  };

  // Start forgot password process
  const startForgotPassword = () => {
    setAuthMode('forgotPassword');
  };

  // Start reset password process
  const startResetPassword = (email: string) => {
    setEmailForPasswordReset(email);
    setAuthMode('resetPassword');
  };

  // Handle successful password reset
  const handlePasswordReset = () => {
    setInfoMessage('Your password was successfully reset. You can now log in.');
    setAuthMode('login');
  };

  const themeContext = useContext(ThemeContext);
  const { theme, toggleTheme } = themeContext;

  return (
    <div className="flex w-screen h-screen relative bg-background text-foreground">
      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className="absolute left-4 top-4 z-50 p-2 rounded-md bg-muted hover:bg-muted/80 transition-colors border border-border"
        aria-label="Toggle theme"
      >
        {theme === 0 ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <LeftSection />

      <RightSection
        authMode={authMode}
        toggleAuthMode={toggleAuthMode}
        startOtpVerification={startOtpVerification}
        handleOtpVerified={handleOtpVerified}
        startForgotPassword={startForgotPassword}
        startResetPassword={startResetPassword}
        handlePasswordReset={handlePasswordReset}
        emailForOTP={emailForOTP}
        emailForPasswordReset={emailForPasswordReset}
        infoMessage={infoMessage}
      />
    </div>
  );
};

export default Authentication;