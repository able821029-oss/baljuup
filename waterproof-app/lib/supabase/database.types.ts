/**
 * Supabase 데이터베이스 타입
 *
 * 자동 생성 권장:
 *   npx supabase gen types typescript --linked > lib/supabase/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ============================================================
// 도메인 타입
// ============================================================
export interface Complex {
  id: string;
  kapt_code: string;
  name: string;
  address: string | null;
  sido: string | null;
  sigungu: string | null;
  built_year: number | null;
  households: number | null;
  buildings: number | null;
  management_type: string | null;
  management_company: string | null;
  phone: string | null;
  prediction_score: number;
  expected_order_year: number | null;
  last_updated: string;
  created_at: string;
}

export interface MaintenanceHistory {
  id: string;
  complex_id: string;
  work_type: string | null;
  work_year: number | null;
  work_amount: number | null;
  is_waterproof: boolean;
  source: string;
  created_at: string;
}

export interface BidAnnouncement {
  id: string;
  complex_id: string;
  announcement_no: string | null;
  title: string | null;
  work_type: string | null;
  estimated_amount: number | null;
  announced_at: string | null;
  deadline_at: string | null;
  status: string;
  notified: boolean;
  created_at: string;
}

export interface MaintenanceFund {
  id: string;
  complex_id: string;
  year_month: string | null;
  fund_balance: number | null;
  monthly_amount: number | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  company_name: string | null;
  owner_name: string | null;
  phone: string | null;
  region: string[] | null;
  plan: string;
  trial_ends_at: string | null;
  kakao_id: string | null;
  created_at: string;
}

export interface Proposal {
  id: string;
  user_id: string;
  complex_id: string;
  title: string | null;
  status: string;
  content: Json | null;
  pdf_url: string | null;
  before_image_url: string | null;
  after_image_url: string | null;
  won_at: string | null;
  created_at: string;
}

export interface ComplexPredictionView {
  id: string;
  kapt_code: string;
  name: string;
  address: string | null;
  built_year: number | null;
  households: number | null;
  phone: string | null;
  prediction_score: number;
  expected_order_year: number | null;
  last_waterproof_year: number | null;
  latest_fund_balance: number | null;
  active_bids: number;
}

// ============================================================
// 관심단지 영업 추적 (사용자별)
// ============================================================
export type SalesTrackingStatus =
  | "interested"  // 관심
  | "contacted"   // 연락중
  | "meeting"     // 미팅예정/진행
  | "proposed"    // 제안완료
  | "won"         // 수주
  | "lost"        // 실패
  | "on_hold";    // 보류

export type SalesTrackingPriority = "high" | "normal" | "low";

export interface SalesTracking {
  id: string;
  user_id: string;
  complex_id: string;
  status: SalesTrackingStatus;
  priority: SalesTrackingPriority;
  last_contact_at: string | null;
  next_action_at: string | null;
  memo: string | null;
  closed_at: string | null;
  contract_amount: number | null;
  created_at: string;
  updated_at: string;
}

export interface SalesTrackingWithComplexView extends SalesTracking {
  complex_name: string;
  complex_address: string | null;
  complex_sido: string | null;
  complex_sigungu: string | null;
  complex_built_year: number | null;
  complex_households: number | null;
  complex_phone: string | null;
  complex_management_type: string | null;
  prediction_score: number;
  expected_order_year: number | null;
}

// ============================================================
// Supabase Database 타입 (supabase gen 표준 구조)
// ============================================================
export interface Database {
  public: {
    Tables: {
      complexes: {
        Row: Complex;
        Insert: Pick<Complex, "kapt_code" | "name"> & Partial<Complex>;
        Update: Partial<Complex>;
        Relationships: [];
      };
      maintenance_history: {
        Row: MaintenanceHistory;
        Insert: Pick<MaintenanceHistory, "complex_id"> & Partial<MaintenanceHistory>;
        Update: Partial<MaintenanceHistory>;
        Relationships: [];
      };
      bid_announcements: {
        Row: BidAnnouncement;
        Insert: Pick<BidAnnouncement, "complex_id"> & Partial<BidAnnouncement>;
        Update: Partial<BidAnnouncement>;
        Relationships: [];
      };
      maintenance_funds: {
        Row: MaintenanceFund;
        Insert: Pick<MaintenanceFund, "complex_id"> & Partial<MaintenanceFund>;
        Update: Partial<MaintenanceFund>;
        Relationships: [];
      };
      user_profiles: {
        Row: UserProfile;
        Insert: Pick<UserProfile, "id"> & Partial<UserProfile>;
        Update: Partial<UserProfile>;
        Relationships: [];
      };
      proposals: {
        Row: Proposal;
        Insert: Pick<Proposal, "user_id" | "complex_id"> & Partial<Proposal>;
        Update: Partial<Proposal>;
        Relationships: [];
      };
      sales_tracking: {
        Row: SalesTracking;
        Insert: Pick<SalesTracking, "user_id" | "complex_id"> & Partial<SalesTracking>;
        Update: Partial<SalesTracking>;
        Relationships: [];
      };
    };
    Views: {
      complex_predictions: {
        Row: ComplexPredictionView;
        Relationships: [];
      };
      sales_tracking_with_complex: {
        Row: SalesTrackingWithComplexView;
        Relationships: [];
      };
    };
    Functions: { [k: string]: never };
    Enums: { [k: string]: never };
    CompositeTypes: { [k: string]: never };
  };
}
