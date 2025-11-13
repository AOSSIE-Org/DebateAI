// src/components/Sidebar.tsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { MessageSquare, BarChart, User, Info, Trophy } from 'lucide-react';
import debateAiLogo from '@/assets/aossie.png';
import { ThemeToggle } from './ThemeToggle';

function Sidebar() {
  return (
    <aside className='hidden md:flex flex-col w-64 border-r border-gray-200'>
      {/* Logo / Brand */}
      <div className='flex items-center h-16 px-4 border-b border-gray-200'>
        <div className='flex items-center gap-2'>
          <span className='text-xl font-bold'>DebateAI by</span>
          <img
            src={debateAiLogo}
            alt='DebateAI Logo'
            className='h-8 w-auto object-contain'
          />
        </div>
      </div>
      {/* Nav links */}
      <nav className='flex-1 px-2 py-4 space-y-2'>
        <NavItem
          to='/startDebate'
          label='Start Debate'
          icon={<MessageSquare className='mr-3 h-4 w-4' />}
        />
        <NavItem
          to='/tournaments'
          label='Tournaments'
          icon={<Trophy className='mr-3 h-4 w-4' />}
        />
        <NavItem
          to='/leaderboard'
          label='Leaderboard'
          icon={<BarChart className='mr-3 h-4 w-4' />}
        />
        <NavItem
          to='/profile'
          label='Profile'
          icon={<User className='mr-3 h-4 w-4' />}
        />
        <NavItem
          to='/about'
          label='About'
          icon={<Info className='mr-3 h-4 w-4' />}
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
        `group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
          isActive
            ? 'bg-secondary text-secondary-foreground'
            : 'text-foreground hover:bg-muted hover:text-foreground'
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

export default Sidebar;
