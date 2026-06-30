export const ROLES = ['owner', 'manager', 'receptionist', 'accountant', 'trainer'] as const;
export type Role = (typeof ROLES)[number];

/**
 * Fine-grained permissions. Routes check permissions (not roles directly) so the
 * matrix can evolve without touching controllers.
 */
export const PERMISSIONS = [
  // members
  'members.create',
  'members.read',
  'members.update',
  'members.delete',
  // memberships & plans
  'memberships.create',
  'memberships.read',
  'memberships.renew',
  'plans.manage',
  'plans.read',
  // payments
  'payments.create',
  'payments.read',
  // attendance
  'attendance.mark',
  'attendance.read',
  // accounting
  'expenses.create',
  'income.create',
  'accounting.read',
  // reports
  'reports.financial',
  'reports.operational',
  // trainers
  'trainers.manage',
  'trainers.read',
  // inventory
  'inventory.manage',
  'inventory.read',
  // dues
  'dues.read',
  // reminders
  'reminders.read',
  'reminders.configure',
  // users & settings
  'users.manage',
  'settings.manage',
  'audit.read',
  'data.export',
  // dashboard
  'dashboard.view',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: Permission[] = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ALL,

  manager: [
    'members.create',
    'members.read',
    'members.update',
    'members.delete',
    'memberships.create',
    'memberships.read',
    'memberships.renew',
    'plans.read',
    'payments.create',
    'payments.read',
    'attendance.mark',
    'attendance.read',
    'accounting.read',
    'reports.financial',
    'reports.operational',
    'trainers.manage',
    'trainers.read',
    'inventory.manage',
    'inventory.read',
    'dues.read',
    'reminders.read',
    'dashboard.view',
  ],

  receptionist: [
    'members.create',
    'members.read',
    'members.update',
    'memberships.create',
    'memberships.renew',
    'memberships.read',
    'plans.read',
    'payments.create',
    'payments.read',
    'attendance.mark',
    'attendance.read',
    'dues.read',
    'reminders.read',
    'dashboard.view',
  ],

  accountant: [
    'members.read',
    'memberships.read',
    'payments.read',
    'expenses.create',
    'income.create',
    'accounting.read',
    'reports.financial',
    'dues.read',
    'dashboard.view',
  ],

  trainer: [
    'members.read',
    'attendance.read',
    'plans.read',
    'dashboard.view',
  ],
};

export function permissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return permissionsForRole(role).includes(permission);
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
