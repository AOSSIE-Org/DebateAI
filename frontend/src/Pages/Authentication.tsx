import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LoginForm, SignUpForm, OTPVerificationForm, ForgotPasswordForm, ResetPasswordForm } from './Authentication/forms.tsx';
import { Link } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';

const LeftSection = () => (
  <div className="hidden md:flex w-full h-full flex-col justify-between bg-gradient-to-br from-orange-600 via-orange-500 to-yellow-500 dark:from-orange-700 dark:via-orange-600 dark:to-amber-600 p-10 text-white relative overflow-hidden">
    {/* Background pattern */}
    <div className="absolute inset-0 opacity-10">
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5" />
        </pattern>
        <rect width="100" height="100" fill="url(#grid)" />
      </svg>
    </div>

    {/* Logo */}
    <div className="flex items-center text-lg font-bold z-10">
      <Link to="/" className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
        </svg>
        Argue-Hub
      </Link>
    </div>

    {/* Illustration - Debate Scene */}
    <div className="flex-1 flex items-center justify-center z-10">
      <svg viewBox="0 0 400 300" className="w-full max-w-md" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" role="img">
        {/* Podiums */}
        <rect x="40" y="200" width="80" height="80" rx="8" fill="white" fillOpacity="0.2" />
        <rect x="280" y="200" width="80" height="80" rx="8" fill="white" fillOpacity="0.2" />

        {/* Person 1 */}
        <circle cx="80" cy="150" r="25" fill="white" fillOpacity="0.9" />
        <rect x="60" y="175" width="40" height="30" rx="5" fill="white" fillOpacity="0.9" />

        {/* Person 2 */}
        <circle cx="320" cy="150" r="25" fill="white" fillOpacity="0.9" />
        <rect x="300" y="175" width="40" height="30" rx="5" fill="white" fillOpacity="0.9" />

        {/* Speech bubbles */}
        <ellipse cx="140" cy="120" rx="40" ry="25" fill="white" fillOpacity="0.3" />
        <ellipse cx="260" cy="100" rx="35" ry="22" fill="white" fillOpacity="0.3" />
        <ellipse cx="200" cy="80" rx="30" ry="18" fill="white" fillOpacity="0.4" />

        {/* Connecting lines */}
        <path d="M100 160 Q200 100 300 160" stroke="white" strokeWidth="2" strokeDasharray="5,5" opacity="0.5" />
      </svg>
    </div>

    {/* Quote */}
    <div className="z-10">
      <blockquote className="space-y-2">
        <p className="text-xl font-light italic">
          "We cannot solve our problems with the same thinking we used when we created them."
        </p>
        <footer className="text-sm opacity-80">— Albert Einstein</footer>
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
  <div className="flex items-center justify-center w-full h-full relative bg-background text-foreground">
    {/* Theme Toggle - top left */}
    <div className="absolute left-4 top-4 md:left-8 md:top-8 w-40">
      <ThemeToggle />
    </div>

    {/* Auth mode toggle - top right */}
    {authMode !== 'otpVerification' && authMode !== 'resetPassword' && (
      <Button
        className="absolute right-4 top-4 md:right-8 md:top-8"
        onClick={toggleAuthMode}
        variant="outline"
      >
        {authMode === 'signup' ? 'Sign In' : 'Sign Up'}
      </Button>
    )}

    {/* Form container - increased width for mobile */}
    <div className="flex flex-col items-center justify-center h-full w-[90%] sm:w-4/5 md:w-3/5 px-4 text-center">
      {authMode === 'login' && (
        <>
          <h3 className="text-2xl font-semibold my-4 text-foreground">Sign in to your account</h3>
          <LoginForm startForgotPassword={startForgotPassword} infoMessage={infoMessage} />
        </>
      )}
      {authMode === 'signup' && (
        <>
          <h3 className="text-2xl font-semibold my-4 text-foreground">Create an account</h3>
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

  return (
    <div className="flex w-screen h-screen">
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