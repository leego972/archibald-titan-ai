export interface User {
  username: string;
  passwordHash: string;
}

export interface PasswordEntry {
  id: string;
  site: string;
  username: string;
  password: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
