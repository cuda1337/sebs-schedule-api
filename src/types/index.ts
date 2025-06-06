// Request/Response types for our API

export interface CreateStaffDto {
  name: string;
  locations: string[];
  availability: Record<string, boolean>;
}

export interface UpdateStaffDto {
  name?: string;
  locations?: string[];
  availability?: Record<string, boolean>;
}

export interface CreateClientDto {
  name: string;
  locations: string[];
  authorizedHours: number;
  availability: Record<string, boolean>;
}

export interface UpdateClientDto {
  name?: string;
  locations?: string[];
  authorizedHours?: number;
  availability?: Record<string, boolean>;
}

export interface CreateAssignmentDto {
  day: string;
  block: string;
  staffId: number;
  clientId: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}