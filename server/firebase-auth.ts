import type { Request, Response, NextFunction } from "express";
import { getFirebaseAuth } from "./firebase-admin";

export async function attachFirebaseUser(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return next();
  }

  const auth = getFirebaseAuth();
  if (!auth) {
    return next();
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    req.firebaseUser = decoded;
  } catch (error) {
    return next();
  }

  return next();
}
