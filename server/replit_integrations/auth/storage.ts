import { type User, type UpsertUser } from "@shared/models/auth";
import { firestoreAdd, firestoreUpdate, firestoreGet } from "../../firebase-db";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    return await firestoreGet("users", id) as User | undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existing = await this.getUser(userData.id!);
    if (existing) {
      await firestoreUpdate("users", userData.id!, {
        ...userData,
        updatedAt: new Date(),
      });
      return { ...existing, ...userData } as User;
    } else {
      return await firestoreAdd("users", userData) as User;
    }
  }
}

export const authStorage = new AuthStorage();
