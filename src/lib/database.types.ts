export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      child_profiles: {
        Row: {
          birth_date: string | null
          created_at: string
          display_name: string
          height_cm: number | null
          household_id: string
          id: string
          managed_by: string | null
          sex: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          display_name: string
          height_cm?: number | null
          household_id: string
          id?: string
          managed_by?: string | null
          sex?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          display_name?: string
          height_cm?: number | null
          household_id?: string
          id?: string
          managed_by?: string | null
          sex?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "child_profiles_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_profiles_managed_by_fkey"
            columns: ["managed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      food_entries: {
        Row: {
          carbs_g: number | null
          child_profile_id: string | null
          created_at: string
          deleted_at: string | null
          fat_g: number | null
          id: string
          kcal: number | null
          logged_on: string
          meal_type: string
          name: string
          product_id: string | null
          protein_g: number | null
          quantity: number
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          carbs_g?: number | null
          child_profile_id?: string | null
          created_at?: string
          deleted_at?: string | null
          fat_g?: number | null
          id?: string
          kcal?: number | null
          logged_on?: string
          meal_type: string
          name: string
          product_id?: string | null
          protein_g?: number | null
          quantity: number
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          carbs_g?: number | null
          child_profile_id?: string | null
          created_at?: string
          deleted_at?: string | null
          fat_g?: number | null
          id?: string
          kcal?: number | null
          logged_on?: string
          meal_type?: string
          name?: string
          product_id?: string | null
          protein_g?: number | null
          quantity?: number
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_entries_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fridge_items: {
        Row: {
          added_by: string | null
          created_at: string
          deleted_at: string | null
          expiry_date: string | null
          household_id: string
          id: string
          location_id: string | null
          name: string
          product_id: string | null
          quantity: number
          unit: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          deleted_at?: string | null
          expiry_date?: string | null
          household_id: string
          id?: string
          location_id?: string | null
          name: string
          product_id?: string | null
          quantity?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          deleted_at?: string | null
          expiry_date?: string | null
          household_id?: string
          id?: string
          location_id?: string | null
          name?: string
          product_id?: string | null
          quantity?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fridge_items_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fridge_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fridge_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fridge_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          household_id: string
          id: string
          max_uses: number
          revoked_at: string | null
          token: string
          updated_at: string
          uses: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string
          household_id: string
          id?: string
          max_uses?: number
          revoked_at?: string | null
          token?: string
          updated_at?: string
          uses?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          household_id?: string
          id?: string
          max_uses?: number
          revoked_at?: string | null
          token?: string
          updated_at?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "household_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_invites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          household_id: string
          joined_at: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          household_id: string
          joined_at?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          household_id?: string
          joined_at?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "households_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          brand: string | null
          carbs_g_per_100: number | null
          created_at: string
          created_by: string | null
          fat_g_per_100: number | null
          fiber_g_per_100: number | null
          id: string
          kcal_per_100: number | null
          name: string
          protein_g_per_100: number | null
          salt_g_per_100: number | null
          serving_size_g: number | null
          source: string
          sugar_g_per_100: number | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          carbs_g_per_100?: number | null
          created_at?: string
          created_by?: string | null
          fat_g_per_100?: number | null
          fiber_g_per_100?: number | null
          id?: string
          kcal_per_100?: number | null
          name: string
          protein_g_per_100?: number | null
          salt_g_per_100?: number | null
          serving_size_g?: number | null
          source?: string
          sugar_g_per_100?: number | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          carbs_g_per_100?: number | null
          created_at?: string
          created_by?: string | null
          fat_g_per_100?: number | null
          fiber_g_per_100?: number | null
          id?: string
          kcal_per_100?: number | null
          name?: string
          protein_g_per_100?: number | null
          salt_g_per_100?: number | null
          serving_size_g?: number | null
          source?: string
          sugar_g_per_100?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activity_level: string | null
          avatar_url: string | null
          birth_date: string | null
          created_at: string
          display_name: string | null
          height_cm: number | null
          id: string
          onboarding_completed_at: string | null
          sex: string | null
          updated_at: string
        }
        Insert: {
          activity_level?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          display_name?: string | null
          height_cm?: number | null
          id: string
          onboarding_completed_at?: string | null
          sex?: string | null
          updated_at?: string
        }
        Update: {
          activity_level?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          display_name?: string | null
          height_cm?: number | null
          id?: string
          onboarding_completed_at?: string | null
          sex?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shopping_history: {
        Row: {
          category: string | null
          completed_at: string
          completed_by: string | null
          created_at: string
          expiry_date: string | null
          household_id: string
          id: string
          item_name: string
          location_kind: string | null
          product_id: string | null
          quantity: number
          unit: string
        }
        Insert: {
          category?: string | null
          completed_at: string
          completed_by?: string | null
          created_at?: string
          expiry_date?: string | null
          household_id: string
          id?: string
          item_name: string
          location_kind?: string | null
          product_id?: string | null
          quantity: number
          unit: string
        }
        Update: {
          category?: string | null
          completed_at?: string
          completed_by?: string | null
          created_at?: string
          expiry_date?: string | null
          household_id?: string
          id?: string
          item_name?: string
          location_kind?: string | null
          product_id?: string | null
          quantity?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_history_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_history_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_list_items: {
        Row: {
          added_by: string | null
          category: string | null
          checked_at: string | null
          checked_by: string | null
          created_at: string
          deleted_at: string | null
          household_id: string
          id: string
          name: string
          product_id: string | null
          quantity: number
          sort_index: number
          unit: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          category?: string | null
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          deleted_at?: string | null
          household_id: string
          id?: string
          name: string
          product_id?: string | null
          quantity?: number
          sort_index?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          category?: string | null
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          deleted_at?: string | null
          household_id?: string
          id?: string
          name?: string
          product_id?: string | null
          quantity?: number
          sort_index?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_list_items_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_list_items_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_list_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_list_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_locations: {
        Row: {
          created_at: string
          deleted_at: string | null
          household_id: string
          id: string
          kind: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          household_id: string
          id?: string
          kind: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          household_id?: string
          id?: string
          kind?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storage_locations_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      user_goals: {
        Row: {
          carbs_g: number | null
          child_profile_id: string | null
          created_at: string
          daily_kcal: number | null
          deleted_at: string | null
          fat_g: number | null
          goal_type: string
          id: string
          protein_g: number | null
          rate_kg_per_week: number | null
          target_weight_kg: number | null
          updated_at: string
          user_id: string
          valid_from: string
        }
        Insert: {
          carbs_g?: number | null
          child_profile_id?: string | null
          created_at?: string
          daily_kcal?: number | null
          deleted_at?: string | null
          fat_g?: number | null
          goal_type: string
          id?: string
          protein_g?: number | null
          rate_kg_per_week?: number | null
          target_weight_kg?: number | null
          updated_at?: string
          user_id: string
          valid_from?: string
        }
        Update: {
          carbs_g?: number | null
          child_profile_id?: string | null
          created_at?: string
          daily_kcal?: number | null
          deleted_at?: string | null
          fat_g?: number | null
          goal_type?: string
          id?: string
          protein_g?: number | null
          rate_kg_per_week?: number | null
          target_weight_kg?: number | null
          updated_at?: string
          user_id?: string
          valid_from?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_goals_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weight_entries: {
        Row: {
          chest_cm: number | null
          child_profile_id: string | null
          created_at: string
          deleted_at: string | null
          hip_cm: number | null
          id: string
          measured_on: string
          updated_at: string
          user_id: string
          waist_cm: number | null
          weight_kg: number
        }
        Insert: {
          chest_cm?: number | null
          child_profile_id?: string | null
          created_at?: string
          deleted_at?: string | null
          hip_cm?: number | null
          id?: string
          measured_on?: string
          updated_at?: string
          user_id: string
          waist_cm?: number | null
          weight_kg: number
        }
        Update: {
          chest_cm?: number | null
          child_profile_id?: string | null
          created_at?: string
          deleted_at?: string | null
          hip_cm?: number | null
          id?: string
          measured_on?: string
          updated_at?: string
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_entries_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "child_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weight_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_household: { Args: { household_name: string }; Returns: string }
      household_member_profiles: {
        Args: { hid: string }
        Returns: {
          avatar_url: string
          display_name: string
          joined_at: string
          role: string
          user_id: string
        }[]
      }
      redeem_invite: { Args: { invite_token: string }; Returns: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

