import { type User, type UpsertUser, type ProcessingSession, type ExtractedData } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  createSession(fileName: string, fileType: string): Promise<ProcessingSession>;
  getSession(id: string): Promise<ProcessingSession | undefined>;
  updateSession(id: string, updates: Partial<ProcessingSession>): Promise<ProcessingSession | undefined>;
  deleteSession(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private sessions: Map<string, ProcessingSession>;

  constructor() {
    this.users = new Map();
    this.sessions = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === username,
    );
  }

  async createUser(insertUser: UpsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      email: insertUser.email ?? null,
      firstName: insertUser.firstName ?? null,
      lastName: insertUser.lastName ?? null,
      profileImageUrl: insertUser.profileImageUrl ?? null,
      createdAt: insertUser.createdAt ?? null,
      updatedAt: insertUser.updatedAt ?? null,
    };
    this.users.set(id, user);
    return user;
  }

  async createSession(fileName: string, fileType: string): Promise<ProcessingSession> {
    const id = randomUUID();
    const session: ProcessingSession = {
      id,
      fileName,
      fileType,
      status: "uploading",
    };
    this.sessions.set(id, session);
    return session;
  }

  async getSession(id: string): Promise<ProcessingSession | undefined> {
    return this.sessions.get(id);
  }

  async updateSession(id: string, updates: Partial<ProcessingSession>): Promise<ProcessingSession | undefined> {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    
    const updatedSession = { ...session, ...updates };
    this.sessions.set(id, updatedSession);
    return updatedSession;
  }

  async deleteSession(id: string): Promise<boolean> {
    return this.sessions.delete(id);
  }
}

export const storage = new MemStorage();
