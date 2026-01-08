import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LoginForm, SignUpForm, OTPVerificationForm, ForgotPasswordForm, ResetPasswordForm } from './Authentication/forms.tsx';
import { Link } from 'react-router-dom';

const LeftSection = () => (
  <div className="hidden md:flex w-full h-full flex-col justify-between bg-muted p-10 text-white">
    <div className="flex items-center text-lg font-medium">
      <Link to="/" className="flex items-center">
        <svg>
          {/* SVG Content */}
        </svg>
        Arguehub
      </Link>
    </div>
    <div>
      <blockquote className="space-y-2">
        <p className="text-lg">
          "We cannot solve our problems with the same thinking we used when we created them."
        </p>
        <footer className="text-sm">Albert Einstein</footer>
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
  <div className="flex items-center justify-center w-full h-full relative">
    {authMode !== 'otpVerification' && authMode !== 'resetPassword' && (
      <Button
        className="absolute right-4 top-4 md:right-8 md:top-8"
        onClick={toggleAuthMode}
        variant="outline"
      >
        {authMode === 'signup' ? 'Sign In' : 'Sign Up'}
      </Button>
    )}
    <div className="flex flex-col items-center justify-center h-full w-3/5 text-center">
      {authMode === 'login' && (
        <>
          <h3 className="text-2xl font-medium my-4">Sign in to your account</h3>
          <LoginForm startForgotPassword={startForgotPassword} infoMessage={infoMessage} />
        </>
      )}
      {authMode === 'signup' && (
        <>
          <h3 className="text-2xl font-medium my-4">Create an account</h3>
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
