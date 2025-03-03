import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { LoginForm, SignUpForm, OTPVerificationForm, ForgotPasswordForm, ResetPasswordForm } from './Authentication/forms';
import { Link } from 'react-router-dom';
import karnxBackground from '../assets/image-.png';
import google from '../assets/google.png';
import { motion, AnimatePresence } from 'framer-motion';

// Types
type AuthMode = 'login' | 'signup' | 'otpVerification' | 'forgotPassword' | 'resetPassword';

// Animation variants
const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6 } }
};

const slideUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

const slideInRight = {
  hidden: { opacity: 0, x: 50 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6 } }
};

const slideInLeft = {
  hidden: { opacity: 0, x: -50 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6 } }
};

const cardAnimation = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    transition: { 
      type: "spring", 
      stiffness: 300, 
      damping: 25,
      duration: 0.5 
    } 
  },
  exit: { 
    opacity: 0, 
    scale: 0.95, 
    transition: { duration: 0.2 } 
  }
};

// Icons
const DebateIcon = () => (
  <motion.svg
    initial={{ rotate: -10 }}
    animate={{ rotate: 0 }}
    transition={{ duration: 0.6, type: "spring" }}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-10 w-10 lg:h-10 lg:w-10"
    aria-hidden="true"
  >
    <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
  </motion.svg>
);

// Left Section Component
const LeftSection: React.FC = () => (
  <div className="hidden lg:flex w-1/2 h-full relative overflow-hidden">
    {/* Background with overlay gradient */}
    <div className="absolute inset-0">
      <motion.img 
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 7, ease: "easeOut" }}
        src={karnxBackground} 
        alt="Debate Platform Background" 
        className="w-full h-full object-cover"
      />
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5 }}
        className="absolute inset-0 bg-gradient-to-r from-black/80 to-gray-900/80" 
      />
    </div>
    
    {/* Content */}
    <div className="relative z-10 flex flex-col h-full justify-between p-12 text-white">
      {/* Logo */}
      <motion.div 
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        className="flex items-center text-2xl font-bold"
      >
        <Link to="/" className="flex items-center space-x-2 hover:opacity-90 transition-opacity" aria-label="DebateAI Home">
          <DebateIcon />
          <motion.span 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="tracking-tight"
          >
            DebateAI
          </motion.span>
        </Link>
      </motion.div>
      
      {/* Features */}
      <motion.div 
        initial="hidden"
        animate="visible"
        transition={{ staggerChildren: 0.2, delayChildren: 0.6 }}
        className="grid grid-cols-2 gap-6"
      >
        <FeatureItem 
          icon={<ChatIcon />}
          title="AI Opponents"
          description="Practice with intelligent debate partners"
        />
        <FeatureItem 
          icon={<FeedbackIcon />}
          title="Feedback & Analysis"
          description="Receive detailed critiques of your arguments"
        />
      </motion.div>
    </div>
  </div>
);

// Feature Item Component
interface FeatureItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ icon, title, description }) => (
  <motion.div 
    variants={slideUp}
    className="flex items-start space-x-3"
  >
    <motion.div 
      whileHover={{ scale: 1.1, backgroundColor: "rgba(255, 255, 255, 0.3)" }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className="rounded-full bg-white/20 p-2 backdrop-blur-sm"
    >
      {icon}
    </motion.div>
    <div>
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-gray-300">{description}</p>
    </div>
  </motion.div>
);

// Icons
const ChatIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
  </svg>
);

const FeedbackIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
  </svg>
);

const LockIcon = () => (
  <motion.svg 
    initial={{ scale: 0.8 }}
    animate={{ scale: 1 }}
    transition={{ 
      type: "spring", 
      stiffness: 300, 
      damping: 20,
      delay: 0.2 
    }}
    xmlns="http://www.w3.org/2000/svg" 
    width="32" 
    height="32" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className="text-gray-600 dark:text-gray-400" 
    aria-hidden="true"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </motion.svg>
);

const VerifyIcon = () => (
  <motion.svg 
    initial={{ scale: 0.8 }}
    animate={{ scale: 1 }}
    transition={{ 
      type: "spring", 
      stiffness: 300, 
      damping: 20,
      delay: 0.2 
    }}
    xmlns="http://www.w3.org/2000/svg" 
    width="32" 
    height="32" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className="text-gray-600 dark:text-gray-400" 
    aria-hidden="true"
  >
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
  </motion.svg>
);

const BackIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1" aria-hidden="true">
    <path d="M19 12H5M12 19l-7-7 7-7"></path>
  </svg>
);

const SuccessIcon = () => (
  <motion.svg 
    initial={{ scale: 0, rotate: -180 }}
    animate={{ scale: 1, rotate: 0 }}
    transition={{ duration: 0.5, type: "spring" }}
    className="w-5 h-5 mr-2" 
    fill="none" 
    stroke="currentColor" 
    viewBox="0 0 24 24" 
    xmlns="http://www.w3.org/2000/svg" 
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
  </motion.svg>
);

// Right Section Props
interface RightSectionProps {
  authMode: AuthMode;
  toggleAuthMode: () => void;
  startOtpVerification: (email: string) => void;
  handleOtpVerified: () => void;
  startForgotPassword: () => void;
  startResetPassword: (email: string) => void; 
  handlePasswordReset: () => void; 
  emailForOTP: string;
  emailForPasswordReset: string; 
  infoMessage: string; 
  setAuthMode: (mode: AuthMode) => void;
}

// Right Section Component
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
  setAuthMode
}) => {
  const handleGoogleLogin = () => {
    // Add Google OAuth logic here
    console.log('Logging in with Google');
  };
  
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="w-full lg:w-1/2 h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6 lg:p-0"
    >
      {/* Mobile Logo */}
      <motion.div 
        variants={slideInLeft}
        initial="hidden"
        animate="visible"
        className="lg:hidden absolute top-6 left-6"
      >
        <Link to="/" className="flex items-center space-x-2 text-xl font-bold" aria-label="DebateAI Home">
          <DebateIcon />
          <span>DebateAI</span>
        </Link>
      </motion.div>
      
      {/* Auth Container */}
      <div className="w-full max-w-md">
        {/* Toggle Auth Mode Button */}
        {!['otpVerification', 'resetPassword', 'forgotPassword'].includes(authMode) && (
          <motion.div 
            variants={slideInRight}
            initial="hidden"
            animate="visible"
            className="flex justify-end mb-4"
          >
            <Button
              onClick={toggleAuthMode}
              variant="ghost"
              className="text-sm font-medium hover:text-gray-600 transition-colors"
            >
              {authMode === 'signup' ? 'Already have an account?' : 'Don\'t have an account?'}
              <motion.span 
                whileHover={{ x: 3 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                className="ml-1 font-bold text-gray-600 dark:text-gray-400"
              >
                {authMode === 'signup' ? 'Sign In' : 'Sign Up'}
              </motion.span>
            </Button>
          </motion.div>
        )}
        
        {/* Auth Card */}
        <AnimatePresence mode="wait">
          <motion.div 
            key={authMode}
            variants={cardAnimation}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700"
          >
            {renderAuthContent(authMode, {
              infoMessage,
              startForgotPassword,
              handleGoogleLogin,
              startOtpVerification,
              emailForOTP,
              handleOtpVerified,
              setAuthMode,
              startResetPassword,
              emailForPasswordReset,
              handlePasswordReset
            })}
          </motion.div>
        </AnimatePresence>
        
        {/* Terms and Privacy */}
        {(authMode === 'login' || authMode === 'signup') && (
          <motion.div 
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.6 }}
            className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400"
          >
            By continuing, you agree to DebateAI's{' '}
            <Link to="/terms" className="text-gray-600 dark:text-gray-400 hover:underline">
              Terms of Service
            </Link>
            {' '}and{' '}
            <Link to="/privacy" className="text-gray-600 dark:text-gray-400 hover:underline">
              Privacy Policy
            </Link>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

// Function to render the appropriate auth content based on the current mode
interface AuthContentProps {
  infoMessage?: string;
  startForgotPassword?: () => void;
  handleGoogleLogin?: () => void;
  startOtpVerification?: (email: string) => void;
  emailForOTP?: string;
  handleOtpVerified?: () => void;
  setAuthMode?: (mode: AuthMode) => void;
  startResetPassword?: (email: string) => void;
  emailForPasswordReset?: string;
  handlePasswordReset?: () => void;
}

const renderAuthContent = (mode: AuthMode, props: AuthContentProps) => {
  switch (mode) {
    case 'login':
      return (
        <LoginContent 
          infoMessage={props.infoMessage || ''} 
          startForgotPassword={props.startForgotPassword!}
          handleGoogleLogin={props.handleGoogleLogin!}
        />
      );
    case 'signup':
      return (
        <SignupContent 
          startOtpVerification={props.startOtpVerification!}
          handleGoogleLogin={props.handleGoogleLogin!}
        />
      );
    case 'otpVerification':
      return (
        <OtpVerificationContent 
          emailForOTP={props.emailForOTP!}
          handleOtpVerified={props.handleOtpVerified!}
          startOtpVerification={props.startOtpVerification!}
          setAuthMode={props.setAuthMode!}
        />
      );
    case 'forgotPassword':
      return (
        <ForgotPasswordContent 
          startResetPassword={props.startResetPassword!}
          setAuthMode={props.setAuthMode!}
        />
      );
    case 'resetPassword':
      return (
        <ResetPasswordContent 
          emailForPasswordReset={props.emailForPasswordReset!}
          handlePasswordReset={props.handlePasswordReset!}
        />
      );
    default:
      return null;
  }
};

// Auth Content Components
const AuthHeader: React.FC<{icon?: React.ReactNode; title: string; subtitle: string}> = ({icon, title, subtitle}) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6 }}
    className="text-center mb-8"
  >
    {icon && (
      <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-50 dark:bg-gray-900/30 rounded-full mb-4">
        {icon}
      </div>
    )}
    <motion.h2 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className="text-3xl font-bold mb-2"
    >
      {title}
    </motion.h2>
    <motion.p 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="text-gray-500 dark:text-gray-400" 
      dangerouslySetInnerHTML={{__html: subtitle}} 
    />
  </motion.div>
);

