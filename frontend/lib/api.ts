import { Staff, Toilet, DashboardDayResponse, StaffCreate, StaffUpdate, ToiletCreate } from './types';

const API_HOST = process.env.NEXT_PUBLIC_API_HOST || 'http://localhost:8000';
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

        getStaff: async (creds: string): Promise<Staff[]> => {
            const res = await fetch(`${API_BASE}/admin/staff`, {
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

        getMajorCheckpoints: async (creds: string) => {
            const res = await fetch(`${API_BASE}/admin/major-checkpoints`, {
                headers: { 'Authorization': `Basic ${creds}` }
            });
            if (!res.ok) throw new Error('Failed to fetch checkpoints');
            return res.json();
        },

        // ... add other admin methods as needed (toilets, settings)
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
    }
};
