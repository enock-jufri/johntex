import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../api/client';

export interface User {
  id: number;
  username: string;
  role_id: number;
  active: boolean;
  created_at: string;
  last_login: string | null;
}

export interface Role {
  id: number;
  name: string;
}

export interface UserActivity {
  user_id: number;
  username: string;
  role: string;
  active: boolean;
  created_at: string;
  last_login: string | null;
  total_actions: number;
  recent_actions: string[];
}

export interface RolePermissions {
  [role: string]: string[];
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get<User[]>('/users/');
      return data;
    },
    staleTime: 10_000,
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data } = await api.get<Role[]>('/users/roles');
      return data;
    },
  });
}

export function useUserActivity() {
  return useQuery({
    queryKey: ['user-activity'],
    queryFn: async () => {
      const { data } = await api.get<UserActivity[]>('/users/activity');
      return data;
    },
    staleTime: 10_000,
  });
}

export function usePermissions() {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const { data } = await api.get<RolePermissions>('/users/permissions');
      return data;
    },
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (user: {
      username: string;
      password: string;
      role_id: number;
    }) => {
      const { data } = await api.post('/users/', user);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['user-activity'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create user'),
  });
}

export function useToggleUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.put(`/users/${id}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['user-activity'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to toggle user'),
  });
}

export function useResetPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      password,
    }: {
      userId: number;
      password: string;
    }) => {
      const { data } = await api.put(
        `/users/${userId}/reset-password`, { password }
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-activity'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to reset password'),
  });
}