const InfoAlert: React.FC<{message: string}> = ({message}) => (
  message ? (
    <motion.div 
      initial={{ opacity: 0, height: 0, y: -20 }}
      animate={{ opacity: 1, height: "auto", y: 0 }}
      transition={{ 
        type: "spring", 
        stiffness: 500, 
        damping: 30
      }}
      className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 p-4 rounded-lg mb-6 text-sm flex items-center" 
      role="alert"
    >
      <SuccessIcon />
      {message}
    </motion.div>
  ) : null
);

const GoogleButton: React.FC<{onClick: () => void; label: string}> = ({onClick, label}) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.4, duration: 0.6 }}
    className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700"
  >
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex items-center justify-center w-full h-12 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      aria-label={label}
    >
      <motion.img
        initial={{ rotate: -10 }}
        animate={{ rotate: 0 }}
        transition={{ duration: 0.3, delay: 0.5 }}
        src={google}
        alt="Google Logo"
        className="w-5 h-5 mr-2"
        aria-hidden="true"
      />
      <span className="text-gray-700 dark:text-gray-300">{label}</span>
    </motion.button>
  </motion.div>
);

const BackButton: React.FC<{onClick: () => void; label: string}> = ({onClick, label}) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.4, duration: 0.3 }}
    className="mt-4 text-center"
  >
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={onClick}
      className="group"
    >
      <motion.span
        whileHover={{ x: -2 }}
        transition={{ type: "spring", stiffness: 400, damping: 10 }}
      >
        <BackIcon />
      </motion.span>
      {label}
    </Button>
  </motion.div>
);

// Animated Form Component Wrapper
const AnimatedFormWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.3, duration: 0.5 }}
  >
    {children}
  </motion.div>
);

// Form Content Components
const LoginContent: React.FC<{
  infoMessage: string;
  startForgotPassword: () => void;
  handleGoogleLogin: () => void;
}> = ({ infoMessage, startForgotPassword, handleGoogleLogin }) => (
  <>
    <AuthHeader 
      title="Welcome back" 
      subtitle="Sign in to continue to your debates" 
    />
    
    <InfoAlert message={infoMessage} />
    
    <AnimatedFormWrapper>
      <LoginForm startForgotPassword={startForgotPassword} infoMessage={infoMessage} />
    </AnimatedFormWrapper>
    
    <GoogleButton onClick={handleGoogleLogin} label="Login with Google" />
  </>
);

const SignupContent: React.FC<{
  startOtpVerification: (email: string) => void;
  handleGoogleLogin: () => void;
}> = ({ startOtpVerification, handleGoogleLogin }) => (
  <>
    <AuthHeader 
      title="Join DebateAI" 
      subtitle="Create your account to get started" 
    />
    
    <AnimatedFormWrapper>
      <SignUpForm startOtpVerification={startOtpVerification} />
    </AnimatedFormWrapper>
    
    <GoogleButton onClick={handleGoogleLogin} label="Sign up with Google" />
  </>
);

const OtpVerificationContent: React.FC<{
  emailForOTP: string;
  handleOtpVerified: () => void;
  startOtpVerification: (email: string) => void;
  setAuthMode: (mode: AuthMode) => void;
}> = ({ emailForOTP, handleOtpVerified, startOtpVerification, setAuthMode }) => (
  <>
    <AuthHeader 
      icon={<VerifyIcon />}
      title="Verify your email" 
      subtitle={`We sent a verification code to<br/><span class="font-medium text-gray-900 dark:text-gray-200">${emailForOTP}</span>`} 
    />
    
    <AnimatedFormWrapper>
      <OTPVerificationForm email={emailForOTP} handleOtpVerified={handleOtpVerified} />
    </AnimatedFormWrapper>
    
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.3 }}
      className="mt-6 text-center"
    >
      <Button 
        variant="link" 
        onClick={() => startOtpVerification(emailForOTP)}
        className="relative overflow-hidden group"
      >
        <span className="group-hover:text-blue-600 transition-colors">Didn't receive code? Resend</span>
        <motion.span 
          initial={{ scaleX: 0 }}
          whileHover={{ scaleX: 1 }}
          transition={{ duration: 0.3 }}
          className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500 origin-left" 
        />
      </Button>
    </motion.div>
    
    <BackButton onClick={() => setAuthMode('login')} label="Back to login" />
  </>
);

const ForgotPasswordContent: React.FC<{
  startResetPassword: (email: string) => void;
  setAuthMode: (mode: AuthMode) => void;
}> = ({ startResetPassword, setAuthMode }) => (
  <>
    <AuthHeader 
      icon={<LockIcon />}
      title="Reset your password" 
      subtitle="Enter your email and we'll send you instructions to reset your password" 
    />
    
    <AnimatedFormWrapper>
      <ForgotPasswordForm startResetPassword={startResetPassword} />
    </AnimatedFormWrapper>
    
    <BackButton onClick={() => setAuthMode('login')} label="Back to login" />
  </>
);

const ResetPasswordContent: React.FC<{
  emailForPasswordReset: string;
  handlePasswordReset: () => void;
}> = ({ emailForPasswordReset, handlePasswordReset }) => (
  <>
    <AuthHeader 
      icon={<LockIcon />}
      title="Create new password" 
      subtitle={`Set a new password for<br/><span class="font-medium text-gray-900 dark:text-gray-200">${emailForPasswordReset}</span>`} 
    />
    
    <AnimatedFormWrapper>
      <ResetPasswordForm
        email={emailForPasswordReset}
        handlePasswordReset={handlePasswordReset}
      />
    </AnimatedFormWrapper>
  </>
);

// Main Authentication Component
const Authentication: React.FC = () => {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [emailForOTP, setEmailForOTP] = useState('');
  const [emailForPasswordReset, setEmailForPasswordReset] = useState(''); 
  const [infoMessage, setInfoMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading to show animations
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const toggleAuthMode = () => {
    setAuthMode((prevMode) => (prevMode === 'login' ? 'signup' : 'login'));
    setInfoMessage('');
  };

  const startOtpVerification = (email: string) => {
    setEmailForOTP(email);
    setAuthMode('otpVerification');
  };

  const handleOtpVerified = () => {
    setInfoMessage('Email verified successfully. You can now log in.');
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <motion.div
          animate={{ 
            rotate: 360,
            scale: [1, 1.2, 1],
          }}
          transition={{ 
            rotate: { duration: 1.5, ease: "linear", repeat: Infinity },
            scale: { duration: 1, repeat: Infinity }
          }}
        >
          <DebateIcon />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row w-screen h-screen overflow-hidden">
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
        setAuthMode={setAuthMode}
      />
    </div>
  );
};

export default Authentication;