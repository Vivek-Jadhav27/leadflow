import React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-[#f5f8fa] text-[#33475b] flex flex-col">
      {children}
    </div>
  );
}
