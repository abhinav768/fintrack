import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi, profileApi } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = useCallback(async () => {
    try {
      const list = await profileApi.list();
      setProfiles(list);
      return list;
    } catch {
      setProfiles([]);
      return [];
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const u = await authApi.getMe();
        setUser(u);

        const list = await profileApi.list();
        setProfiles(list);

        const savedId = localStorage.getItem("profile_id");
        if (savedId) {
          const found = list.find((p) => String(p.id) === savedId);
          if (found) setProfile(found);
        }
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("profile_id");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await authApi.login({ username, password });
    localStorage.setItem("token", data.token);
    setUser(data.user);
    const list = await profileApi.list();
    setProfiles(list);
    return data.user;
  }, []);

  const signup = useCallback(async (username, password) => {
    const data = await authApi.signup({ username, password });
    localStorage.setItem("token", data.token);
    setUser(data.user);
    const list = await profileApi.list();
    setProfiles(list);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("profile_id");
    setUser(null);
    setProfile(null);
    setProfiles([]);
  }, []);

  const selectProfile = useCallback(
    (profileId) => {
      const found = profiles.find((p) => p.id === profileId);
      if (found) {
        setProfile(found);
        localStorage.setItem("profile_id", String(profileId));
      }
    },
    [profiles]
  );

  const clearProfile = useCallback(() => {
    setProfile(null);
    localStorage.removeItem("profile_id");
  }, []);

  const createProfile = useCallback(
    async (name) => {
      const created = await profileApi.create({ name });
      const list = await profileApi.list();
      setProfiles(list);
      return created;
    },
    []
  );

  const updateProfile = useCallback(
    async (profileId, name) => {
      const updated = await profileApi.update(profileId, { name });
      const list = await profileApi.list();
      setProfiles(list);
      if (profile && profile.id === profileId) {
        const refreshed = list.find((p) => p.id === profileId);
        if (refreshed) setProfile(refreshed);
      }
      return updated;
    },
    [profile]
  );

  const deleteProfile = useCallback(
    async (profileId) => {
      await profileApi.delete(profileId);
      const list = await profileApi.list();
      setProfiles(list);
      if (profile && profile.id === profileId) {
        setProfile(null);
        localStorage.removeItem("profile_id");
      }
    },
    [profile]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        profiles,
        profile,
        login,
        signup,
        logout,
        selectProfile,
        clearProfile,
        fetchProfiles,
        createProfile,
        updateProfile,
        deleteProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
