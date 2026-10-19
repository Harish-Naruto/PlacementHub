import { API_BASE_URL } from "./http";
import type { Role } from "../lib/roles";

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  profileImage: string | null;
  createdAt: string;
}

export interface AuthResponse {
  error: boolean;
  data: {
    user: User;
    accessToken: string;
  };
  message?: string;
}

export interface ApiErrorResponse {
  error: boolean;
  message: string;
}

export async function registerApi(payload: {
  email: string;
  name: string;
  password: string;
  role?: Role;
  invitationCode?: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // for HttpOnly refresh cookie
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.message || "Registration failed");
  }
  return json;
}

export async function loginApi(payload: {
  email: string;
  password: string;
  role?: Role;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // for HttpOnly refresh cookie
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.message || "Login failed");
  }
  return json;
}

export async function refreshApi(): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });

  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.message || "Session expired");
  }
  return json;
}

export async function logoutApi(): Promise<void> {
  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
}

export async function getMeApi(accessToken: string): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
  });

  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.message || "Failed to fetch user");
  }
  return json.data.user;
}

export async function testRecruiterCheckApi(accessToken: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/auth/recruiter-check`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
  });

  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.message || "Access denied for non-recruiter");
  }
  return json.data;
}
