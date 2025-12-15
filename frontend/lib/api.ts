import { Staff, Toilet, DashboardDayResponse, StaffCreate, StaffUpdate, ToiletCreate, SimpleStatusResponse } from './types';

export const API_HOST = process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:8000';
const API_BASE = `${API_HOST}/api`;

export const api = {
    // Checks
    submitCheck: async (formData: FormData) => {
        const res = await fetch(`${API_BASE}/checks/`, {
            method: 'POST',
            body: formData,
        });
        if (!res.ok) throw new Error('Failed to submit check');
        return res.json();
    },

    getChecks: async (date: string, toiletId?: number) => {
        const params = new URLSearchParams({ date });
        if (toiletId) params.append('toilet_id', toiletId.toString());

        const res = await fetch(`${API_BASE}/checks/?${params}`);
        if (!res.ok) throw new Error('Failed to fetch checks');
        return res.json();
    },

    // Dashboard
    getDashboardDay: async (date: string, toiletId?: number): Promise<DashboardDayResponse> => {
        const params = new URLSearchParams({ date_str: date });
        if (toiletId) params.append('toilet_id', toiletId.toString());

        const res = await fetch(`${API_BASE}/dashboard/day?${params}`);
        if (!res.ok) throw new Error('Failed to fetch dashboard data');
        return res.json();
    },

    // Simple Status (New Alert System)
    getSimpleStatus: async (date?: string): Promise<SimpleStatusResponse> => {
        const params = date ? `?date_str=${date}` : '';
        const res = await fetch(`${API_BASE}/dashboard/simple-status${params}`);
        if (!res.ok) throw new Error('Failed to fetch simple status');
        return res.json();
    },

    // Master Data
    getToilets: async (): Promise<Toilet[]> => {
        const res = await fetch(`${API_BASE}/toilets`);
        if (!res.ok) throw new Error('Failed to fetch toilets');
        return res.json();
    },

    getStaff: async (): Promise<Staff[]> => {
        const res = await fetch(`${API_BASE}/staff`);
        if (!res.ok) throw new Error('Failed to fetch staff');
        return res.json();
    },

    // Admin
    admin: {
        getHeaders: (creds: string) => ({
            'Authorization': `Basic ${creds}`,
            'Content-Type': 'application/json',
        }),

        getStaff: async (creds: string, includeInactive: boolean = false): Promise<Staff[]> => {
            const params = includeInactive ? '?include_inactive=true' : '';
            const res = await fetch(`${API_BASE}/admin/staff${params}`, {
                headers: { 'Authorization': `Basic ${creds}` }
            });
            if (!res.ok) throw new Error('Failed to fetch staff');
            return res.json();
        },

        createStaff: async (creds: string, data: StaffCreate): Promise<Staff> => {
            const res = await fetch(`${API_BASE}/admin/staff`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${creds}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to create staff');
            return res.json();
        },

        updateStaff: async (creds: string, id: number, data: StaffUpdate): Promise<Staff> => {
            const res = await fetch(`${API_BASE}/admin/staff/${id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Basic ${creds}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to update staff');
            return res.json();
        },

        deleteStaff: async (creds: string, id: number) => {
            const res = await fetch(`${API_BASE}/admin/staff/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Basic ${creds}` }
            });
            if (!res.ok) throw new Error('Failed to delete staff');
            return res.json();
        },

        reorderStaff: async (creds: string, staffIds: number[]) => {
            const res = await fetch(`${API_BASE}/admin/staff/reorder`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${creds}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ staff_ids: staffIds })
            });
            if (!res.ok) throw new Error('Failed to reorder staff');
            return res.json();
        },

        getToilets: async (creds: string): Promise<Toilet[]> => {
            const res = await fetch(`${API_BASE}/admin/toilets`, {
                headers: { 'Authorization': `Basic ${creds}` }
            });
            if (!res.ok) throw new Error('Failed to fetch toilets');
            return res.json();
        },

        createToilet: async (creds: string, data: ToiletCreate): Promise<Toilet> => {
            const res = await fetch(`${API_BASE}/admin/toilets`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${creds}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to create toilet');
            return res.json();
        },

        // Settings
        getSettings: async (creds: string): Promise<{ key: string, value: string }[]> => {
            const res = await fetch(`${API_BASE}/admin/settings`, {
                headers: { 'Authorization': `Basic ${creds}` }
            });
            if (!res.ok) throw new Error('Failed to fetch settings');
            return res.json();
        },

        updateSetting: async (creds: string, key: string, value: string) => {
            const res = await fetch(`${API_BASE}/admin/settings?key=${key}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${creds}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ value })
            });
            if (!res.ok) throw new Error('Failed to update setting');
            return res.json();
        },
    }
};
