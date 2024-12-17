import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
//serp og tag, meta tags seo
// google console
export const LoginForm = () => {
  return (
    <div>
      <div>
      <h3 className='text-2xl font-medium	'>
        Create an account
      </h3>
      <p>Enter your email below to create your account</p>
      </div>

      <form className='flex flex-col'>
        <Input type="text" placeholder="name@example.com"></Input>
        <Button type="submit">Sign In With Email</Button>
      </form>
      
      
    </div>

  )
}
export const SignUpForm = () => {
  return (
    <div>Form</div>
  )
}