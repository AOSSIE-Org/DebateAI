import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface ForgotPasswordFormProps {
  startResetPassword: (email: string) => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ startResetPassword }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false); // New state to track button status

  const baseURL = import.meta.env.VITE_BASE_URL;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${baseURL}/forgotPassword`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json(); // Parse JSON response

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send reset password code. Please try again.');
      }

      toast.success('Reset password code sent successfully!');
      startResetPassword(email);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again later.');
      toast.error(err.message || 'Error sending reset code. Please check your email.');
    } finally {
      setIsSubmitting(false);
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
        <h3 className="text-2xl font-medium my-4">Reset Password</h3>
        <p className="mb-4">Enter your email to receive a password reset code.</p>
        <form onSubmit={handleSubmit} className="w-full">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-full mb-4"
          />
          {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Sending...' : 'Send Reset Code'}
          </Button>
        </form>
      </div>
    </>
  );
};
