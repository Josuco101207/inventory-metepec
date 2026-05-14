import React, { createContext, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('darkMode');
  }, []);

  return (
    <ThemeContext.Provider value={{ isDarkMode: false, toggleDarkMode: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
};
