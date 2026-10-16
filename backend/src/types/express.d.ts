import "express";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string | null;
        role: string;
        profileImage: string | null;
        createdAt: Date;
      };
    }
  }
}