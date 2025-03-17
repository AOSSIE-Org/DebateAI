import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useContext, useState } from 'react';
import { AuthContext } from '../../context/authContext'; // Adjust import path
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface LoginFormProps {
  startForgotPassword: () => void;
  infoMessage?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({ startForgotPassword, infoMessage }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const authContext = useContext(AuthContext);

  if (!authContext) {
    throw new Error('LoginForm must be used within an AuthProvider');
  }

  const { login, error, loading } = authContext ?? {};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter both email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await login(email, password);
      
      if (response && response.error) {
        toast.error(response.error);
      } else {
        toast.success("Login successful!");
      }
    } catch (err) {
      toast.error("Unsuccessful Login!");
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
      <form className="w-full" onSubmit={handleSubmit}>
        {infoMessage && <p className="text-sm text-green-500 mb-2">{infoMessage}</p>}
        <Input
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-2"
        />
        <Input
          type={passwordVisible ? "text" : "password"}
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-1"
        />
        <div className='w-full flex justify-start items-center pl-1'>
          <div className='w-4'>
            <Input
              type='checkbox'
              checked={passwordVisible}
              onChange={(e) => setPasswordVisible(e.target.checked)}
            />
          </div>
          <div className='pl-2'>show password</div>
        </div>
        {error && <p className="text-sm text-red-500 mb-2">{error}</p>}
        <p className="text-sm text-muted mb-4">
          Forgot your password?{' '}
          <span className="underline cursor-pointer" onClick={startForgotPassword}>
            Reset Password
          </span>
        </p>
        <Button type="submit" className="w-full" disabled={loading || isSubmitting}>
          {loading || isSubmitting ? 'Signing In...' : 'Sign In With Email'}
        </Button>
      </form>
    </>
  );
};