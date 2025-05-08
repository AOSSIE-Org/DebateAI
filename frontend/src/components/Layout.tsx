// src/components/Layout.tsx
import React from "react"
import { Outlet } from "react-router-dom"
import Sidebar from "./Sidebar"
import Header from "./Header"

function Layout() {
  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="p-4 md:p-6 flex-1 bg-white">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
