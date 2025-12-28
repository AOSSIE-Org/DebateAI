import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LoginForm, SignUpForm, OTPVerificationForm, ForgotPasswordForm, ResetPasswordForm } from './Authentication/forms.tsx';
import { Link } from 'react-router-dom';
import coverimage from '../assets/DebateCover4.svg';
import { ThemeToggle } from '@/components/ThemeToggle';

const LeftSection = () => (
  <div className="hidden md:flex w-full h-full relative flex-col justify-between bg-muted text-black overflow-hidden">

    {/*Cloud background */}
    <div className="absolute -top-24 -left-24 w-[520px] h-[520px] bg-white rounded-full opacity-70" />
    <div className="absolute top-1/3 -right-32 w-[420px] h-[420px] bg-white rounded-full  opacity-60" />

    {/*Cover image */}
    <img
      src={coverimage}
      alt=""
      className="absolute top-40 left-1/2 -translate-x-1/2 w-[720px] opacity-100  pointer-events-none"
    />

    {/* Content */}
    <div className="relative z-10 flex flex-col justify-between h-full p-10">

      {/* Logo */}
      <Link to="/" className="flex items-center gap-3 text-2xl font-semibold">
        <span>Argue-Hub</span>
      </Link>

      {/* Center Message */}
      <div className="mt-[520px] flex flex-col items-center text-center px-6">
        <h1 className="text-3xl font-bold leading-tight">
          Debate. Decide. Dominate.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground max-w-md">
          A platform to challenge ideas, sharpen thinking, and grow through discussion.
        </p>
      </div>

      {/* Quote */}
      <blockquote className="space-y-2 max-w-md">
        <p className="text-sm italic text-muted-foreground">
          “We cannot solve our problems with the same thinking we used when we created them.”
        </p>
        <footer className="text-xs text-muted-foreground">
          — Albert Einstein
        </footer>
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
  <div className="flex items-center justify-center w-full min-h-screen relative px-4 sm:px-0">

    {/*Mobile cover image */}
    <div className="md:hidden absolute top-20 left-0 w-full h-56 overflow-hidden">
      <img
        src={coverimage}
        alt=""
        className="w-full h-full object-contain opacity-100"
      />
    </div>


    {authMode !== 'otpVerification' && authMode !== 'resetPassword' && (
      <div className="absolute right-4 top-4 md:right-8 md:top-8 z-50 flex items-center gap-2">
         <ThemeToggle />
      <Button
        onClick={toggleAuthMode}
        variant="outline"
      >
        {authMode === 'signup' ? 'Sign In' : 'Sign Up'}
      </Button>
      </div>
    )}

    
    <div className="md:hidden absolute top-6 left-6 font-semibold text-lg">
      Arguehub
    </div>


    {/* Form Container */}
    <div className="flex flex-col items-center justify-center w-full max-w-md text-center mt-56 md:mt-0 px-6 sm:px-8 md:px-0   ">

      {authMode === 'login' && (
        <>
          <h3 className="text-xl sm:text-2xl font-medium my-4">Sign in to your account</h3>
          <LoginForm startForgotPassword={startForgotPassword} infoMessage={infoMessage} />
        </>
      )}
      {authMode === 'signup' && (
        <>
          <h3 className="text-xl sm:text-2xl font-medium my-4">Create an account</h3>
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