import { firestoreAdd } from "../firebase-db";

export async function createNotification(userId: string, title: string, message: string, link?: string) {
    try {
        await firestoreAdd("notifications", {
            userId,
            title,
            message,
            link,
            read: false,
        });
    } catch (error) {
        console.error("Failed to create notification:", error);
    }
}

export async function notifyTaskAssigned(role: string, instanceId: string) {
    // In a real app, find users with this role
    // For MVP, we'll notify "admin" or skip if no specific user
    console.log(`Notification: Task assigned to role ${role} for instance ${instanceId}`);
}

export async function notifyRequestInfo(userId: string, instanceId: string) {
    await createNotification(
        userId,
        "Information Requested",
        "Further information or corrections are required for your invoice submission.",
        `/workflows/${instanceId}`
    );
}
