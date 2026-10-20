// src/components/Sidebar.tsx
import React, { useEffect, useState } from 'react';
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
import debateAiLogo from '@/assets/debateai-logo.svg';
import { ThemeToggle } from './ThemeToggle';

const COLLAPSED_STORAGE_KEY = 'sidebarCollapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

// Text that fades out (instead of unmounting) when the sidebar collapses, so the
// width animation is the only thing that moves. `invisible` also removes it from
// the tab order and the accessibility tree while collapsed.
function fadeClass(collapsed: boolean) {
  return `transition-[opacity,visibility] duration-150 motion-reduce:transition-none ${
    collapsed ? 'opacity-0 invisible' : 'opacity-100 visible delay-75'
  }`;
}

function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(readCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(isCollapsed));
    } catch {
      // Storage can be unavailable (e.g. private mode); collapsing still works.
    }
  }, [isCollapsed]);

  return (
    <aside
      className={`hidden lg:flex flex-col shrink-0 overflow-hidden border-r border-border bg-background transition-[width] duration-200 ease-out motion-reduce:transition-none ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Toggle + Logo / Brand */}
      <div className='flex items-center h-16 px-3 gap-2 border-b border-border'>
        <button
          type='button'
          onClick={() => setIsCollapsed((prev) => !prev)}
          className='shrink-0 p-2 rounded-md text-foreground hover:bg-muted transition-colors'
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!isCollapsed}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Menu className='h-5 w-5' />
        </button>
        <div className={`flex items-center gap-2 whitespace-nowrap ${fadeClass(isCollapsed)}`}>
          <img
            src={debateAiLogo}
            alt='DebateAI Logo'
            className='h-8 w-auto object-contain'
          />
          <div className='flex flex-col'>
            <span className='text-xl font-bold leading-none'>DebateAI</span>
            <a
              href="https://aossie.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold hover:text-foreground transition-colors"
            >
              by AOSSIE
            </a>
          </div>
        </div>
      </div>
      {/* Nav links */}
      <nav className='flex-1 px-2 py-4 space-y-2 overflow-y-auto overflow-x-hidden'>
        <NavItem
          to='/startDebate'
          label='Start Debate'
          collapsed={isCollapsed}
          icon={<MessageSquare className='h-4 w-4' />}
        />
        <NavItem
          to='/tournaments'
          label='Tournaments'
          collapsed={isCollapsed}
          icon={<Trophy className='h-4 w-4' />}
        />
        <NavItem
          to='/team-builder'
          label='Team Debates'
          collapsed={isCollapsed}
          icon={<Users className='h-4 w-4' />}
        />
        <NavItem
          to='/leaderboard'
          label='Leaderboard'
          collapsed={isCollapsed}
          icon={<BarChart className='h-4 w-4' />}
        />
        <NavItem
          to='/community'
          label='Community'
          collapsed={isCollapsed}
          icon={<MessageCircle className='h-4 w-4' />}
        />
        <NavItem
          to='/profile'
          label='Profile'
          collapsed={isCollapsed}
          icon={<User className='h-4 w-4' />}
        />
        <NavItem
          to='/about'
          label='About'
          collapsed={isCollapsed}
          icon={<Info className='h-4 w-4' />}
        />
        <NavItem
          to='/support-os'
          label='Support DebateAI'
          collapsed={isCollapsed}
          icon={<Heart className='h-4 w-4 text-red-500 transition-all duration-300 group-hover:fill-red-500 group-hover:scale-110' />}
        />
        <div className={fadeClass(isCollapsed)}>
          <ThemeToggle />
        </div>
      </nav>
    </aside>
  );
}

interface NavItemProps {
  to: string;
  label: string;
  icon?: React.ReactNode;
  collapsed: boolean;
}

function NavItem({ to, label, icon, collapsed }: NavItemProps) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      title={collapsed ? label : undefined}
      // px-4 keeps the 16px icon centred in the 64px collapsed bar, so icons
      // stay in place while the width animates.
      className={({ isActive }) =>
        `group flex items-center px-4 py-2 text-sm font-medium rounded-md ${isActive
          ? 'bg-secondary text-secondary-foreground'
          : 'text-foreground hover:bg-muted hover:text-foreground'
        }`
      }
    >
      <span className='shrink-0'>{icon}</span>
      <span className={`ml-3 whitespace-nowrap ${fadeClass(collapsed)}`}>{label}</span>
    </NavLink>
  );
}

export default Sidebar;
