import React, { useState, useEffect, useContext } from 'react';
import {
  LoginForm,
  SignUpForm,
  OTPVerificationForm,
  ForgotPasswordForm,
  ResetPasswordForm,
} from './Authentication/forms.tsx';
import { Link, useLocation } from 'react-router-dom';
import DebateCoverIllustration from '../components/DebateCoverIllustration';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AuthContext } from '../context/authContext';
import debateAiLogo from '@/assets/aossie.png';

const LeftSection = () => (
  <div className="hidden xl:flex flex-col justify-between bg-muted p-6 sm:p-8 xl:p-10 text-black dark:text-white w-full xl:w-1/2 xl:h-full min-h-[50vh] [.contrast_&]:text-white overflow-hidden">
    <div className="flex w-full items-center justify-center xl:justify-start text-lg font-medium text-center mx-auto">
      <Link to="/" className="flex flex-wrap items-center justify-center xl:justify-start gap-2 max-w-full break-words mx-auto xl:mx-0">
        <svg>
          {/* SVG Content */}
        </svg>
        Arguehub
      </Link>
    </div>
    <div className="flex justify-center items-center flex-1 min-h-0 p-6">
      <DebateCoverIllustration
        className="max-w-full max-h-full object-contain"
        role="img"
        aria-label="Debate Cover"
      />
    </div>

    <div>
      <blockquote className="space-y-2 text-center xl:text-left">
        <p className="text-lg text-black dark:text-white [.contrast_&]:text-white">
          "We cannot solve our problems with the same thinking we used when we created them."
        </p>
        <footer className="text-sm text-black dark:text-white [.contrast_&]:text-white">Albert Einstein</footer>
      </blockquote>
    </div>
  </div>
);

interface RightSectionProps {
  authMode:
    | 'login'
    | 'signup'
    | 'otpVerification'
    | 'forgotPassword'
    | 'resetPassword';
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
  <div className="flex flex-col items-center justify-center w-full xl:w-1/2 min-h-screen xl:h-full relative px-4 py-20 sm:px-6 xl:p-8">
    {/* Top Header Bar */}
    <div className="absolute top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-6 xl:top-8 xl:left-8 xl:right-8 flex items-center justify-between z-10 pointer-events-auto">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors xl:hidden"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span>Home</span>
      </Link>
      <div className="w-32 ml-auto">
        <ThemeToggle iconSize={18} />
      </div>
    </div>

    <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-6 sm:p-8 backdrop-blur-sm">
      <div className="flex flex-col items-center text-center mb-6">
        <Link to="/" className="mb-2 hover:opacity-80 transition-opacity">
          <img src={debateAiLogo} alt="DebateAI Logo" className="h-10 w-auto object-contain" />
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {authMode === 'login' && 'Welcome to DebateAI'}
          {authMode === 'signup' && 'Create an account'}
          {authMode === 'otpVerification' && 'Verify your email'}
          {authMode === 'forgotPassword' && 'Reset your password'}
          {authMode === 'resetPassword' && 'Set new password'}
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xs">
          {authMode === 'login' && 'Sign in to access your debate arena and practice'}
          {authMode === 'signup' && 'Join the #1 platform to master debate and argumentation'}
          {authMode === 'otpVerification' && `Enter the OTP sent to ${emailForOTP || 'your email'}`}
          {authMode === 'forgotPassword' && 'Enter your email to receive a password reset code'}
          {authMode === 'resetPassword' && 'Enter your reset code and set a new password'}
        </p>
      </div>

      {authMode === 'login' && (
        <LoginForm
          startForgotPassword={startForgotPassword}
          infoMessage={infoMessage}
        />
      )}

      {authMode === 'signup' && (
        <SignUpForm
          startOtpVerification={startOtpVerification}
        />
      )}

      {authMode === 'otpVerification' && (
        <OTPVerificationForm
          email={emailForOTP}
          handleOtpVerified={handleOtpVerified}
        />
      )}

      {authMode === 'forgotPassword' && (
        <ForgotPasswordForm
          startResetPassword={startResetPassword}
        />
      )}

      {authMode === 'resetPassword' && (
        <ResetPasswordForm
          email={emailForPasswordReset}
          handlePasswordReset={handlePasswordReset}
        />
      )}

      <div className="mt-6 pt-4 border-t border-border text-center text-sm text-muted-foreground">
        {authMode === 'login' && (
          <p>
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={toggleAuthMode}
              className="font-semibold text-primary hover:underline cursor-pointer"
            >
              Sign Up
            </button>
          </p>
        )}

        {authMode === 'signup' && (
          <p>
            Already have an account?{' '}
            <button
              type="button"
              onClick={toggleAuthMode}
              className="font-semibold text-primary hover:underline cursor-pointer"
            >
              Sign In
            </button>
          </p>
        )}

        {(authMode === 'otpVerification' || authMode === 'forgotPassword' || authMode === 'resetPassword') && (
          <button
            type="button"
            onClick={toggleAuthMode}
            className="font-semibold text-primary hover:underline cursor-pointer"
          >
            ← Back to Sign In
          </button>
        )}
      </div>
    </div>
  </div>
);

const Authentication = () => {
  const location = useLocation();
  const authContext = useContext(AuthContext);
  // Extend authMode to include 'resetPassword'
  const [authMode, setAuthMode] = useState<
    | 'login'
    | 'signup'
    | 'otpVerification'
    | 'forgotPassword'
    | 'resetPassword'
  >(
    location.state?.isSignUp ? 'signup' : 'login'
  );

  const [emailForOTP, setEmailForOTP] = useState('');
  const [emailForPasswordReset, setEmailForPasswordReset] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  // Update browser tab title based on authentication state
  useEffect(() => {
    const authTitles = {
      login: 'Sign In | DebateAI',
      signup: 'Sign Up | DebateAI',
      otpVerification: 'Verify Account| DebateAI',
      forgotPassword: 'Reset Password | DebateAI',
      resetPassword: 'Reset Password | DebateAI',
    };

    document.title = authTitles[authMode];
  }, [authMode]);

  const toggleAuthMode = () => {
    authContext?.clearError();
    setInfoMessage('');
    setAuthMode((prevMode) => (prevMode === 'login' ? 'signup' : 'login'));
  };

  // Start OTP verification process
  const startOtpVerification = (email: string) => {
    authContext?.clearError();
    setEmailForOTP(email);
    setAuthMode('otpVerification');
  };

  // Handle successful OTP verification
  const handleOtpVerified = () => {
    authContext?.clearError();
    setAuthMode('login');
  };

  // Start forgot password process
  const startForgotPassword = () => {
    authContext?.clearError();
    setInfoMessage('');
    setAuthMode('forgotPassword');
  };

  // Start reset password process
  const startResetPassword = (email: string) => {
    authContext?.clearError();
    setEmailForPasswordReset(email);
    setAuthMode('resetPassword');
  };

  // Handle successful password reset
  const handlePasswordReset = () => {
    authContext?.clearError();
    setInfoMessage('Your password was successfully reset. You can now log in.');
    setAuthMode('login');
  };

  return (
    <div className="flex flex-col xl:flex-row w-full overflow-x-hidden min-h-screen xl:h-screen xl:overflow-hidden bg-background">
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