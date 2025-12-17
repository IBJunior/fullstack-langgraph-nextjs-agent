"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./globals.css";
import { ThreadProvider } from "@/contexts/ThreadContext";
import { UISettingsProvider } from "@/contexts/UISettingsContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
    },
  },
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>StackPath AI</title>
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <UISettingsProvider>
            <ThreadProvider>{children}</ThreadProvider>
          </UISettingsProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
