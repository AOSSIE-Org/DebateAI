// src/components/Sidebar.tsx
// src/components/Sidebar.tsx
import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  MessageSquare,
  BarChart,
  User,
  Info,
  Trophy,
  Users,
  MessageCircle,
  Heart,
  Menu,
} from 'lucide-react';
import debateAiLogo from '@/assets/aossie.png';
import { ThemeToggle } from './ThemeToggle';

function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sidebarCollapsed') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('sidebarCollapsed', String(isCollapsed));
    } catch {
      // ignore storage errors
    }
  }, [isCollapsed]);

  return (
    <aside
      className={`hidden lg:flex flex-col border-r border-border bg-background transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo / Brand + hamburger */}
      <div className='flex items-center h-16 px-4 border-b border-border gap-2'>
        <button
          onClick={() => setIsCollapsed((v) => !v)}
          className='p-1 rounded-md hover:bg-muted text-foreground transition-colors'
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Menu className='h-5 w-5' />
        </button>
        {!isCollapsed && (
          <div className='flex items-center gap-2 overflow-hidden'>
            <span className='text-xl font-bold whitespace-nowrap'>DebateAI by</span>
            <a
              href='https://aossie.org'
              target='_blank'
              rel='noopener noreferrer'
              className='hover:opacity-80 transition-opacity'
            >
              <img
                src={debateAiLogo}
                alt='DebateAI Logo'
                className='h-8 w-auto object-contain'
              />
            </a>
          </div>
        )}
      </div>

      {/* Nav links */}
      <nav className='flex-1 px-2 py-4 space-y-2 overflow-y-auto'>
        <NavItem to='/startDebate' label='Start Debate' collapsed={isCollapsed}
          icon={<MessageSquare className='h-4 w-4' />} />
        <NavItem to='/tournaments' label='Tournaments' collapsed={isCollapsed}
          icon={<Trophy className='h-4 w-4' />} />
        <NavItem to='/team-builder' label='Team Debates' collapsed={isCollapsed}
          icon={<Users className='h-4 w-4' />} />
        <NavItem to='/leaderboard' label='Leaderboard' collapsed={isCollapsed}
          icon={<BarChart className='h-4 w-4' />} />
        <NavItem to='/community' label='Community' collapsed={isCollapsed}
          icon={<MessageCircle className='h-4 w-4' />} />
        <NavItem to='/profile' label='Profile' collapsed={isCollapsed}
          icon={<User className='h-4 w-4' />} />
        <NavItem to='/about' label='About' collapsed={isCollapsed}
          icon={<Info className='h-4 w-4' />} />
        <NavItem to='/support-os' label='Support DebateAI' collapsed={isCollapsed}
          icon={<Heart className='h-4 w-4 text-red-500 transition-all duration-300 group-hover:fill-red-500 group-hover:scale-110' />} />
        {!isCollapsed && <ThemeToggle />}
      </nav>
    </aside>
  );
}

interface NavItemProps {
  to: string;
  label: string;
  icon?: React.ReactNode;
  collapsed?: boolean;
}

function NavItem({ to, label, icon, collapsed }: NavItemProps) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `group flex items-center ${collapsed ? 'justify-center' : ''} px-2 py-2 text-sm font-medium rounded-md ${
          isActive
            ? 'bg-secondary text-secondary-foreground'
            : 'text-foreground hover:bg-muted hover:text-foreground'
        }`
      }
    >
      <span className={collapsed ? '' : 'mr-3'}>{icon}</span>
      {!collapsed && label}
    </NavLink>
  );
}

export default Sidebar;
