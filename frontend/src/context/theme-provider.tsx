import React, { useEffect, useState } from 'react'

enum ThemeOptions {
  Light,
  Dark,
}

interface ThemeContextStructure {
  //learned function types
  theme: ThemeOptions
  toggleTheme: () => void
}

const defaultThemeContext: ThemeContextStructure = {
  theme: ThemeOptions.Light,
  toggleTheme: () => {},
}
export const ThemeContext =
  React.createContext<ThemeContextStructure>(defaultThemeContext)

//learned how to validate a value, if it is the part of enum
function validateThemeCode(themeCode: number): boolean {
  return Object.values(ThemeOptions).includes(themeCode)
}

function getInitialTheme() {
  //get theme to browser default
  let newTheme: ThemeOptions

  const systemThemeCodeStr = localStorage.getItem('Theme')
  if (systemThemeCodeStr == null) {
    const defaultBrowserTheme = window.matchMedia(
      '(prefers-color-scheme: light)'
    ).matches
      ? ThemeOptions.Light
      : ThemeOptions.Dark
    console.log(defaultBrowserTheme)
    newTheme = defaultBrowserTheme
  } else {
    //learned importance of validation
    //validation is for the code which other people will write on top of mine
    const systemThemeCode = +systemThemeCodeStr
    console.log(validateThemeCode(systemThemeCode))
    if (validateThemeCode(systemThemeCode)) {
      //learned value to its correlated enum
      newTheme = systemThemeCode as ThemeOptions
      console.log('storage', newTheme)
    } else {
      newTheme = ThemeOptions.Light
    }
  }

  return newTheme
}
export function ThemeProvider({ children }: { children: any }): any {
  const [theme, setTheme] = useState<ThemeOptions>(getInitialTheme())

  useEffect(() => {
    //add a set function which will update the local storage.
    const bodyElement = document.body
    if (theme == ThemeOptions.Light) {
      localStorage.setItem('Theme', String(ThemeOptions.Light))
      bodyElement.classList.remove('dark')
    } else {
      localStorage.setItem('Theme', String(ThemeOptions.Dark))
      bodyElement.classList.add('dark')
    }
  }, [theme])
  function toggleTheme() {
    if (theme == ThemeOptions.Dark) {
      setTheme(ThemeOptions.Light)
    } else {
      setTheme(ThemeOptions.Dark)
    }
  }
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
