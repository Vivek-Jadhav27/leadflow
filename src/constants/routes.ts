export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  DASHBOARD: '/dashboard',
  LEADS: '/leads',
  NEW_LEAD: '/leads/new',
  LEAD_DETAIL: (id: string) => `/leads/${id}`,
  EDIT_LEAD: (id: string) => `/leads/${id}/edit`,
} as const;
