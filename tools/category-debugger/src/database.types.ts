export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      evaluation_crowd_signal_reviews: {
        Row: {
          created_at: string
          decision: string
          id: number
          note: string | null
          placement_zone_id: string | null
          product_family_id: string | null
          product_form_id: string | null
          reviewer_id: number
          signal_id: number
          training_approved: boolean
        }
        Insert: {
          created_at?: string
          decision: string
          id?: never
          note?: string | null
          placement_zone_id?: string | null
          product_family_id?: string | null
          product_form_id?: string | null
          reviewer_id: number
          signal_id: number
          training_approved?: boolean
        }
        Update: {
          created_at?: string
          decision?: string
          id?: never
          note?: string | null
          placement_zone_id?: string | null
          product_family_id?: string | null
          product_form_id?: string | null
          reviewer_id?: number
          signal_id?: number
          training_approved?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_crowd_signal_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "evaluation_reviewers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_crowd_signal_reviews_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "evaluation_crowd_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_crowd_signals: {
        Row: {
          actor_key: string
          barcode: string | null
          classifier_version: string
          event_id: string
          event_type: string
          from_zone_id: string | null
          household_key: string
          id: number
          occurred_at: string
          payload_sha256: string
          product_key: string
          product_name: string
          raw_payload: Json
          received_at: string
          schema_version: number
          source: string
          store_key: string | null
          to_zone_id: string
        }
        Insert: {
          actor_key: string
          barcode?: string | null
          classifier_version: string
          event_id: string
          event_type: string
          from_zone_id?: string | null
          household_key: string
          id?: never
          occurred_at: string
          payload_sha256: string
          product_key: string
          product_name: string
          raw_payload: Json
          received_at?: string
          schema_version: number
          source: string
          store_key?: string | null
          to_zone_id: string
        }
        Update: {
          actor_key?: string
          barcode?: string | null
          classifier_version?: string
          event_id?: string
          event_type?: string
          from_zone_id?: string | null
          household_key?: string
          id?: never
          occurred_at?: string
          payload_sha256?: string
          product_key?: string
          product_name?: string
          raw_payload?: Json
          received_at?: string
          schema_version?: number
          source?: string
          store_key?: string | null
          to_zone_id?: string
        }
        Relationships: []
      }
      evaluation_labels: {
        Row: {
          barcode: string | null
          brand: string | null
          category_tags: string[]
          classifier_version_at_label: string
          created_at: string
          dataset_split: string
          expected_category_id: string | null
          expected_placement_zone_id: string | null
          expected_product_family_id: string | null
          expected_product_form_id: string | null
          id: number
          note: string | null
          original_prediction_category_id: string | null
          original_prediction_source: string | null
          product_key: string
          product_name: string
          product_snapshot_hash: string
          quantity: string | null
          reviewer_id: number
          status: string
          taxonomy_version_at_label: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          category_tags?: string[]
          classifier_version_at_label: string
          created_at?: string
          dataset_split: string
          expected_category_id?: string | null
          expected_placement_zone_id?: string | null
          expected_product_family_id?: string | null
          expected_product_form_id?: string | null
          id?: never
          note?: string | null
          original_prediction_category_id?: string | null
          original_prediction_source?: string | null
          product_key: string
          product_name: string
          product_snapshot_hash: string
          quantity?: string | null
          reviewer_id: number
          status: string
          taxonomy_version_at_label?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          category_tags?: string[]
          classifier_version_at_label?: string
          created_at?: string
          dataset_split?: string
          expected_category_id?: string | null
          expected_placement_zone_id?: string | null
          expected_product_family_id?: string | null
          expected_product_form_id?: string | null
          id?: never
          note?: string | null
          original_prediction_category_id?: string | null
          original_prediction_source?: string | null
          product_key?: string
          product_name?: string
          product_snapshot_hash?: string
          quantity?: string | null
          reviewer_id?: number
          status?: string
          taxonomy_version_at_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_labels_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "evaluation_reviewers"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_reviewers: {
        Row: {
          created_at: string
          display_name: string
          id: number
          slug: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: never
          slug: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: never
          slug?: string
        }
        Relationships: []
      }
      evaluation_run_predictions: {
        Row: {
          conflict_reason: string | null
          label_id: number
          predicted_category_id: string | null
          prediction_source: string | null
          run_id: number
          trace: Json
        }
        Insert: {
          conflict_reason?: string | null
          label_id: number
          predicted_category_id?: string | null
          prediction_source?: string | null
          run_id: number
          trace: Json
        }
        Update: {
          conflict_reason?: string | null
          label_id?: number
          predicted_category_id?: string | null
          prediction_source?: string | null
          run_id?: number
          trace?: Json
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_run_predictions_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "evaluation_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_run_predictions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "evaluation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_runs: {
        Row: {
          classifier_fingerprint: string
          classifier_version: string
          created_at: string
          dump_fingerprint: string
          dump_product_count: number
          id: number
          label_count: number
          metrics: Json
          reviewer_id: number
        }
        Insert: {
          classifier_fingerprint: string
          classifier_version: string
          created_at?: string
          dump_fingerprint: string
          dump_product_count: number
          id?: never
          label_count: number
          metrics: Json
          reviewer_id: number
        }
        Update: {
          classifier_fingerprint?: string
          classifier_version?: string
          created_at?: string
          dump_fingerprint?: string
          dump_product_count?: number
          id?: never
          label_count?: number
          metrics?: Json
          reviewer_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_runs_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "evaluation_reviewers"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_silver_labels: {
        Row: {
          alternative_category_id: string | null
          annotation_status: string
          barcode: string | null
          brand: string | null
          category_tags: string[]
          created_at: string
          dataset_split: string
          evidence: string[]
          id: number
          model_name: string
          model_provider: string
          product_key: string
          product_name: string
          product_snapshot_hash: string
          prompt_fingerprint: string
          prompt_version: string
          proposed_category_id: string | null
          quantity: string | null
          rationale: string | null
          raw_response: Json
          review_status: string
          reviewer_id: number
          updated_at: string
        }
        Insert: {
          alternative_category_id?: string | null
          annotation_status: string
          barcode?: string | null
          brand?: string | null
          category_tags?: string[]
          created_at?: string
          dataset_split: string
          evidence?: string[]
          id?: never
          model_name: string
          model_provider: string
          product_key: string
          product_name: string
          product_snapshot_hash: string
          prompt_fingerprint: string
          prompt_version: string
          proposed_category_id?: string | null
          quantity?: string | null
          rationale?: string | null
          raw_response: Json
          review_status?: string
          reviewer_id: number
          updated_at?: string
        }
        Update: {
          alternative_category_id?: string | null
          annotation_status?: string
          barcode?: string | null
          brand?: string | null
          category_tags?: string[]
          created_at?: string
          dataset_split?: string
          evidence?: string[]
          id?: never
          model_name?: string
          model_provider?: string
          product_key?: string
          product_name?: string
          product_snapshot_hash?: string
          prompt_fingerprint?: string
          prompt_version?: string
          proposed_category_id?: string | null
          quantity?: string | null
          rationale?: string | null
          raw_response?: Json
          review_status?: string
          reviewer_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_silver_labels_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "evaluation_reviewers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
