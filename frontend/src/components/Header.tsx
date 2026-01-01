import React, { useState, useContext } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Bell, Menu, X, Home, BarChart, User, Info, LogOut } from "lucide-react";
import { useAtom } from "jotai";
import { userAtom } from "@/state/userAtom";
import { AuthContext } from "@/context/authContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

function Header() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const location = useLocation();
  const [user] = useAtom(userAtom);
  const auth = useContext(AuthContext);

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
          <button className="relative">
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute -top-1 -right-1 block h-2 w-2 rounded-full bg-red-500" />
          </button>
          
          <Popover>
            <PopoverTrigger asChild>
              <button className="focus:outline-none">
                <img
                  src={user?.avatarUrl || avatarImage}
                  alt="User avatar"
                  className="w-8 h-8 rounded-full border-2 border-gray-300 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src={user?.avatarUrl || avatarImage}
                    alt="User avatar"
                    className="w-12 h-12 rounded-full border-2 border-gray-200 object-cover"
                  />
                  <div className="overflow-hidden">
                    <h4 className="font-semibold text-gray-900 truncate">{user?.displayName || "User"}</h4>
                    <p className="text-sm text-gray-500 truncate">{user?.email || "No email"}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">User ID</span>
                    <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700 truncate max-w-[150px]" title={user?.id}>
                      {user?.id || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Rating</span>
                    <span className="font-medium text-blue-600">{user?.rating ? Math.round(user.rating) : 1500}</span>
                  </div>
                </div>
              </div>
              <div className="p-2">
                <button
                  onClick={() => auth?.logout()}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </PopoverContent>
          </Popover>

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
