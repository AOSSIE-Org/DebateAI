import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState, useContext } from 'react';
import { AuthContext } from '../../context/authContext';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface ResetPasswordFormProps {
  email: string;
  handlePasswordReset: () => void;
}

export const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({ email, handlePasswordReset }) => {
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [localError, setLocalError] = useState(''); // Local error handling

  const authContext = useContext(AuthContext);
  if (!authContext) {
    throw new Error('ResetPasswordForm must be used within an AuthProvider');
  }

  const { confirmForgotPassword, login, error, loading } = authContext;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!code.trim()) {
      toast.error('Please enter the verification code.');
      return;
    }
    if (!newPassword || !confirmNewPassword) {
      toast.error('Password fields cannot be empty.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    try {
      await confirmForgotPassword(email, code, newPassword);
      await login(email, newPassword);
      toast.success('Password reset successfully!');
      handlePasswordReset();
    } catch (err: any) {
      setLocalError(err.message || 'Failed to reset password. Please try again.');
      toast.error(err.message || 'Failed to reset password. Please try again.');
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
        <h3 className="text-2xl font-medium my-4">Reset Your Password</h3>
        <form onSubmit={handleSubmit} className="w-full">
          <Input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter Code"
            className="w-full mb-2"
          />
          <Input
            type={passwordVisible ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New Password"
            className="w-full mb-2"
          />
          <Input
            type={passwordVisible ? 'text' : 'password'}
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            placeholder="Confirm New Password"
            className="w-full mb-4"
          />
          <div className="w-full flex items-center gap-2 pl-1">
            <input
              type="checkbox"
              id="showPassword"
              checked={passwordVisible}
              onChange={(e) => setPasswordVisible(e.target.checked)}
              className="cursor-pointer"
            />
            <label htmlFor="showPassword" className="cursor-pointer">
              Show password
            </label>
          </div>
          {(localError || error) && <p className="text-sm text-red-500 mb-2">{localError || error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Resetting Password...' : 'Reset Password'}
          </Button>
        </form>
      </div>
    </>
  );
};
