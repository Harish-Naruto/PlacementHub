import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  type User,
  loginApi,
  registerApi,
  logoutApi,
  refreshApi,
} from "../api/auth";
import type { Role } from "../lib/roles";

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string, role?: Role) => Promise<void>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    role?: Role;
    invitationCode?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Restore session via HttpOnly cookie on page reload
  const checkSession = useCallback(async () => {
    try {
      const res = await refreshApi();
      setUser(res.data.user);
      setAccessToken(res.data.accessToken);
    } catch {
      setUser(null);
      setAccessToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = async (
    email: string,
    password: string,
    role?: Role
  ) => {
    const res = await loginApi({ email, password, role });
    setUser(res.data.user);
    setAccessToken(res.data.accessToken);
  };

  const register = async (payload: {
    name: string;
    email: string;
    password: string;
    role?: Role;
    invitationCode?: string;
  }) => {
    const res = await registerApi(payload);
    setUser(res.data.user);
    setAccessToken(res.data.accessToken);
  };

  const logout = async () => {
    try {
      await logoutApi();
    } finally {
      setUser(null);
      setAccessToken(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        loading,
        login,
        register,
        logout,
        checkSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
