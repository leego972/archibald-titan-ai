import { useState, useEffect } from "react";
import { PasswordEntry } from "../types";
import { encrypt, decrypt } from "../utils/crypto";
const STORAGE_KEY_PREFIX = "pm_passwords_";

export function usePasswords(masterPassword: string, username: string) {
  const [passwords, setPasswords] = useState<PasswordEntry[]>([]);

  useEffect(() => {
    async function load() {
      const data = localStorage.getItem(STORAGE_KEY_PREFIX + username);
      if (!data) {
        setPasswords([]);
        return;
      }
      try {
        const encryptedList: string[] = JSON.parse(data);
        const decryptedList: PasswordEntry[] = [];
        for (const enc of encryptedList) {
          const dec = await decrypt(enc, masterPassword);
          decryptedList.push(JSON.parse(dec));
        }
        setPasswords(decryptedList);
      } catch {
        setPasswords([]);
      }
    }
    load();
  }, [masterPassword, username]);

  async function save(newList: PasswordEntry[]) {
    const encryptedList: string[] = [];
    for (const entry of newList) {
      const enc = await encrypt(JSON.stringify(entry), masterPassword);
      encryptedList.push(enc);
    }
    localStorage.setItem(STORAGE_KEY_PREFIX + username, JSON.stringify(encryptedList));
  }

  async function add(entry: Omit<PasswordEntry, "id" | "createdAt" | "updatedAt">) {
    const newEntry: PasswordEntry = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const newList = [...passwords, newEntry];
    await save(newList);
    setPasswords(newList);
  }

  async function update(id: string, updated: Partial<PasswordEntry>) {
    const newList = passwords.map(p =>
      p.id === id ? { ...p, ...updated, updatedAt: new Date().toISOString() } : p
    );
    await save(newList);
    setPasswords(newList);
  }

  async function remove(id: string) {
    const newList = passwords.filter(p => p.id !== id);
    await save(newList);
    setPasswords(newList);
  }

  return { passwords, add, update, remove };
}
