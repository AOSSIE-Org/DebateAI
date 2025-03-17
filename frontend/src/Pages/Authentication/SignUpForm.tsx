import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useContext, useState } from 'react';
import { AuthContext } from '../../context/authContext';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface SignUpFormProps {
  startOtpVerification: (email: string) => void;
}

export const SignUpForm: React.FC<SignUpFormProps> = ({ startOtpVerification }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const authContext = useContext(AuthContext);

  if (!authContext) {
    throw new Error('SignUpForm must be used within an AuthProvider');
  }

  const { signup } = authContext;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password || !confirmPassword) {
      toast.error('All fields are required');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      await signup(email, password);
      toast.success('Signup successful! Verification email sent.');
      startOtpVerification(email);
    } catch (err: any) {
      toast.error(err.message || 'Signup failed. Please try again.');
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
          className="mb-2"
        />
        <Input
          type={passwordVisible ? "text" : "password"}
          placeholder="confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="mb-4"
        />
        <div className='w-full flex justify-start items-center pl-1'>
          <div className='w-4'>
            <Input
              type='checkbox'
              checked={passwordVisible}
              onChange={(e) => setPasswordVisible(e.target.checked)}
            />
          </div>
          <div className='pl-2'>Show password</div>
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Creating Account...' : 'Sign Up With Email'}
        </Button>
      </form>
    </>
  );
};
