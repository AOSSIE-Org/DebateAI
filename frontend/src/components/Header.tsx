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
} from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import debateAiLogo from "@/assets/aossie.png";
import avatarImage from "@/assets/avatar2.jpg";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  Notification,
} from "@/services/notificationService";

function Header() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [user] = useAtom(userAtom);
  const auth = useContext(AuthContext);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const toggleDrawer = () => setIsDrawerOpen(!isDrawerOpen);

  const fetchNotifications = async () => {
    if (user) {
      const data = await getNotifications();
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.isRead).length);
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
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    if (notification.link) {
      navigate(notification.link);
      setIsNotificationsOpen(false);
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    // Update unread count if the deleted notification was unread
    const notification = notifications.find((n) => n.id === id);
    if (notification && !notification.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
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
      <header className="flex items-center justify-between h-16 px-4 border-b border-border">
        <div className="text-lg font-semibold">{getBreadcrumbs()}</div>
        <div className="flex items-center gap-4">
          <Popover open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
            <PopoverTrigger asChild>
              <button className="relative focus:outline-none">
                <Bell className="w-5 h-5 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 block h-2 w-2 rounded-full bg-red-500" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h4 className="font-semibold text-foreground">Notifications</h4>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-8 px-2 text-primary hover:text-primary/80"
                    onClick={handleMarkAllRead}
                  >
                    Mark all read
                  </Button>
                )}
              </div>
              <ScrollArea className="h-[300px]">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No notifications yet
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 hover:bg-muted cursor-pointer transition-colors relative group ${
                          !notification.isRead ? "bg-primary/10" : ""
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <button
                          onClick={(e) =>
                            handleDeleteNotification(e, notification.id)
                          }
                          className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete notification"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <div className="flex gap-3">
                          <div
                            className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${
                              !notification.isRead
                                ? "bg-primary"
                                : "bg-transparent"
                            }`}
                          />
                          <div className="flex-1 space-y-1 pr-4">
                            <p className="text-sm font-medium leading-none text-foreground">
                              {notification.title}
                            </p>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground/70">
                              {new Date(
                                notification.createdAt
                              ).toLocaleDateString()}
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
                  className="w-8 h-8 rounded-full border-2 border-border object-cover cursor-pointer hover:opacity-80 transition-opacity"
                />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src={user?.avatarUrl || avatarImage}
                    alt="User avatar"
                    className="w-12 h-12 rounded-full border-2 border-border object-cover"
                  />
                  <div className="overflow-hidden">
                    <h4 className="font-semibold text-foreground truncate">
                      {user?.displayName || "User"}
                    </h4>
                    <p className="text-sm text-muted-foreground truncate">
                      {user?.email || "No email"}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">User ID</span>
                    <span
                      className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground truncate max-w-[150px]"
                      title={user?.id}
                    >
                      {user?.id || "N/A"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Rating</span>
                    <span className="font-medium text-primary">
                      {user?.rating ? Math.round(user.rating) : 1500}
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-2">
                <button
                  onClick={() => auth?.logout()}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </PopoverContent>
          </Popover>

          <button
            onClick={toggleDrawer}
            className="md:hidden p-2 rounded-md text-muted-foreground hover:bg-muted"
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
          <div className="relative w-64 h-full bg-background shadow-lg transform transition-transform duration-300 ease-in-out translate-x-0 ml-auto">
            <div className="flex items-center justify-between h-16 px-4 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-foreground">
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
                className="p-2 text-muted-foreground hover:text-foreground"
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
            ? "bg-secondary text-secondary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

export default Header;
