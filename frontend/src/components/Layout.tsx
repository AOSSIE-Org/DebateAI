import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Header from './Header';
import { useReducedMotion } from "framer-motion";

function Layout() {
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className='flex h-screen overflow-hidden'>
      <Sidebar />

      <div className='flex-1 flex flex-col h-full'>
        <Header />

        <main className='flex-1 overflow-y-auto p-4 md:p-6'>
        <motion.div
          key={location.pathname}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            shouldReduceMotion ? { duration: 0 } : { duration: 0.8 }
          }
        >
          <Outlet />
        </motion.div>
        </main>
      </div>
    </div>
  );
}

export default Layout;