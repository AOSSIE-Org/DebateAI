// src/components/Sidebar.tsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  MessageSquare,
  BarChart,
  User,
  Info,
  Trophy,
  Users,
  MessageCircle,
} from 'lucide-react';
import debateAiLogo from '@/assets/aossie.png';
import { ThemeToggle } from './ThemeToggle';

function Sidebar() {
  return (
    <aside className='hidden md:flex flex-col w-64 border-r border-gray-200 shadow-md bg-white'>
      {/* Logo / Brand */}
      <div className='flex items-center h-16 px-4 border-b border-gray-200 shadow-sm bg-white'>
        <div className='flex items-center gap-2'>
          <span className='text-2xl font-bold'>DebateAI by</span>
          <img
            src={debateAiLogo}
            alt='DebateAI Logo'
            className='h-10 w-auto object-contain'
          />
        </div>
      </div>
      {/* Nav links */}
      <nav className='flex-1 px-2 py-4 space-y-2 overflow-y-auto'>
        <NavItem
          to='/startDebate'
          label='Start Debate'
          icon={<MessageSquare />}
        />
        <NavItem
          to='/tournaments'
          label='Tournaments'
          icon={<Trophy />}
        />
        <NavItem
          to='/team-builder'
          label='Team Debates'
          icon={<Users />}
        />
        <NavItem
          to='/leaderboard'
          label='Leaderboard'
          icon={<BarChart />}
        />
        <NavItem
          to='/community'
          label='Community'
          icon={<MessageCircle />}
        />
        <NavItem
          to='/profile'
          label='Profile'
          icon={<User />}
        />
        <NavItem
          to='/about'
          label='About'
          icon={<Info />}
        />
        <ThemeToggle />
      </nav>
    </aside>
  );
}

interface NavItemProps {
  to: string;
  label: string;
  icon?: React.ReactNode;
}

function NavItem({ to, label, icon }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `group flex items-center px-2 py-3 text-base font-medium rounded-md ${isActive
          ? 'bg-secondary text-secondary-foreground'
          : 'text-foreground hover:bg-muted hover:text-foreground'
        }`
      }
    >
      <span className="mr-3 h-5 w-5 flex items-center justify-center">
        {React.cloneElement(icon as React.ReactElement, { className: 'h-5 w-5' })}
      </span>
      {label}
    </NavLink>
  );
}

export default Sidebar;
