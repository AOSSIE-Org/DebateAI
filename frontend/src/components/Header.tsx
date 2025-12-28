import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Bell, Menu, X, Home, BarChart, User, Info } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import debateAiLogo from "@/assets/aossie.png";
import avatarImage from "@/assets/avatar2.jpg";
import { ThemeToggle } from "./ThemeToggle";

function Header() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const location = useLocation();

  const toggleDrawer = () => setIsDrawerOpen(!isDrawerOpen);

  const getBreadcrumbs = () => {
    const pathnames = location.pathname.split("/").filter((x) => x);
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <NavLink to="/">Home</NavLink>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {pathnames.map((value, index) => {
            const to = `/${pathnames.slice(0, index + 1).join("/")}`;
            const isLast = index === pathnames.length - 1;
            return (
              <React.Fragment key={to}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage className="capitalize">
                      {value.replace("-", " ")}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <NavLink to={to} className="capitalize">
                        {value.replace("-", " ")}
                      </NavLink>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    );
  };

  return (
    <>
      <header className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
        <div className="text-lg font-semibold">{getBreadcrumbs()}</div>
        <div className="flex items-center gap-4">
          <ThemeToggle className="hidden md:block" />
          <button className="relative">
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute -top-1 -right-1 block h-2 w-2 rounded-full bg-red-500" />
          </button>
          <img
            src={avatarImage}
            alt="User avatar"
            className="w-8 h-8 rounded-full border-2 border-gray-300 object-cover"
          />
          <button
            onClick={toggleDrawer}
            className="md:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </header>

      {isDrawerOpen && (
        <div className="fixed inset-0 z-[1000] md:hidden">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={toggleDrawer}
          ></div>
          <div className="relative w-64 h-full bg-white shadow-lg transform transition-transform duration-300 ease-in-out translate-x-0 ml-auto">
            <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-gray-900">
                  DebateAI by
                </span>
                <img
                  src={debateAiLogo}
                  alt="DebateAI Logo"
                  className="h-8 w-auto object-contain"
                />
              </div>
              <button
                onClick={toggleDrawer}
                className="p-2 text-gray-600 hover:text-gray-900"
                aria-label="Close menu"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="flex-1 px-2 py-4 space-y-2">
              <NavItem
                to="/startDebate"
                label="Home"
                icon={<Home className="mr-3 h-4 w-4" />}
                onClick={toggleDrawer}
              />
              <NavItem
                to="/leaderboard"
                label="Leaderboard"
                icon={<BarChart className="mr-3 h-4 w-4" />}
                onClick={toggleDrawer}
              />
              <NavItem
                to="/profile"
                label="Profile"
                icon={<User className="mr-3 h-4 w-4" />}
                onClick={toggleDrawer}
              />
              <NavItem
                to="/about"
                label="About"
                icon={<Info className="mr-3 h-4 w-4" />}
                onClick={toggleDrawer}
              />
              <ThemeToggle className="w-full" />
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

interface NavItemProps {
  to: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

function NavItem({ to, label, icon, onClick }: NavItemProps) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
          isActive
            ? "bg-gray-200 text-gray-900"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

export default Header;
