import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, X, Moon, Sun } from "lucide-react"; // Import Moon and Sun icons
import { Button } from "@/components/ui/button";

interface NavLinkProps {
  to: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const NavLink: React.FC<NavLinkProps> = ({ to, children, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    className="text-white dark:text-gray-900 text-lg font-medium hover:text-neutral-400 dark:hover:text-red-600 transition duration-300"
  >
    {children}
  </Link>
);

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false); // State for dark mode

  // Toggle dark mode
  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  // Apply dark mode class to the root element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Handle scroll for navbar shadow
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled ? "shadow-lg" : ""
        }`}
      >
        <div className="bg-gray-900 dark:bg-white border-b border-gray-800 dark:border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              {/* Logo */}
              <div className="flex-shrink-0 flex items-center">
                <Link
                  to="/"
                  className="text-2xl font-bold text-white dark:text-gray-900 flex items-center"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-2 h-6 w-6"
                  >
                    <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
                  </svg>
                  Debate AI
                </Link>
              </div>

              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center space-x-8">
                <NavLink to="/">Home</NavLink>

                {/* Dark Mode Toggle Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleDarkMode}
                  className="text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200"
                >
                  {isDarkMode ? (
                    <Sun className="h-5 w-5" /> // Sun icon for light mode
                  ) : (
                    <Moon className="h-5 w-5" /> // Moon icon for dark mode
                  )}
                </Button>

                <Button className="bg-neutral-600 dark:bg-blue-600 hover:bg-neutral-700 dark:hover:bg-blue-700 text-white">
                  Login
                </Button>
              </div>

              {/* Mobile menu button */}
              <div className="md:hidden flex items-center">
                <button
                  onClick={() => setIsOpen(!isOpen)}
                  className="text-white dark:text-gray-900 hover:text-gray-300 dark:hover:text-gray-600 p-2"
                >
                  <span className="sr-only">Open menu</span>
                  {isOpen ? (
                    <X className="h-6 w-6" />
                  ) : (
                    <Menu className="h-6 w-6" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div
          className={`md:hidden fixed inset-0 z-50 bg-gray-900 dark:bg-white transform transition-transform duration-300 ease-in-out ${
            isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="pt-16 pb-6 px-4 space-y-6">
            <NavLink to="/" onClick={() => setIsOpen(false)}>
              Home
            </NavLink>
            <NavLink to="/feature" onClick={() => setIsOpen(false)}>
              Feature
            </NavLink>
            <NavLink to="/about" onClick={() => setIsOpen(false)}>
              About
            </NavLink>

            {/* Dark Mode Toggle Button for Mobile */}
            <Button
              variant="ghost"
              className="w-full flex items-center justify-center text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200"
              onClick={() => {
                toggleDarkMode();
                setIsOpen(false);
              }}
            >
              {isDarkMode ? (
                <Sun className="h-5 w-5 mr-2" /> // Sun icon for light mode
              ) : (
                <Moon className="h-5 w-5 mr-2" /> // Moon icon for dark mode
              )}
              {isDarkMode ? "Light Mode" : "Dark Mode"}
            </Button>

            <Button
              className="w-full bg-neutral-600 dark:bg-blue-600 hover:bg-neutral-700 dark:hover:bg-blue-700 text-white"
              onClick={() => setIsOpen(false)}
            >
              Login
            </Button>
          </div>
        </div>
      </nav>

      {/* Overlay for mobile menu */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default Navbar;