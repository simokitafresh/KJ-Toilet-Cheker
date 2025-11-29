export interface Staff {
    id: number;
    internal_name: string;
    icon_code: string;
    display_order: number;
    is_active: boolean;
}

export interface Toilet {
    id: number;
    name: string;
    floor?: string;
    is_active: boolean;
}

export interface MajorCheckpointStatus {
    name: string;
    status: 'pending' | 'completed' | 'missed';
    last_check_time?: string;
}

export interface RealtimeAlert {
    toilet_name: string;
    minutes_elapsed: number;
    alert_level: 'warning' | 'alert';
}

export interface TimelineItem {
    id: number;
    checked_at: string;
    staff_icon: string;
    status_type: 'NORMAL' | 'TOO_SHORT' | 'TOO_LONG';
    thumbnails: string[];
}

export interface DashboardDayResponse {
    major_checkpoints: MajorCheckpointStatus[];
    realtime_alerts: RealtimeAlert[];
    timeline: TimelineItem[];
}

export interface StaffCreate {
    internal_name: string;
    icon_code: string;
}

export interface StaffUpdate {
    internal_name?: string;
    icon_code?: string;
    display_order?: number;
    is_active?: boolean;
}

export interface ToiletCreate {
    name: string;
}

export interface MajorCheckpoint {
    id: number;
    name: string;
    start_time: string;
    end_time: string;
    target_toilet_id?: number;
    is_active: boolean;
    display_order: number;
}
