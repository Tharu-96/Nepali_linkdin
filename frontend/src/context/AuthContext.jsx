import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authAPI, usersAPI } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("rozgar_token") || localStorage.getItem("token"));
  const [role, setRole] = useState(localStorage.getItem("role"));
  const [loading, setLoading] = useState(true);

  // Validate existing token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await usersAPI.getMe();
        setUser(res.data);
        setRole(res.data.role);
        localStorage.setItem("role", res.data.role);
      } catch {
        // Token is invalid — clear everything
        localStorage.removeItem("rozgar_token");
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("user");
        setToken(null);
        setRole(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    validateToken();
  }, [token]);

  const setAuthSession = useCallback(async (accessToken, userRole, userData = null) => {
    localStorage.setItem("rozgar_token", accessToken);
    localStorage.setItem("token", accessToken);
    localStorage.setItem("role", userRole);
    setToken(accessToken);
    setRole(userRole);

    if (userData) {
      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));
      return userData;
    }

    try {
      const meRes = await usersAPI.getMe();
      const nextUser = meRes.data;
      setUser(nextUser);
      localStorage.setItem("user", JSON.stringify(nextUser));
      return nextUser;
    } catch (error) {
      localStorage.removeItem("user");
      setUser(null);
      throw error;
    }
  }, []);

  const login = useCallback(async (email, password, selectedRole = null) => {
    const payload = { email, password };
    if (selectedRole) payload.role = selectedRole;
    const res = await authAPI.login(payload);
    const { access_token, role: userRole } = res.data;
    if (selectedRole && userRole !== selectedRole) {
      throw new Error(`This account is registered as ${userRole}. Please sign in as ${userRole}.`);
    }
    return setAuthSession(access_token, userRole);
  }, [setAuthSession]);

  const register = useCallback(async (data) => {
    const res = await authAPI.register(data);
    return res.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("rozgar_token");
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    setToken(null);
    setRole(null);
    setUser(null);
  }, []);

  const value = {
    user,
    token,
    role,
    loading,
    isAuthenticated: !!token && !!user,
    login,
    register,
    logout,
    setAuthSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
