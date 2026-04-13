// Shared type definitions across all applications
export interface User {
  id: string;
  email: string;
  phoneNumber?: string;
}

export interface Organization {
  id: string;
  name: string;
}
