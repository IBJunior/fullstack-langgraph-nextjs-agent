"use client";
import { ReactNode, useCallback, useState } from "react";
import { ThreadList } from "./ThreadList";
import Sidebar from "./Sidebar";
import Header from "./Header";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} toggle={toggleSidebar}>
        <ThreadList />
      </Sidebar>

      {/* Main content area */}
      <div className="bg-gray-150 flex min-w-0 flex-1 flex-col">
        <div className="z-10">
          <Header toggleSidebar={toggleSidebar} />
        </div>

        {/* Main content */}
        <div className="relative h-[calc(100vh-4rem)] flex-1">{children}</div>
      </div>
    </div>
  );
}
