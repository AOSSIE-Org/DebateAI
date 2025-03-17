import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useContext, useState } from 'react';
import { AuthContext } from '../../context/authContext';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface OTPVerificationFormProps {
  email: string;
  handleOtpVerified: () => void;
}

export const OTPVerificationForm: React.FC<OTPVerificationFormProps> = ({ email, handleOtpVerified }) => {
  const [otp, setOtp] = useState('');
  const [localError, setLocalError] = useState(''); // Local error handling

  const authContext = useContext(AuthContext);
  if (!authContext) {
    throw new Error('OTPVerificationForm must be used within an AuthProvider');
  }

  const { verifyEmail, error, loading } = authContext;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!otp.trim()) {
      toast.error('Please enter a valid OTP');
      return;
    }

    try {
      await verifyEmail(email, otp);
      toast.success('OTP verified successfully!');
      handleOtpVerified();
    } catch (err: any) {
      setLocalError(err.message || 'Invalid OTP. Please try again.');
      toast.error(err.message || 'Invalid OTP. Please try again.');
    }
  };

  return (
    <>
      <ToastContainer
        position="top-center"
        autoClose={4000}
        hideProgressBar={false}
        closeOnClick
        pauseOnHover
        draggable
        theme="dark"
        toastStyle={{
          boxShadow: '0px 10px 10px rgba(247, 240, 240, 0.99)',
          borderRadius: '10px',
          transition: 'all 0.3s ease-in-out',
        }}
      />
      <div className="w-full flex flex-col items-center">
        <h3 className="text-2xl font-medium my-4">Verify Your Email</h3>
        <p className="mb-4">Enter the OTP sent to your email to complete the sign-up process.</p>
        <form onSubmit={handleSubmit} className="w-full">
          <Input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="Enter OTP"
            className="w-full mb-4"
          />
          {(localError || error) && <p className="text-sm text-red-500 mb-2">{localError || error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </Button>
        </form>
      </div>
    </>
  );
};
