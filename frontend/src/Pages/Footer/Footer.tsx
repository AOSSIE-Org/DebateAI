import type React from "react"

const Footer: React.FC = () => {
  return (
    <footer className="relative bg-black dark:bg-white text-white dark:text-black py-8 overflow-hidden">
    
      
      <div className="relative container mx-auto px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
         
        </div>
        <div className="mt-2 text-center border-t border-white dark:border-black/30 pt-0.1">
          <p className="text-sm font-medium tracking-wide">&copy; {new Date().getFullYear()} Debate AI. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer