export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          avatar_url: string | null;
          onboarded: boolean;
          is_wall_account: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name: string;
          avatar_url?: string | null;
          onboarded?: boolean;
          is_wall_account?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string;
          avatar_url?: string | null;
          onboarded?: boolean;
          is_wall_account?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: { id: string; name: string; slug: string; icon: string | null };
        Insert: { id?: string; name: string; slug: string; icon?: string | null };
        Update: { id?: string; name?: string; slug?: string; icon?: string | null };
        Relationships: [];
      };
      ads: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string;
          price: number | null;
          category: string;
          region: string;
          phone: string | null;
          status: "active" | "reserved" | "sold" | "expired";
          images: string[];
          lat: number | null;
          lng: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description: string;
          price?: number | null;
          category: string;
          region: string;
          phone?: string | null;
          status?: "active" | "reserved" | "sold" | "expired";
          images?: string[];
          lat?: number | null;
          lng?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string;
          price?: number | null;
          category?: string;
          region?: string;
          phone?: string | null;
          status?: "active" | "reserved" | "sold" | "expired";
          images?: string[];
          lat?: number | null;
          lng?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      favorites: {
        Row: { id: string; user_id: string; ad_id: string; created_at: string };
        Insert: { id?: string; user_id: string; ad_id: string; created_at?: string };
        Update: { id?: string; user_id?: string; ad_id?: string; created_at?: string };
        Relationships: [];
      };
      businesses: {
        Row: {
          id: string;
          owner_id: string | null;
          name: string;
          category: string;
          address: string;
          phone: string | null;
          description: string | null;
          hours: string | null;
          image_url: string | null;
          icon: string;
          lat: number | null;
          lng: number | null;
          subscription_tier: "bronze" | "silver" | "gold" | null;
          subscription_status: "pending" | "approved" | "rejected" | "suspended";
          receipt_url: string | null;
          submitted_at: string;
          reviewed_at: string | null;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id?: string | null;
          name: string;
          category: string;
          address: string;
          phone?: string | null;
          description?: string | null;
          hours?: string | null;
          image_url?: string | null;
          icon?: string;
          lat?: number | null;
          lng?: number | null;
          subscription_tier?: "bronze" | "silver" | "gold" | null;
          subscription_status?: "pending" | "approved" | "rejected" | "suspended";
          receipt_url?: string | null;
          submitted_at?: string;
          reviewed_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string | null;
          name?: string;
          category?: string;
          address?: string;
          phone?: string | null;
          description?: string | null;
          hours?: string | null;
          image_url?: string | null;
          icon?: string;
          lat?: number | null;
          lng?: number | null;
          subscription_tier?: "bronze" | "silver" | "gold" | null;
          subscription_status?: "pending" | "approved" | "rejected" | "suspended";
          receipt_url?: string | null;
          submitted_at?: string;
          reviewed_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      business_products: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          price: number | null;
          description: string | null;
          image_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          price?: number | null;
          description?: string | null;
          image_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          price?: number | null;
          description?: string | null;
          image_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      wall_messages: {
        Row: {
          id: string;
          user_id: string;
          content: string | null;
          image_url: string | null;
          is_promo: boolean;
          business_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content?: string | null;
          image_url?: string | null;
          is_promo?: boolean;
          business_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          content?: string | null;
          image_url?: string | null;
          is_promo?: boolean;
          business_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          user_one: string;
          user_two: string;
          ad_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_one: string;
          user_two: string;
          ad_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_one?: string;
          user_two?: string;
          ad_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      wall_message_likes: {
        Row: {
          message_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          message_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          message_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      private_messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          content: string | null;
          message_type: "text" | "image" | "voice";
          media_url: string | null;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          content?: string | null;
          message_type?: "text" | "image" | "voice";
          media_url?: string | null;
          created_at?: string;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          content?: string | null;
          message_type?: "text" | "image" | "voice";
          media_url?: string | null;
          created_at?: string;
          read_at?: string | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          payload: Json;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          payload?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          payload?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
