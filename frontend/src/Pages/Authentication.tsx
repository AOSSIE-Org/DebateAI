import React, { useState, useEffect, useContext } from 'react';
import { Button } from '@/components/ui/button';
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

const LeftSection = () => (
  <div className="flex flex-col justify-between bg-muted p-6 sm:p-8 xl:p-10 text-black dark:text-white w-full xl:w-1/2 xl:h-full min-h-[50vh] [.contrast_&]:text-white overflow-hidden">
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
  <div className="flex items-center justify-center w-full xl:w-1/2 xl:h-full relative py-16 xl:py-0 min-h-[80vh] xl:min-h-0">
    <div className="absolute right-2 top-2 sm:right-4 sm:top-4 xl:right-8 xl:top-8 flex flex-row gap-4 items-center z-10">
      <div className="w-32">
        <ThemeToggle iconSize={20} />
      </div>

      {authMode !== 'otpVerification' && authMode !== 'resetPassword' && (
        <Button
          className="border-foreground dark:border-white"
          onClick={toggleAuthMode}
          variant="outline"
        >
          {authMode === 'signup' ? 'Sign In' : 'Sign Up'}
        </Button>
      )}
    </div>

    <div className="flex flex-col items-center justify-center w-full px-6">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-8 backdrop-blur-sm">

        {authMode === 'login' && (
          <>
            <h3 className="text-2xl font-medium my-4">
              Sign in to your account
            </h3>

            <LoginForm
              startForgotPassword={startForgotPassword}
              infoMessage={infoMessage}
            />
          </>
        )}

        {authMode === 'signup' && (
          <>
            <h3 className="text-2xl font-medium my-4">
              Create an account
            </h3>

            <SignUpForm
              startOtpVerification={startOtpVerification}
            />
          </>
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
    <div className="flex flex-col-reverse xl:flex-row w-full overflow-x-hidden min-h-screen xl:h-screen xl:overflow-hidden bg-background">
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