import { firestoreAdd, firestoreUpdate, firestoreGet, firestoreQuery, firestoreDelete } from "../../firebase-db";

export interface IChatStorage {
  getConversation(id: string): Promise<any>;
  getAllConversations(): Promise<any[]>;
  createConversation(title: string): Promise<any>;
  deleteConversation(id: string): Promise<void>;
  getMessagesByConversation(conversationId: string): Promise<any[]>;
  createMessage(conversationId: string, role: string, content: string): Promise<any>;
}

export const chatStorage: IChatStorage = {
  async getConversation(id: string) {
    return await firestoreGet("conversations", id);
  },

  async getAllConversations() {
    return await firestoreQuery("conversations", [], { field: "createdAt", direction: "desc" });
  },

  async createConversation(title: string) {
    return await firestoreAdd("conversations", { title });
  },

  async deleteConversation(id: string) {
    const messages = await firestoreQuery("messages", [{ field: "conversationId", operator: "==", value: id }]);
    for (const msg of messages) {
      await firestoreDelete("messages", msg.id);
    }
    await firestoreDelete("conversations", id);
  },

  async getMessagesByConversation(conversationId: string) {
    return await firestoreQuery("messages", [{ field: "conversationId", operator: "==", value: conversationId }], { field: "createdAt", direction: "asc" });
  },

  async createMessage(conversationId: string, role: string, content: string) {
    return await firestoreAdd("messages", { conversationId, role, content });
  },
};

