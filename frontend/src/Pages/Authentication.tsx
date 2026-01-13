import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LoginForm, SignUpForm, OTPVerificationForm, ForgotPasswordForm, ResetPasswordForm } from './Authentication/forms.tsx';
import DebateCover from '../assets/DebateCover4.svg';
import { ThemeToggle } from '@/components/ThemeToggle';

const LeftSection = () => (
  <div className="hidden md:flex w-full h-full flex-col justify-start items-center bg-muted p-10 text-black dark:text-white">
    <div className="flex flex-col items-center text-center gap-8 mb-8 mt-8">
      <div className="flex flex-col items-center">
        <span className="text-5xl md:text-7xl font-extrabold text-gray-500 drop-shadow-2xl text-center" style={{ textShadow: '0 4px 8px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2)' }}>
          Debate Ai
        </span>
      </div>
      <p className="text-2xl md:text-4xl text-gray-400 max-w-4xl text-center leading-tight">
        An online debate isn't won by the <span className="text-orange-500 font-bold" style={{ textShadow: '1px 1px 3px rgba(0, 0, 0, 0.8)' }}>loudest voice</span>, <br />but by the clearest <span className="text-orange-500 font-bold" style={{ textShadow: '1px 1px 3px rgba(0, 0, 0, 0.8)' }}>reasoning</span>.
      </p>
    </div>
    <div className="flex justify-center items-center flex-1">
      <img src={DebateCover} alt="Debate Cover" className="max-w-full max-h-full w-auto object-contain scale-130" />
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
    <div className="flex flex-col items-center justify-center h-full w-4/5 md:w-3/5 text-center font-serif text-lg">
      {authMode === 'login' && (
        <>
          <h3 className="text-4xl font-semibold my-10" style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.2), 0 1px 2px rgba(0, 0, 0, 0.1)' }}>Sign in to your account</h3>
          <LoginForm startForgotPassword={startForgotPassword} infoMessage={infoMessage} />
        </>
      )}
      {authMode === 'signup' && (
        <>
          <h3 className="text-5xl font-semibold my-11" style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.2), 0 1px 2px rgba(0, 0, 0, 0.1)' }}>Create an account</h3>
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
  >('signup');

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