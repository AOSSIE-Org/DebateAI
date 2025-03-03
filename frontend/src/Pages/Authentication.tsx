import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LoginForm, SignUpForm, OTPVerificationForm, ForgotPasswordForm, ResetPasswordForm } from './Authentication/forms.tsx';
import { Link } from 'react-router-dom';
import karnxBackground from '../assets/image-.png'; 

const LeftSection = () => (
  <div className="hidden md:flex w-full h-full flex-col justify-between p-10 text-white relative">
    
    <div className="absolute inset-0 z-0">
      <img 
        src={karnxBackground} 
        alt="Debate Platform Background" 
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/50" />
    </div>

    
    <div className="flex items-center text-lg font-medium relative z-10">
      <Link to="/" className="flex items-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mr-2 h-6 w-6"
        >
          <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
        </svg>
        DebateAI
      </Link>
    </div>

    {/* Quote Section */}
    <div className="relative z-10">
      <blockquote className="space-y-2">
        <p className="text-lg">
          "For good ideas and true innovation, you need human interaction, conflict, argument, debate."
        </p>
        <footer className="text-sm">Friedrich Nietzsche</footer>
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
  const [authMode, setAuthMode] = useState<
    'login' | 'signup' | 'otpVerification' | 'forgotPassword' | 'resetPassword'
  >('login');
  const [emailForOTP, setEmailForOTP] = useState('');
  const [emailForPasswordReset, setEmailForPasswordReset] = useState(''); 
  const [infoMessage, setInfoMessage] = useState('');

  const toggleAuthMode = () => {
    setAuthMode((prevMode) => (prevMode === 'login' ? 'signup' : 'login'));
  };

  const startOtpVerification = (email: string) => {
    setEmailForOTP(email);
    setAuthMode('otpVerification');
  };

  const handleOtpVerified = () => {
    setAuthMode('login');
  };

  const startForgotPassword = () => {
    setAuthMode('forgotPassword');
  };

  const startResetPassword = (email: string) => {
    setEmailForPasswordReset(email);
    setAuthMode('resetPassword');
  };

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