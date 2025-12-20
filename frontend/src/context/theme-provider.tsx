import React, { useEffect, useState } from "react";

export enum ThemeOptions {
    Light,
    Dark,
    Contrast
}

interface ThemeContextStructure {
    //learned function types
    theme: ThemeOptions, toggleTheme: () => void
}

var defaultThemeContext: ThemeContextStructure = {
    theme: ThemeOptions.Light,
    toggleTheme: () => { }
}
export const ThemeContext = React.createContext<ThemeContextStructure>(defaultThemeContext);

//learned how to validate a value, if it is the part of enum
function validateThemeCode(themeCode: number): boolean {
    return Object.values(ThemeOptions).includes(themeCode);
}


function getInitialTheme() {
    //get theme to browser default
    let newTheme: ThemeOptions;

    let systemThemeCodeStr = localStorage.getItem("Theme");
    if (systemThemeCodeStr == null) {
        let defaultBrowserTheme = window.matchMedia("(prefers-color-scheme: light)").matches ? ThemeOptions.Light : ThemeOptions.Dark;
        newTheme = defaultBrowserTheme;
    }
    else {
        //learned importance of validation
        //validation is for the code which other people will write on top of mine
        let systemThemeCode = +systemThemeCodeStr;
        if (validateThemeCode(systemThemeCode)) {
            //learned value to its correlated enum
            newTheme = systemThemeCode as ThemeOptions;
        }
        else {
            newTheme = ThemeOptions.Light;
        }
    }

    return newTheme;
}
export function ThemeProvider({ children }: { children: any }): any {
    const [theme, setTheme] = useState<ThemeOptions>(getInitialTheme());

    useEffect(() => {
    const bodyElement = document.body;
    bodyElement.classList.remove("dark", "contrast");
    const className = ThemeOptions[theme].toLowerCase(); // "light", "dark", or "contrast"
    bodyElement.classList.add(className);
    localStorage.setItem("Theme", String(theme));
}, [theme])
    function toggleTheme() {
        const enumCount = Object.values(ThemeOptions).filter(x => typeof x === "number").length;
        setTheme((prev) => (prev + 1) % enumCount);
    }
    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}
