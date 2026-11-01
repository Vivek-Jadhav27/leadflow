export type UserRole = 'admin' | 'sdr';
export type AccountStatus = 'active' | 'disabled';
export type WorkspaceStatus = 'active' | 'suspended';
export type MembershipStatus = 'active' | 'suspended' | 'removed';
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  emailNormalized: string;
  status: AccountStatus;
  role?: UserRole;
  currentWorkspaceId?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface Workspace {
  workspaceId: string;
  companyName: string;
  companyLinkedinUrl: string;
  ownerId: string;
  status: WorkspaceStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkspaceMember {
  uid: string;
  workspaceId?: string;
  role: UserRole;
  status: MembershipStatus;
  joinedAt: string;
  invitedBy?: string;
  user?: {
    name: string;
    email: string;
  };
}

export interface Invitation {
  invitationId: string;
  workspaceId: string;
  companyName?: string;
  email: string;
  emailNormalized: string;
  role: 'sdr';
  tokenHash: string;
  status: InvitationStatus;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  acceptedBy?: string;
  revokedAt?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  performedBy: string;
  workspaceId?: string;
  targetId?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}
