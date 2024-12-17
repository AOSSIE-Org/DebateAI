import { LoginForm } from "./Authentication/form"
const Authentication = () => {
  return (
    <div className='flex w-screen h-screen box-border'>
 {/* overflow-hidden */}
      <div className='hidden md:flex w-full h-full justify-center items-center'>keshav</div>
      <div className='flex items-center justify-center w-full h-full'>
        <div className='flex flex-col items-center justify-center h-full w-3/4 text-center'>
          <LoginForm></LoginForm>
          <div className='flex items-center w-1/2'>
            <div className="bg-border h-px w-full" />
            <p className='text-xs mx-2 w-full'>OR CONTINUE WITH</p>
            <div className="bg-border h-px w-full" />
          </div>
          {/* todo */}
          <p>By clicking continue, you agree to our <a href='https://www.optmyzr.com' target='_blank'>Terms of Service</a> and <a>Privacy Policy</a>.</p>
        </div>
      </div>
    </div>
  )
}

export default Authentication