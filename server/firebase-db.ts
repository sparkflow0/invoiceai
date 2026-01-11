import { getFirestore } from "./firebase-admin";
import { randomUUID } from "crypto";

export async function firestoreAdd(collectionName: string, data: any) {
    const db = getFirestore();
    if (!db) throw new Error("Firestore not initialized");

    const id = data.id || randomUUID();
    const docRef = db.collection(collectionName).doc(id);
    const finalData = { ...data, id, createdAt: data.createdAt || new Date(), updatedAt: new Date() };
    await docRef.set(finalData);
    return finalData;
}

export async function firestoreUpdate(collectionName: string, id: string, data: any) {
    const db = getFirestore();
    if (!db) throw new Error("Firestore not initialized");

    const docRef = db.collection(collectionName).doc(id);
    const updateData = { ...data, updatedAt: new Date() };
    await docRef.update(updateData);
    return updateData;
}

export async function firestoreGet(collectionName: string, id: string) {
    const db = getFirestore();
    if (!db) throw new Error("Firestore not initialized");

    const doc = await db.collection(collectionName).doc(id).get();
    return doc.exists ? doc.data() : null;
}

export async function firestoreQuery(collectionName: string, queries: { field: string, operator: any, value: any }[] = [], orderBy?: { field: string, direction: 'asc' | 'desc' }, limitCount?: number) {
    const db = getFirestore();
    if (!db) throw new Error("Firestore not initialized");

    let query: any = db.collection(collectionName);

    for (const q of queries) {
        query = query.where(q.field, q.operator, q.value);
    }

    if (orderBy) {
        query = query.orderBy(orderBy.field, orderBy.direction);
    }

    if (limitCount) {
        query = query.limit(limitCount);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc: any) => doc.data());
}

export async function firestoreDelete(collectionName: string, id: string) {
    const db = getFirestore();
    if (!db) throw new Error("Firestore not initialized");

    await db.collection(collectionName).doc(id).delete();
}
