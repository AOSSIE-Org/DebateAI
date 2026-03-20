import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LoginForm, SignUpForm, OTPVerificationForm, ForgotPasswordForm, ResetPasswordForm } from './Authentication/forms.tsx';
import { Link } from 'react-router-dom';
import DebateCover from '../assets/DebateCover4.svg';
import { ThemeToggle } from '@/components/ThemeToggle';

const LeftSection = () => (
  <div className="hidden md:flex w-full h-full flex-col justify-between 
  bg-gradient-to-br from-purple-500/20 to-blue-500/20 
  backdrop-blur-lg p-10 text-black dark:text-white">

    {/* Logo */}
    <div className="flex items-center text-xl font-bold 
    hover:scale-105 transition-transform duration-300 cursor-pointer">
      <Link to="/" className="flex items-center gap-2">
        Arguehub
      </Link>
    </div>

    {/* Image */}
    <div className="flex justify-center items-center flex-1 p-10">
      <img 
        src={DebateCover} 
        alt="Debate Cover" 
        className="max-w-full max-h-full object-contain 
        hover:scale-105 transition-transform duration-500"
      />
    </div>

    {/* Quote */}
    <blockquote className="space-y-2 
    hover:translate-y-[-5px] transition-all duration-300">
      <p className="text-lg italic">
        "We cannot solve our problems with the same thinking we used when we created them."
      </p>
      <footer className="text-sm opacity-70">— Albert Einstein</footer>
    </blockquote>
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
    <div className="absolute right-4 top-4 md:right-8 md:top-8 flex flex-col md:flex-row gap-2 items-center">
      <div className="w-32">
        <ThemeToggle />
      </div>
      {authMode !== 'otpVerification' && authMode !== 'resetPassword' && (
        <Button
          className="border-black dark:border-white"
          onClick={toggleAuthMode}
          variant="outline"
        >
          {authMode === 'signup' ? 'Sign In' : 'Sign Up'}
        </Button>
      )}
    </div>
    <div className="flex flex-col items-center justify-center h-full w-4/5 md:w-3/5 text-center">
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