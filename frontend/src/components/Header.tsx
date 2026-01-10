import React, { useState, useContext, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { 
  Bell, 
  Menu, 
  X, 
  Home, 
  BarChart, 
  User, 
  Info, 
  LogOut, 
  Check,
  MessageSquare,
  Trophy,
  Users,
  MessageCircle,
  Sun,
  Moon
} from "lucide-react";
import { useAtom } from "jotai";
import { userAtom } from "@/state/userAtom";
import { AuthContext } from "@/context/authContext";
import { ThemeContext, ThemeOptions } from "@/context/theme-provider";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import debateAiLogo from "@/assets/aossie.png";
import avatarImage from "@/assets/avatar2.jpg";
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification, Notification } from "@/services/notificationService";

function Header() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [user] = useAtom(userAtom);
  const auth = useContext(AuthContext);
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const toggleDrawer = () => setIsDrawerOpen(!isDrawerOpen);

  const themeOptions = [
    { id: ThemeOptions.Light, name: "Light", icon: <Sun className="w-4 h-4" /> },
    { id: ThemeOptions.Dark, name: "Dark", icon: <Moon className="w-4 h-4" /> },
  ];

  const setTheme = (targetId: number) => {
    const current = theme;
    const totalThemes = Object.keys(ThemeOptions).length / 2;
    const clicks = (targetId - current + totalThemes) % totalThemes;
    for (let i = 0; i < clicks; i++) toggleTheme();
  };

  const fetchNotifications = async () => {
    if (user) {
      const data = await getNotifications();
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.isRead).length);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll for notifications every minute
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markNotificationAsRead(notification.id);
      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    
    if (notification.link) {
      navigate(notification.link);
      setIsNotificationsOpen(false);
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteNotification(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    // Update unread count if the deleted notification was unread
    const notification = notifications.find(n => n.id === id);
    if (notification && !notification.isRead) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

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
      <header className="flex items-center justify-between h-20 px-6 border-b border-gray-200 dark:border-gray-700 shadow-2xl bg-white dark:bg-gray-900" style={{ boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1)' }}>
        {/* Left: Logo */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-3xl font-bold text-gray-900 dark:text-white">DebateAI by</span>
          <img
            src={debateAiLogo}
            alt="DebateAI Logo"
            className="h-12 w-auto object-contain"
          />
        </div>
        
        {/* Center: Navigation Items */}
        <nav className="hidden lg:flex items-center justify-center space-x-8 flex-1">
          <NavLink
            to="/startDebate"
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-3 text-lg font-medium rounded-md transition-colors ${
                isActive
                  ? "bg-secondary text-secondary-foreground"
                  : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
              }`
            }
          >
            <MessageSquare className="h-5 w-5" />
            Start Debate
          </NavLink>
          <NavLink
            to="/tournaments"
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-3 text-lg font-medium rounded-md transition-colors ${
                isActive
                  ? "bg-secondary text-secondary-foreground"
                  : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
              }`
            }
          >
            <Trophy className="h-5 w-5" />
            Tournaments
          </NavLink>
          <NavLink
            to="/team-builder"
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-3 text-lg font-medium rounded-md transition-colors ${
                isActive
                  ? "bg-secondary text-secondary-foreground"
                  : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
              }`
            }
          >
            <Users className="h-5 w-5" />
            Team Debates
          </NavLink>
          <NavLink
            to="/leaderboard"
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-3 text-lg font-medium rounded-md transition-colors ${
                isActive
                  ? "bg-secondary text-secondary-foreground"
                  : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
              }`
            }
          >
            <BarChart className="h-5 w-5" />
            Leaderboard
          </NavLink>
          <NavLink
            to="/community"
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-3 text-lg font-medium rounded-md transition-colors ${
                isActive
                  ? "bg-secondary text-secondary-foreground"
                  : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
              }`
            }
          >
            <MessageCircle className="h-5 w-5" />
            Community
          </NavLink>
          <NavLink
            to="/about"
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-3 text-lg font-medium rounded-md transition-colors ${
                isActive
                  ? "bg-secondary text-secondary-foreground"
                  : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
              }`
            }
          >
            <Info className="h-5 w-5" />
            About
          </NavLink>
        </nav>

        {/* Right: User Controls */}
        <div className="flex items-center gap-6 flex-shrink-0">
          <Popover open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
            <PopoverTrigger asChild>
              <button className="relative focus:outline-none">
                <Bell className="w-7 h-7 text-gray-600 dark:text-gray-300" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 block h-2 w-2 rounded-full bg-red-500" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <h4 className="font-semibold text-gray-900">Notifications</h4>
                {unreadCount > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs h-8 px-2 text-blue-600 hover:text-blue-800"
                    onClick={handleMarkAllRead}
                  >
                    Mark all read
                  </Button>
                )}
              </div>
              <ScrollArea className="h-[300px]">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    No notifications yet
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {notifications.map((notification) => (
                      <div 
                        key={notification.id}
                        className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors relative group ${!notification.isRead ? 'bg-blue-50/50' : ''}`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <button
                          onClick={(e) => handleDeleteNotification(e, notification.id)}
                          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete notification"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <div className="flex gap-3">
                          <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${!notification.isRead ? 'bg-blue-500' : 'bg-transparent'}`} />
                          <div className="flex-1 space-y-1 pr-4">
                            <p className="text-sm font-medium leading-none text-gray-900">
                              {notification.title}
                            </p>
                            <p className="text-sm text-gray-500 line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(notification.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>
          
          <Popover>
            <PopoverTrigger asChild>
              <button className="focus:outline-none">
                <img
                  src={user?.avatarUrl || avatarImage}
                  alt="User avatar"
                  className="w-12 h-12 rounded-full border-2 border-gray-300 dark:border-gray-600 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600" align="end">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src={user?.avatarUrl || avatarImage}
                    alt="User avatar"
                    className="w-12 h-12 rounded-full border-2 border-gray-200 dark:border-gray-600 object-cover"
                  />
                  <div className="overflow-hidden">
                    <h4 className="font-semibold text-gray-900 dark:text-white truncate">{user?.displayName || "User"}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user?.email || "No email"}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">User ID</span>
                    <span className="font-mono text-xs bg-gray-100 dark:bg-gray-600 px-2 py-0.5 rounded text-gray-700 dark:text-gray-200 truncate max-w-[150px]" title={user?.id}>
                      {user?.id || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Rating</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400">{user?.rating ? Math.round(user.rating) : 1500}</span>
                  </div>
                </div>
              </div>
              <div className="p-2 bg-white dark:bg-gray-800">
                <NavLink
                  to="/profile"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
                >
                  <User className="w-4 h-4" />
                  View Profile
                </NavLink>
                
                {/* Theme Selection */}
                <div className="border-t border-gray-100 dark:border-gray-600 mt-2 pt-2">
                  <div className="px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Theme
                  </div>
                  {themeOptions.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setTheme(option.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                        theme === option.id
                          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700"
                          : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }`}
                    >
                      {option.icon}
                      <span className="font-medium">{option.name}</span>
                      {theme === option.id && <Check className="w-3 h-3 ml-auto text-blue-600 dark:text-blue-400" />}
                    </button>
                  ))}
                </div>
                
                <div className="border-t border-gray-100 dark:border-gray-600 mt-2 pt-2">
                  <button
                    onClick={() => auth?.logout()}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <button
            onClick={toggleDrawer}
            className="lg:hidden p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Open menu"
          >
            <Menu className="h-7 w-7" />
          </button>
        </div>
      </header>

      {isDrawerOpen && (
        <div className="fixed inset-0 z-[1000] lg:hidden">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={toggleDrawer}
          ></div>
          <div className="relative w-64 h-full bg-white dark:bg-gray-900 shadow-lg transform transition-transform duration-300 ease-in-out translate-x-0 ml-auto">
            <div className="flex items-center justify-between h-20 px-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                  DebateAI by
                </span>
                <img
                  src={debateAiLogo}
                  alt="DebateAI Logo"
                  className="h-12 w-auto object-contain"
                />
              </div>
              <button
                onClick={toggleDrawer}
                className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                aria-label="Close menu"
              >
                <X className="h-7 w-7" />
              </button>
            </div>
            <nav className="flex-1 px-4 py-6 space-y-3">
              <NavItem
                to="/startDebate"
                label="Start Debate"
                icon={<MessageSquare className="mr-4 h-6 w-6" />}
                onClick={toggleDrawer}
              />
              <NavItem
                to="/tournaments"
                label="Tournaments"
                icon={<Trophy className="mr-4 h-6 w-6" />}
                onClick={toggleDrawer}
              />
              <NavItem
                to="/team-builder"
                label="Team Debates"
                icon={<Users className="mr-4 h-6 w-6" />}
                onClick={toggleDrawer}
              />
              <NavItem
                to="/leaderboard"
                label="Leaderboard"
                icon={<BarChart className="mr-4 h-6 w-6" />}
                onClick={toggleDrawer}
              />
              <NavItem
                to="/community"
                label="Community"
                icon={<MessageCircle className="mr-4 h-6 w-6" />}
                onClick={toggleDrawer}
              />
              <NavItem
                to="/profile"
                label="Profile"
                icon={<User className="mr-4 h-6 w-6" />}
                onClick={toggleDrawer}
              />
              <NavItem
                to="/about"
                label="About"
                icon={<Info className="mr-4 h-6 w-6" />}
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
        `group flex items-center px-4 py-4 text-lg font-medium rounded-md ${
          isActive
            ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white"
            : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

export default Header;
