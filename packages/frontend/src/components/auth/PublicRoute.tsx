import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { Spinner } from '../shared/Spinner';

export function PublicRoute({ children }: { children?: React.ReactNode }) {
  const { isLoaded, userId } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (userId) {
    return <Navigate to="/" replace />;
  }

  return <>{children || <Outlet />}</>;
}
