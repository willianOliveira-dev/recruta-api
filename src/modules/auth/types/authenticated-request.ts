import type { Request } from 'express';

export interface AuthenticatedSession {
  user: {
    id: string;
    email: string;
    name: string;
  };
  session: {
    id: string;
    token: string;
    activeOrganizationId?: string | null;
  };
}

export interface AuthenticatedRequest extends Request {
  authSession?: AuthenticatedSession;
}
