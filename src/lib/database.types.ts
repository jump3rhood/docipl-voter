
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "rate_limits": {
                  Row: {
                    "bucket": string,"count": number | null,"key_hash": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket": string,"count"?: number | null,"key_hash": string,"window_start": string
                  }
                  Update: {
                    "bucket"?: string,"count"?: number | null,"key_hash"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"teams": {
                  Row: {
                    "accent_color": string | null,"created_at": string | null,"display_order": number,"id": string,"is_active": boolean,"logo_url": string | null,"name": string,"slug": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accent_color"?: string | null,"created_at"?: string | null,"display_order"?: number,"id"?: string,"is_active"?: boolean,"logo_url"?: string | null,"name": string,"slug": string,"updated_at"?: string | null
                  }
                  Update: {
                    "accent_color"?: string | null,"created_at"?: string | null,"display_order"?: number,"id"?: string,"is_active"?: boolean,"logo_url"?: string | null,"name"?: string,"slug"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"voters": {
                  Row: {
                    "browser_id_hash": string,"created_at": string | null,"first_seen_at": string | null,"id": string,"ip_hash": string | null,"last_seen_at": string | null,"updated_at": string | null,"user_agent_hash": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "browser_id_hash": string,"created_at"?: string | null,"first_seen_at"?: string | null,"id"?: string,"ip_hash"?: string | null,"last_seen_at"?: string | null,"updated_at"?: string | null,"user_agent_hash"?: string | null
                  }
                  Update: {
                    "browser_id_hash"?: string,"created_at"?: string | null,"first_seen_at"?: string | null,"id"?: string,"ip_hash"?: string | null,"last_seen_at"?: string | null,"updated_at"?: string | null,"user_agent_hash"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"votes": {
                  Row: {
                    "created_at": string | null,"device_hash": string | null,"id": string,"ip_hash": string | null,"team_id": string,"token_id": string | null,"user_agent_hash": string | null,"voter_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"device_hash"?: string | null,"id"?: string,"ip_hash"?: string | null,"team_id": string,"token_id"?: string | null,"user_agent_hash"?: string | null,"voter_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"device_hash"?: string | null,"id"?: string,"ip_hash"?: string | null,"team_id"?: string,"token_id"?: string | null,"user_agent_hash"?: string | null,"voter_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "votes_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "votes_token_id_fkey"
      columns: ["token_id"]
isOneToOne: true
      referencedRelation: "voting_tokens"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "votes_voter_id_fkey"
      columns: ["voter_id"]
isOneToOne: true
      referencedRelation: "voters"
      referencedColumns: ["id"]
    }
                  ]
                },"voting_config": {
                  Row: {
                    "id": number,"is_enabled": boolean,"max_votes_per_device_ip": number,"updated_at": string | null,"voting_end": string,"voting_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: number,"is_enabled"?: boolean,"max_votes_per_device_ip"?: number,"updated_at"?: string | null,"voting_end": string,"voting_start": string
                  }
                  Update: {
                    "id"?: number,"is_enabled"?: boolean,"max_votes_per_device_ip"?: number,"updated_at"?: string | null,"voting_end"?: string,"voting_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"voting_tokens": {
                  Row: {
                    "created_at": string | null,"expires_at": string,"id": string,"ip_hash": string | null,"status": string,"token_hash": string,"used_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"expires_at": string,"id"?: string,"ip_hash"?: string | null,"status"?: string,"token_hash": string,"used_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"expires_at"?: string,"id"?: string,"ip_hash"?: string | null,"status"?: string,"token_hash"?: string,"used_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "cast_vote":
{ Args: { "p_browser_id_hash": string,"p_device_hash": string,"p_ip_hash": string,"p_team_id": string,"p_token_hash": string,"p_user_agent_hash": string }; Returns: {
              "status": string,"team_id": string,"team_name": string
            }[]
                           },
"get_results":
{ Args: Record<PropertyKey, never>; Returns: {
              "accent_color": string,"logo_url": string,"name": string,"percent": number,"rank": number,"slug": string,"team_id": string,"votes": number
            }[]
                           },
"get_token_state":
{ Args: { "p_token_hash": string }; Returns: string
                           },
"get_voter_vote":
{ Args: { "p_browser_id_hash": string }; Returns: {
              "team_id": string,"team_name": string
            }[]
                           },
"mint_token":
{ Args: { "p_ip_hash": string,"p_token_hash": string,"p_ttl_seconds"?: number }; Returns: string
                           },
"rate_limit_hit":
{ Args: { "p_bucket": string,"p_key_hash": string,"p_max": number,"p_window_seconds": number }; Returns: boolean
                           },
"voting_state":
{ Args: Record<PropertyKey, never>; Returns: string
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
