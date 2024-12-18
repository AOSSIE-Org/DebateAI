import { useState } from "react";
import { IoMenuOutline } from "react-icons/io5";

export default function Navbar() {
  const [isNavOpen, setIsNavOpen] = useState(false);

  const toggleNav = () => {
    console.log("Toggle Nav Clicked");
    setIsNavOpen(!isNavOpen);
  };

  return (
    <div
      className={`px-10 md:px-16 lg:px-24 
      flex justify-between items-center border-b border-black dark:border-blue-950 backdrop-blur-xl uppercase fixed top-0 w-full z-50`}
    >
      <a
        href="/"
        className="flex items-center py-5 text-lg font-semibold tracking-wide"
      >
        Debate AI
      </a>

      <div className="hidden lg:flex lg:items-center gap-8 font-medium text-sm tracking-wider">
        <a className="hover:underline underline-offset-4 decoration-1" href="/">
          Home
        </a>
        <a
          className="hover:underline underline-offset-4 decoration-1"
          href="/features"
        >
          Features
        </a>
        <a
          className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg hover:underline underline-offset-4 decoration-1"
          href="/login"
        >
          <div className="flex items-center gap-2 py-2 px-4">
            <img
              src="../../public/vector.svg"
              alt="Try Now Icon"
              className="w-4 h-4"
            />
            <span>Try Now</span>
          </div>
        </a>
      </div>

      <div
        onClick={toggleNav}
        className="lg:hidden flex items-center justify-center cursor-pointer"
      >
        <IoMenuOutline className="text-xl" />
      </div>

      {isNavOpen && (
        <div className="absolute top-full left-0 w-full backdrop-blur-xl bg-black flex flex-col gap-4 py-4 px-6 border-t border-black dark:border-blue-950 z-40">
          <a
            className="hover:underline underline-offset-4 decoration-1"
            href="/"
          >
            Home
          </a>
          <a
            className="hover:underline underline-offset-4 decoration-1"
            href="/features"
          >
            Features
          </a>
          <a
            className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg hover:underline underline-offset-4 decoration-1"
            href="/login"
          >
            <div className="flex items-center gap-2 py-2 px-4">
              <img
                src="../../public/vector.svg"
                alt="Try Now Icon"
                className="w-4 h-4"
              />
              <span>Try Now</span>
            </div>
          </a>
        </div>
      )}
    </div>
  );
}
