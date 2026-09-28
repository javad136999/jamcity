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
      ads: {
        Row: {
          category: string
          city_id: string
          created_at: string
          description: string
          id: string
          images: string[]
          lat: number | null
          lng: number | null
          phone: string | null
          price: number | null
          region: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          category: string
          city_id: string
          created_at?: string
          description: string
          id?: string
          images?: string[]
          lat?: number | null
          lng?: number | null
          phone?: string | null
          price?: number | null
          region: string
          status?: string
          title: string
          user_id: string
        }
        Update: {
          category?: string
          city_id?: string
          created_at?: string
          description?: string
          id?: string
          images?: string[]
          lat?: number | null
          lng?: number | null
          phone?: string | null
          price?: number | null
          region?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_ad_templates: {
        Row: {
          active: boolean
          body: string
          created_at: string
          id: number
          title: string
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          id?: number
          title: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          id?: number
          title?: string
        }
        Relationships: []
      }
      auto_ads_settings: {
        Row: {
          enabled: boolean
          id: boolean
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          id?: boolean
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      business_products: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          discount_percent: number | null
          id: string
          image_url: string | null
          name: string
          price: number | null
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          id?: string
          image_url?: string | null
          name: string
          price?: number | null
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "business_products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_ratings: {
        Row: {
          business_id: string
          created_at: string
          rating: number
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          rating: number
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_ratings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string
          category: string
          city_id: string
          created_at: string
          description: string | null
          expires_at: string | null
          hours: string | null
          icon: string
          id: string
          image_url: string | null
          lat: number | null
          lng: number | null
          name: string
          owner_id: string | null
          phone: string | null
          rating_avg: number
          rating_count: number
          receipt_url: string | null
          reviewed_at: string | null
          submitted_at: string
          subscription_months: number
          subscription_status: string
          subscription_tier: string | null
        }
        Insert: {
          address: string
          category: string
          city_id: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          hours?: string | null
          icon?: string
          id?: string
          image_url?: string | null
          lat?: number | null
          lng?: number | null
          name: string
          owner_id?: string | null
          phone?: string | null
          rating_avg?: number
          rating_count?: number
          receipt_url?: string | null
          reviewed_at?: string | null
          submitted_at?: string
          subscription_months?: number
          subscription_status?: string
          subscription_tier?: string | null
        }
        Update: {
          address?: string
          category?: string
          city_id?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          hours?: string | null
          icon?: string
          id?: string
          image_url?: string | null
          lat?: number | null
          lng?: number | null
          name?: string
          owner_id?: string | null
          phone?: string | null
          rating_avg?: number
          rating_count?: number
          receipt_url?: string | null
          reviewed_at?: string | null
          submitted_at?: string
          subscription_months?: number
          subscription_status?: string
          subscription_tier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "businesses_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          icon: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          icon?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          icon?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      cities: {
        Row: {
          center_lat: number
          center_lng: number
          created_at: string
          east_lng: number
          id: string
          is_active: boolean
          max_zoom: number
          min_zoom: number
          name: string
          north_lat: number
          slug: string
          south_lat: number
          west_lng: number
          zoom: number
        }
        Insert: {
          center_lat: number
          center_lng: number
          created_at?: string
          east_lng: number
          id?: string
          is_active?: boolean
          max_zoom?: number
          min_zoom?: number
          name: string
          north_lat: number
          slug: string
          south_lat: number
          west_lng: number
          zoom?: number
        }
        Update: {
          center_lat?: number
          center_lng?: number
          created_at?: string
          east_lng?: number
          id?: string
          is_active?: boolean
          max_zoom?: number
          min_zoom?: number
          name?: string
          north_lat?: number
          slug?: string
          south_lat?: number
          west_lng?: number
          zoom?: number
        }
        Relationships: []
      }
      coin_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          ad_id: string | null
          created_at: string
          id: string
          user_one: string
          user_two: string
        }
        Insert: {
          ad_id?: string | null
          created_at?: string
          id?: string
          user_one: string
          user_two: string
        }
        Update: {
          ad_id?: string | null
          created_at?: string
          id?: string
          user_one?: string
          user_two?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user_one_fkey"
            columns: ["user_one"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user_two_fkey"
            columns: ["user_two"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          event_date: string | null
          event_time: string | null
          id: string
          image_url: string | null
          is_featured: boolean
          is_published: boolean
          location: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          event_date?: string | null
          event_time?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean
          is_published?: boolean
          location?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          event_date?: string | null
          event_time?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean
          is_published?: boolean
          location?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          ad_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          ad_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          ad_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      footwear_bag_listings: {
        Row: {
          brand: string
          business_id: string
          color: string | null
          created_at: string
          id: string
          image_urls: string[]
          material: string | null
          price: number | null
          product_type: string
          size: string | null
          stock_quantity: number | null
        }
        Insert: {
          brand: string
          business_id: string
          color?: string | null
          created_at?: string
          id?: string
          image_urls?: string[]
          material?: string | null
          price?: number | null
          product_type: string
          size?: string | null
          stock_quantity?: number | null
        }
        Update: {
          brand?: string
          business_id?: string
          color?: string | null
          created_at?: string
          id?: string
          image_urls?: string[]
          material?: string | null
          price?: number | null
          product_type?: string
          size?: string | null
          stock_quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "footwear_bag_listings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      gold_wall_rotation: {
        Row: {
          id: boolean
          next_offset: number
          updated_at: string
        }
        Insert: {
          id?: boolean
          next_offset?: number
          updated_at?: string
        }
        Update: {
          id?: boolean
          next_offset?: number
          updated_at?: string
        }
        Relationships: []
      }
      hokm_hakem_draws: {
        Row: {
          card: Json
          created_at: string
          match_id: string
          seat: number
          user_id: string
        }
        Insert: {
          card: Json
          created_at?: string
          match_id: string
          seat: number
          user_id: string
        }
        Update: {
          card?: Json
          created_at?: string
          match_id?: string
          seat?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hokm_hakem_draws_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "hokm_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      hokm_hands: {
        Row: {
          cards: Json
          match_id: string
          seat: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cards?: Json
          match_id: string
          seat: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cards?: Json
          match_id?: string
          seat?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hokm_hands_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "hokm_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      hokm_matches: {
        Row: {
          created_at: string
          current_trick: Json
          deck: Json
          hakem_round: number
          hakem_seat: number | null
          hakem_team: number | null
          id: string
          lead_suit: string | null
          phase: string
          room_id: string
          round_wins: Json
          status: string
          team_scores: Json
          trick_no: number
          trump: string | null
          trump_deadline: string | null
          turn_seat: number
          updated_at: string
          winner_team: number | null
        }
        Insert: {
          created_at?: string
          current_trick?: Json
          deck?: Json
          hakem_round?: number
          hakem_seat?: number | null
          hakem_team?: number | null
          id?: string
          lead_suit?: string | null
          phase?: string
          room_id: string
          round_wins?: Json
          status?: string
          team_scores?: Json
          trick_no?: number
          trump?: string | null
          trump_deadline?: string | null
          turn_seat?: number
          updated_at?: string
          winner_team?: number | null
        }
        Update: {
          created_at?: string
          current_trick?: Json
          deck?: Json
          hakem_round?: number
          hakem_seat?: number | null
          hakem_team?: number | null
          id?: string
          lead_suit?: string | null
          phase?: string
          room_id?: string
          round_wins?: Json
          status?: string
          team_scores?: Json
          trick_no?: number
          trump?: string | null
          trump_deadline?: string | null
          turn_seat?: number
          updated_at?: string
          winner_team?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hokm_matches_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "hokm_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      hokm_moves: {
        Row: {
          card: Json
          created_at: string
          id: string
          match_id: string
          seat: number
          trick_no: number
          user_id: string
        }
        Insert: {
          card: Json
          created_at?: string
          id?: string
          match_id: string
          seat: number
          trick_no: number
          user_id: string
        }
        Update: {
          card?: Json
          created_at?: string
          id?: string
          match_id?: string
          seat?: number
          trick_no?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hokm_moves_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "hokm_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      hokm_player_stats: {
        Row: {
          best_streak: number
          current_streak: number
          losses: number
          rating: number
          total_games: number
          updated_at: string
          user_id: string
          wins: number
        }
        Insert: {
          best_streak?: number
          current_streak?: number
          losses?: number
          rating?: number
          total_games?: number
          updated_at?: string
          user_id: string
          wins?: number
        }
        Update: {
          best_streak?: number
          current_streak?: number
          losses?: number
          rating?: number
          total_games?: number
          updated_at?: string
          user_id?: string
          wins?: number
        }
        Relationships: []
      }
      hokm_players: {
        Row: {
          joined_at: string
          name: string
          room_id: string
          seat: number
          user_id: string
        }
        Insert: {
          joined_at?: string
          name: string
          room_id: string
          seat: number
          user_id: string
        }
        Update: {
          joined_at?: string
          name?: string
          room_id?: string
          seat?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hokm_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "hokm_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      hokm_rooms: {
        Row: {
          created_at: string
          host_id: string | null
          id: string
          status: string
          trump: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          host_id?: string | null
          id?: string
          status?: string
          trump?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          host_id?: string | null
          id?: string
          status?: string
          trump?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      insurance_requests: {
        Row: {
          created_at: string
          id: string
          insurance_type: string
          phone: string
          previous_discount_percent: number | null
          status: string
          user_id: string
          vehicle_card_image_path: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          insurance_type: string
          phone: string
          previous_discount_percent?: number | null
          status?: string
          user_id: string
          vehicle_card_image_path?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          insurance_type?: string
          phone?: string
          previous_discount_percent?: number | null
          status?: string
          user_id?: string
          vehicle_card_image_path?: string | null
        }
        Relationships: []
      }
      jamcity_content: {
        Row: {
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          is_automatic: boolean
          is_published: boolean
          published_at: string
          section: string
          sentiment: string | null
          source_name: string | null
          source_url: string | null
          summary: string | null
          symbol: string | null
          target_price: number | null
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_automatic?: boolean
          is_published?: boolean
          published_at?: string
          section: string
          sentiment?: string | null
          source_name?: string | null
          source_url?: string | null
          summary?: string | null
          symbol?: string | null
          target_price?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_automatic?: boolean
          is_published?: boolean
          published_at?: string
          section?: string
          sentiment?: string | null
          source_name?: string | null
          source_url?: string | null
          summary?: string | null
          symbol?: string | null
          target_price?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      market_prices: {
        Row: {
          category: string
          change_percent: number | null
          change_value: number | null
          is_up: boolean | null
          name_fa: string
          price: number
          symbol: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          category: string
          change_percent?: number | null
          change_value?: number | null
          is_up?: boolean | null
          name_fa: string
          price: number
          symbol: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          change_percent?: number | null
          change_value?: number | null
          is_up?: boolean | null
          name_fa?: string
          price?: number
          symbol?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          payload: Json
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      private_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          media_url: string | null
          message_type: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          media_url?: string | null
          message_type?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          media_url?: string | null
          message_type?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banned: boolean
          city_id: string
          created_at: string
          display_name: string
          id: string
          is_admin: boolean
          is_wall_account: boolean
          onboarded: boolean
          recovery_phrase_hash: string | null
          referral_code: string | null
          referred_by: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          banned?: boolean
          city_id: string
          created_at?: string
          display_name: string
          id: string
          is_admin?: boolean
          is_wall_account?: boolean
          onboarded?: boolean
          recovery_phrase_hash?: string | null
          referral_code?: string | null
          referred_by?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          banned?: boolean
          city_id?: string
          created_at?: string
          display_name?: string
          id?: string
          is_admin?: boolean
          is_wall_account?: boolean
          onboarded?: boolean
          recovery_phrase_hash?: string | null
          referral_code?: string | null
          referred_by?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          enabled: boolean
          endpoint: string
          id: string
          last_sent_at: string | null
          p256dh: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          enabled?: boolean
          endpoint: string
          id?: string
          last_sent_at?: string | null
          p256dh: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          enabled?: boolean
          endpoint?: string
          id?: string
          last_sent_at?: string | null
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      raffle_participants: {
        Row: {
          created_at: string
          id: string
          phone: string
          referral_code: string
          referred_by: string | null
          spins_allowed: number
          spins_used: number
        }
        Insert: {
          created_at?: string
          id?: string
          phone: string
          referral_code: string
          referred_by?: string | null
          spins_allowed?: number
          spins_used?: number
        }
        Update: {
          created_at?: string
          id?: string
          phone?: string
          referral_code?: string
          referred_by?: string | null
          spins_allowed?: number
          spins_used?: number
        }
        Relationships: []
      }
      raffle_referrals: {
        Row: {
          created_at: string
          id: string
          invited_phone: string
          referrer_participant_id: string
          referrer_phone: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_phone: string
          referrer_participant_id: string
          referrer_phone: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_phone?: string
          referrer_participant_id?: string
          referrer_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "raffle_referrals_referrer_participant_id_fkey"
            columns: ["referrer_participant_id"]
            isOneToOne: false
            referencedRelation: "raffle_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      raffle_segments: {
        Row: {
          amount: number | null
          created_at: string
          id: string
          is_available: boolean
          label: string
          position: number
          type: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          is_available?: boolean
          label: string
          position: number
          type: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          is_available?: boolean
          label?: string
          position?: number
          type?: string
        }
        Relationships: []
      }
      raffle_spins: {
        Row: {
          amount: number | null
          created_at: string
          given: boolean
          id: string
          is_win: boolean
          label: string
          participant_id: string | null
          phone: string
          segment_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          given?: boolean
          id?: string
          is_win?: boolean
          label: string
          participant_id?: string | null
          phone: string
          segment_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          given?: boolean
          id?: string
          is_win?: boolean
          label?: string
          participant_id?: string | null
          phone?: string
          segment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "raffle_spins_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "raffle_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raffle_spins_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "raffle_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      raffle_win_counter: {
        Row: {
          id: number
          spins_since_win: number
          win_threshold: number
        }
        Insert: {
          id?: number
          spins_since_win?: number
          win_threshold?: number
        }
        Update: {
          id?: number
          spins_since_win?: number
          win_threshold?: number
        }
        Relationships: []
      }
      referral_rewards: {
        Row: {
          amount_toman: number
          created_at: string
          id: string
          level: number
          paid_at: string | null
          referral_count: number
          referrer_id: string
          reward_type: string | null
          selected_at: string | null
          status: string
        }
        Insert: {
          amount_toman: number
          created_at?: string
          id?: string
          level: number
          paid_at?: string | null
          referral_count: number
          referrer_id: string
          reward_type?: string | null
          selected_at?: string | null
          status?: string
        }
        Update: {
          amount_toman?: number
          created_at?: string
          id?: string
          level?: number
          paid_at?: string | null
          referral_count?: number
          referrer_id?: string
          reward_type?: string | null
          selected_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          context: string
          created_at: string
          id: string
          message_content: string | null
          reason: string | null
          reported_user_id: string
          reporter_id: string
          resolved: boolean
        }
        Insert: {
          context: string
          created_at?: string
          id?: string
          message_content?: string | null
          reason?: string | null
          reported_user_id: string
          reporter_id: string
          resolved?: boolean
        }
        Update: {
          context?: string
          created_at?: string
          id?: string
          message_content?: string | null
          reason?: string | null
          reported_user_id?: string
          reporter_id?: string
          resolved?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_stats: {
        Row: {
          id: number
          member_count: number
        }
        Insert: {
          id?: number
          member_count: number
        }
        Update: {
          id?: number
          member_count?: number
        }
        Relationships: []
      }
      site_visits: {
        Row: {
          id: string
          path: string | null
          visited_at: string
        }
        Insert: {
          id?: string
          path?: string | null
          visited_at?: string
        }
        Update: {
          id?: string
          path?: string | null
          visited_at?: string
        }
        Relationships: []
      }
      user_coin_wallets: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vehicle_listings: {
        Row: {
          brand: string
          business_id: string
          color: string | null
          created_at: string
          id: string
          image_url: string | null
          is_sold: boolean
          mileage_km: number | null
          model: string
          price: number | null
          year: number | null
        }
        Insert: {
          brand: string
          business_id: string
          color?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_sold?: boolean
          mileage_km?: number | null
          model: string
          price?: number | null
          year?: number | null
        }
        Update: {
          brand?: string
          business_id?: string
          color?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_sold?: boolean
          mileage_km?: number | null
          model?: string
          price?: number | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_listings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      wall_message_likes: {
        Row: {
          created_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wall_message_likes_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "wall_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wall_message_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wall_messages: {
        Row: {
          ad_id: string | null
          audio_url: string | null
          business_id: string | null
          category: string | null
          city_id: string
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          is_auto_republish: boolean
          is_pinned: boolean
          is_promo: boolean
          pinned_at: string | null
          reply_to: string | null
          source_message_id: string | null
          user_id: string
        }
        Insert: {
          ad_id?: string | null
          audio_url?: string | null
          business_id?: string | null
          category?: string | null
          city_id: string
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_auto_republish?: boolean
          is_pinned?: boolean
          is_promo?: boolean
          pinned_at?: string | null
          reply_to?: string | null
          source_message_id?: string | null
          user_id: string
        }
        Update: {
          ad_id?: string | null
          audio_url?: string | null
          business_id?: string | null
          category?: string | null
          city_id?: string
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_auto_republish?: boolean
          is_pinned?: boolean
          is_promo?: boolean
          pinned_at?: string | null
          reply_to?: string | null
          source_message_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wall_messages_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wall_messages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wall_messages_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wall_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "wall_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wall_messages_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "wall_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wall_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wall_read_state: {
        Row: {
          last_read_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      hokm_leaderboard: {
        Row: {
          best_streak: number | null
          current_streak: number | null
          display_name: string | null
          losses: number | null
          rank: number | null
          rating: number | null
          total_games: number | null
          user_id: string | null
          win_rate: number | null
          wins: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_raffle_referral: {
        Args: {
          p_invited_phone: string
          p_referrer_id: string
          p_referrer_phone: string
        }
        Returns: number
      }
      admin_approve_business: {
        Args: { p_business_id: string }
        Returns: undefined
      }
      admin_delete_business: {
        Args: { p_business_id: string }
        Returns: undefined
      }
      admin_suspend_business: {
        Args: { p_business_id: string }
        Returns: boolean
      }
      change_coin_balance: {
        Args: {
          p_amount: number
          p_description?: string
          p_type: string
          p_user_id: string
        }
        Returns: number
      }
      choose_hokm_trump: {
        Args: { p_match_id: string; p_trump: string }
        Returns: Json
      }
      choose_referral_reward: {
        Args: { p_reward_id: string; p_reward_type: string }
        Returns: {
          amount_toman: number
          created_at: string
          id: string
          level: number
          paid_at: string | null
          referral_count: number
          referrer_id: string
          reward_type: string | null
          selected_at: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "referral_rewards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      end_hokm_round: {
        Args: { p_match_id: string; p_winning_team: number }
        Returns: Json
      }
      generate_referral_code: { Args: never; Returns: string }
      get_site_visit_stats: {
        Args: never
        Returns: {
          month: number
          today: number
          year: number
        }[]
      }
      publish_ad_to_wall:
        | {
            Args: { p_category: string; p_content: string; p_image_url: string }
            Returns: string
          }
        | {
            Args: {
              p_ad_id?: string
              p_category: string
              p_content: string
              p_image_url: string
            }
            Returns: string
          }
      publish_jamcity_auto_ad: { Args: never; Returns: undefined }
      publish_next_gold_wall_ad: {
        Args: { p_actor: string }
        Returns: {
          ad_id: string | null
          audio_url: string | null
          business_id: string | null
          category: string | null
          city_id: string
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          is_auto_republish: boolean
          is_pinned: boolean
          is_promo: boolean
          pinned_at: string | null
          reply_to: string | null
          source_message_id: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wall_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      raffle_increment_spins_allowed: {
        Args: { p_amount?: number; p_participant_id: string }
        Returns: undefined
      }
      raffle_register_spin: { Args: never; Returns: boolean }
      resolve_hakem_draw: { Args: { p_match_id: string }; Returns: Json }
      resolve_hokm_trick: { Args: { p_match_id: string }; Returns: Json }
      rotate_hakem_after_round: {
        Args: { p_match_id: string; p_winner_team: number }
        Returns: Json
      }
      start_hakem_draw: { Args: { p_match_id: string }; Returns: Json }
      start_hokm_match: { Args: { p_room_id: string }; Returns: string }
      start_hokm_new_round: {
        Args: { p_match_id: string; p_new_hakem_seat: number }
        Returns: Json
      }
      submit_hokm_move: {
        Args: { p_card: Json; p_match_id: string }
        Returns: Json
      }
      toggle_jamcity_auto_ads: {
        Args: { p_active: boolean }
        Returns: undefined
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
