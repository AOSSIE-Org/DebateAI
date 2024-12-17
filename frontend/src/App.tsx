import { useContext } from 'react'
import './App.css'
import AuthenticationPage from './Pages/Authentication'
import { ThemeProvider, ThemeContext } from './context/theme-provider'
import { Button } from './components/ui/button'
import { LuMoon } from "react-icons/lu";
import { LuSun } from "react-icons/lu";

function Subscriber(): JSX.Element {
  const value = useContext(ThemeContext);
  return(
    <Button onClick={value!.toggleTheme} className='p-0 h-8 w-8 md:h-12 md:w-12 fixed right-4 bottom-4'>
      {value?.theme ? <LuMoon className='text-xl'/> : <LuSun className="text-xl"/>}
    </Button>
  )
}

function App() {
  return (
    <div>
      <ThemeProvider>
        <AuthenticationPage></AuthenticationPage>
        <Subscriber></Subscriber>
      </ThemeProvider>
    </div>
  )
}

export default App