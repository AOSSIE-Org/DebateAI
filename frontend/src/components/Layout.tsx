// src/components/Layout.tsx
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';

function Layout() {
  return (
    <div className='flex h-screen overflow-hidden'>
      <Sidebar />
      <div className='flex-1 flex flex-col h-full min-w-0'>
        <Header />
        <main className='flex-1 overflow-y-auto overflow-x-hidden flex flex-col'>
          <div className='flex-1 p-4 md:p-6'>
            <Outlet />
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
}

export default Layout;