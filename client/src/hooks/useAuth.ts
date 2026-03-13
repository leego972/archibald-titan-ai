import { useState, useEffect } from "react";
import { User } from "../types";

const STORAGE_KEY = "pm_users";
const SESSION_KEY = "pm_session";

function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    hash = (hash << 5) - hash + password.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString();
}

function getUsers(): User[] {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveUsers(users: User[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
      const users = getUsers();
      const found = users.find(u => u.username === session);
      if (found) setUser(found);
    }
  }, []);

  async function login(username: string, password: string): Promise<boolean> {
    const users = getUsers();
    const found = users.find(u => u.username === username);
    if (!found) return false;
    if (found.passwordHash !== hashPassword(password)) return false;
    setUser(found);
    localStorage.setItem(SESSION_KEY, username);
    return true;
  }

  async function register(username: string, password: string): Promise<boolean> {
    const users = getUsers();
    if (users.find(u => u.username === username)) return false;
    const newUser: User = {
      username,
      passwordHash: hashPassword(password),
    };
    users.push(newUser);
    saveUsers(users);
    setUser(newUser);
    localStorage.setItem(SESSION_KEY, username);
    return true;
  }

  function logout() {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  }

  return { user, login, register, logout };
}
