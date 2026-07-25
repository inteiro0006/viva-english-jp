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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      course_stages: {
        Row: {
          course_id: string
          created_at: string
          description_en: string | null
          description_ja: string | null
          id: string
          position: number
          status: Database["public"]["Enums"]["content_status"]
          title_en: string
          title_ja: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description_en?: string | null
          description_ja?: string | null
          id?: string
          position?: number
          status?: Database["public"]["Enums"]["content_status"]
          title_en: string
          title_ja: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description_en?: string | null
          description_ja?: string | null
          id?: string
          position?: number
          status?: Database["public"]["Enums"]["content_status"]
          title_en?: string
          title_ja?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_stages_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          access_duration_days: number | null
          access_type: Database["public"]["Enums"]["access_type"]
          cover_url: string | null
          created_at: string
          description_en: string | null
          description_ja: string | null
          id: string
          price_jpy: number
          slug: string
          status: Database["public"]["Enums"]["course_status"]
          thumbnail_url: string | null
          title_en: string
          title_ja: string
          updated_at: string
        }
        Insert: {
          access_duration_days?: number | null
          access_type?: Database["public"]["Enums"]["access_type"]
          cover_url?: string | null
          created_at?: string
          description_en?: string | null
          description_ja?: string | null
          id?: string
          price_jpy?: number
          slug: string
          status?: Database["public"]["Enums"]["course_status"]
          thumbnail_url?: string | null
          title_en: string
          title_ja: string
          updated_at?: string
        }
        Update: {
          access_duration_days?: number | null
          access_type?: Database["public"]["Enums"]["access_type"]
          cover_url?: string | null
          created_at?: string
          description_en?: string | null
          description_ja?: string | null
          id?: string
          price_jpy?: number
          slug?: string
          status?: Database["public"]["Enums"]["course_status"]
          thumbnail_url?: string | null
          title_en?: string
          title_ja?: string
          updated_at?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          course_id: string
          created_at: string
          enrolled_at: string
          expires_at: string | null
          id: string
          order_id: string | null
          status: Database["public"]["Enums"]["enrollment_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          enrolled_at?: string
          expires_at?: string | null
          id?: string
          order_id?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          enrolled_at?: string
          expires_at?: string | null
          id?: string
          order_id?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_items: {
        Row: {
          answer_en: string
          answer_ja: string
          category: string | null
          created_at: string
          id: string
          position: number
          published: boolean
          question_en: string
          question_ja: string
          updated_at: string
        }
        Insert: {
          answer_en: string
          answer_ja: string
          category?: string | null
          created_at?: string
          id?: string
          position?: number
          published?: boolean
          question_en: string
          question_ja: string
          updated_at?: string
        }
        Update: {
          answer_en?: string
          answer_ja?: string
          category?: string | null
          created_at?: string
          id?: string
          position?: number
          published?: boolean
          question_en?: string
          question_ja?: string
          updated_at?: string
        }
        Relationships: []
      }
      lesson_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          last_watched_at: string
          lesson_id: string
          progress_percentage: number
          progress_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          last_watched_at?: string
          lesson_id: string
          progress_percentage?: number
          progress_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          last_watched_at?: string
          lesson_id?: string
          progress_percentage?: number
          progress_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_resources: {
        Row: {
          created_at: string
          file_url: string
          id: string
          lesson_id: string
          position: number
          resource_type: Database["public"]["Enums"]["resource_type"]
          title_en: string
          title_ja: string
        }
        Insert: {
          created_at?: string
          file_url: string
          id?: string
          lesson_id: string
          position?: number
          resource_type?: Database["public"]["Enums"]["resource_type"]
          title_en: string
          title_ja: string
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          lesson_id?: string
          position?: number
          resource_type?: Database["public"]["Enums"]["resource_type"]
          title_en?: string
          title_ja?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_resources_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          cloudflare_video_uid: string | null
          created_at: string
          description_en: string | null
          description_ja: string | null
          duration_seconds: number
          id: string
          is_preview: boolean
          lesson_type: Database["public"]["Enums"]["lesson_type"]
          module_id: string
          position: number
          status: Database["public"]["Enums"]["content_status"]
          title_en: string
          title_ja: string
          updated_at: string
        }
        Insert: {
          cloudflare_video_uid?: string | null
          created_at?: string
          description_en?: string | null
          description_ja?: string | null
          duration_seconds?: number
          id?: string
          is_preview?: boolean
          lesson_type?: Database["public"]["Enums"]["lesson_type"]
          module_id: string
          position?: number
          status?: Database["public"]["Enums"]["content_status"]
          title_en: string
          title_ja: string
          updated_at?: string
        }
        Update: {
          cloudflare_video_uid?: string | null
          created_at?: string
          description_en?: string | null
          description_ja?: string | null
          duration_seconds?: number
          id?: string
          is_preview?: boolean
          lesson_type?: Database["public"]["Enums"]["lesson_type"]
          module_id?: string
          position?: number
          status?: Database["public"]["Enums"]["content_status"]
          title_en?: string
          title_ja?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          course_id: string
          created_at: string
          description_en: string | null
          description_ja: string | null
          id: string
          position: number
          release_at: string | null
          release_type: Database["public"]["Enums"]["release_type"]
          stage_id: string | null
          status: Database["public"]["Enums"]["content_status"]
          thumbnail_url: string | null
          title_en: string
          title_ja: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description_en?: string | null
          description_ja?: string | null
          id?: string
          position?: number
          release_at?: string | null
          release_type?: Database["public"]["Enums"]["release_type"]
          stage_id?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          thumbnail_url?: string | null
          title_en: string
          title_ja: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description_en?: string | null
          description_ja?: string | null
          id?: string
          position?: number
          release_at?: string | null
          release_type?: Database["public"]["Enums"]["release_type"]
          stage_id?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          thumbnail_url?: string | null
          title_en?: string
          title_ja?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modules_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "course_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number
          course_id: string
          created_at: string
          currency: string
          customer_email: string | null
          id: string
          paid_at: string | null
          provider: string
          provider_checkout_id: string | null
          provider_payment_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          course_id: string
          created_at?: string
          currency?: string
          customer_email?: string | null
          id?: string
          paid_at?: string | null
          provider?: string
          provider_checkout_id?: string | null
          provider_payment_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          course_id?: string
          created_at?: string
          currency?: string
          customer_email?: string | null
          id?: string
          paid_at?: string | null
          provider?: string
          provider_checkout_id?: string | null
          provider_payment_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json
          processed: boolean
          processing_error: string | null
          provider: string
          provider_event_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          processed?: boolean
          processing_error?: string | null
          provider: string
          provider_event_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean
          processing_error?: string | null
          provider?: string
          provider_event_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          marketing_consent: boolean
          preferred_language: Database["public"]["Enums"]["preferred_language"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          marketing_consent?: boolean
          preferred_language?: Database["public"]["Enums"]["preferred_language"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          marketing_consent?: boolean
          preferred_language?: Database["public"]["Enums"]["preferred_language"]
          updated_at?: string
        }
        Relationships: []
      }
      stream_videos: {
        Row: {
          cloudflare_uid: string
          created_at: string
          duration_seconds: number | null
          id: string
          meta: Json
          preview_url: string | null
          ready_to_stream: boolean
          require_signed_urls: boolean
          status: string
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          cloudflare_uid: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          meta?: Json
          preview_url?: string | null
          ready_to_stream?: boolean
          require_signed_urls?: boolean
          status?: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          cloudflare_uid?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          meta?: Json
          preview_url?: string | null
          ready_to_stream?: boolean
          require_signed_urls?: boolean
          status?: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      stream_webhook_events: {
        Row: {
          cloudflare_uid: string | null
          event_id: string | null
          event_type: string | null
          id: string
          payload: Json
          received_at: string
        }
        Insert: {
          cloudflare_uid?: string | null
          event_id?: string | null
          event_type?: string | null
          id?: string
          payload: Json
          received_at?: string
        }
        Update: {
          cloudflare_uid?: string | null
          event_id?: string | null
          event_type?: string | null
          id?: string
          payload?: Json
          received_at?: string
        }
        Relationships: []
      }
      support_requests: {
        Row: {
          created_at: string
          id: string
          message: string
          status: Database["public"]["Enums"]["support_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          status?: Database["public"]["Enums"]["support_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          status?: Database["public"]["Enums"]["support_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          avatar_url: string | null
          content_en: string
          content_ja: string
          created_at: string
          id: string
          name: string
          occupation_en: string | null
          occupation_ja: string | null
          position: number
          published: boolean
          rating: number | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          content_en: string
          content_ja: string
          created_at?: string
          id?: string
          name: string
          occupation_en?: string | null
          occupation_ja?: string | null
          position?: number
          published?: boolean
          rating?: number | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          content_en?: string
          content_ja?: string
          created_at?: string
          id?: string
          name?: string
          occupation_en?: string | null
          occupation_ja?: string | null
          position?: number
          published?: boolean
          rating?: number | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_course_progress: {
        Args: { _course_id: string; _uid: string }
        Returns: {
          completed_lessons: number
          last_lesson_id: string
          last_watched_at: string
          percentage: number
          total_lessons: number
        }[]
      }
      get_next_lesson: {
        Args: { _course_id: string; _uid: string }
        Returns: string
      }
      has_active_enrollment: {
        Args: { _course_id: string; _uid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      is_module_released: { Args: { _module_id: string }; Returns: boolean }
    }
    Enums: {
      access_type: "lifetime" | "limited"
      app_role: "student" | "admin"
      content_status: "draft" | "published" | "archived"
      course_status: "draft" | "published" | "archived"
      enrollment_status: "active" | "expired" | "revoked" | "refunded"
      lesson_type: "video" | "text" | "quiz" | "file"
      order_status:
        | "pending"
        | "paid"
        | "failed"
        | "refunded"
        | "partially_refunded"
      preferred_language: "ja" | "en"
      release_type: "immediate" | "date" | "after_previous"
      resource_type: "pdf" | "link" | "download" | "other"
      support_status: "open" | "in_progress" | "resolved" | "closed"
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
    Enums: {
      access_type: ["lifetime", "limited"],
      app_role: ["student", "admin"],
      content_status: ["draft", "published", "archived"],
      course_status: ["draft", "published", "archived"],
      enrollment_status: ["active", "expired", "revoked", "refunded"],
      lesson_type: ["video", "text", "quiz", "file"],
      order_status: [
        "pending",
        "paid",
        "failed",
        "refunded",
        "partially_refunded",
      ],
      preferred_language: ["ja", "en"],
      release_type: ["immediate", "date", "after_previous"],
      resource_type: ["pdf", "link", "download", "other"],
      support_status: ["open", "in_progress", "resolved", "closed"],
    },
  },
} as const
