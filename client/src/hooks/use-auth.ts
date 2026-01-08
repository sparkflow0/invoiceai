import { useEffect, useState, useCallback } from "react";
import type { User } from "@shared/models/auth";
import { onAuthStateChanged, signOut, type User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase";

function mapFirebaseUser(user: FirebaseUser): User {
  const displayName = user.displayName?.trim();
  const nameParts = displayName ? displayName.split(" ") : [];
  const firstName = nameParts.length > 0 ? nameParts[0] : null;
  const lastName =
    nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

  return {
    id: user.uid,
    email: user.email ?? null,
    firstName,
    lastName,
    profileImageUrl: user.photoURL ?? null,
    createdAt: null,
    updatedAt: null,
  };
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ? mapFirebaseUser(firebaseUser) : null);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const logout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
    } finally {
      setIsLoggingOut(false);
    }
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout,
    isLoggingOut,
  };
}
