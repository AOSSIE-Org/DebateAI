// src/components/Layout.tsx
import { Outlet } from 'react-router-dom';
import Header from './Header';

function Layout() {
  return (
    <div className='flex flex-col h-screen overflow-hidden'>
      <Header />
      <main className='flex-1 overflow-y-auto p-4 md:p-6'>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
