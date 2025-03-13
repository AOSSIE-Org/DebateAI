import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { LoginForm, SignUpForm, OTPVerificationForm, ForgotPasswordForm, ResetPasswordForm } from './Authentication/forms.tsx';
import { Link } from 'react-router-dom';
import loginSvg from '@/assets/login.svg';
import signupSvg from '@/assets/signup.svg';

interface LeftSectionProps {
  authMode: 'login' | 'signup' | 'otpVerification' | 'forgotPassword' | 'resetPassword';
}

const LeftSection: React.FC<LeftSectionProps> = ({ authMode }) => (
  <div className="hidden md:flex w-full h-full flex-col justify-between bg-muted p-10">
    <div className="flex items-center text-lg font-medium text-white">
      <Link to="/" className="flex items-center text-2xl">
        <svg>
          {/* <img src={logo} alt="Arguehub Logo" className="w-10 h-10" /> */}
        </svg>
        Arguehub
      </Link>
    </div>

    <div className="flex flex-col items-center justify-center flex-grow">
      <img 
        src={authMode === 'signup' ? signupSvg : loginSvg} 
        alt={`${authMode === 'signup' ? 'Sign up' : 'Login'} illustration`}
        className="w-4/5 max-w-md mb-16 scale-150"
      />
      <blockquote className="space-y-2">
        <p className="text-lg text-white text-center">
          "We cannot solve our problems with the same thinking we used when we created them."
        </p>
        <footer className="text-sm text-muted-foreground text-right italic">- Albert Einstein</footer>
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
      <LeftSection authMode={authMode} />

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