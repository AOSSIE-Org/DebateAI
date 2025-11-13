// src/components/Layout.tsx
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

function Layout() {
  return (
    <div className='flex min-h-screen'>
      <Sidebar />
      <div className='flex-1 flex flex-col'>
        <Header />
        <main className='p-4 md:p-6 flex-1'>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
