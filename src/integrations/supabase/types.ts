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
      acoes: {
        Row: {
          config_campos: Json
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          id: string
          inscricoes_abertas: boolean
          local: string | null
          nome: string
          status: string
          updated_at: string
        }
        Insert: {
          config_campos?: Json
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          inscricoes_abertas?: boolean
          local?: string | null
          nome: string
          status?: string
          updated_at?: string
        }
        Update: {
          config_campos?: Json
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          inscricoes_abertas?: boolean
          local?: string | null
          nome?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      familias: {
        Row: {
          created_at: string
          id: string
          nome: string
          notas: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          notas?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          notas?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      inscricoes: {
        Row: {
          acao_id: string
          created_at: string
          id: string
          pessoa_id: string
          status: Database["public"]["Enums"]["status_inscricao"]
          updated_at: string
          valores_dinamicos: Json
        }
        Insert: {
          acao_id: string
          created_at?: string
          id?: string
          pessoa_id: string
          status?: Database["public"]["Enums"]["status_inscricao"]
          updated_at?: string
          valores_dinamicos?: Json
        }
        Update: {
          acao_id?: string
          created_at?: string
          id?: string
          pessoa_id?: string
          status?: Database["public"]["Enums"]["status_inscricao"]
          updated_at?: string
          valores_dinamicos?: Json
        }
        Relationships: [
          {
            foreignKeyName: "inscricoes_acao_id_fkey"
            columns: ["acao_id"]
            isOneToOne: false
            referencedRelation: "acoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscricoes_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscricoes_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas_com_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoas: {
        Row: {
          auth_user_id: string | null
          cidade_residencia: string | null
          created_at: string
          data_nascimento: string | null
          email: string | null
          familia_id: string | null
          fundido_em: string | null
          genero: string | null
          id: string
          ignorar_duplicado: boolean
          is_admin: boolean
          nacionalidade: string | null
          nif: string | null
          nome_completo: string
          notas: string | null
          projeto_ids: string[]
          religiao: string | null
          status: Database["public"]["Enums"]["status_pessoa"]
          telefone: string | null
          tipo_user_id: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          cidade_residencia?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          familia_id?: string | null
          fundido_em?: string | null
          genero?: string | null
          id?: string
          ignorar_duplicado?: boolean
          is_admin?: boolean
          nacionalidade?: string | null
          nif?: string | null
          nome_completo: string
          notas?: string | null
          projeto_ids?: string[]
          religiao?: string | null
          status?: Database["public"]["Enums"]["status_pessoa"]
          telefone?: string | null
          tipo_user_id?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          cidade_residencia?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          familia_id?: string | null
          fundido_em?: string | null
          genero?: string | null
          id?: string
          ignorar_duplicado?: boolean
          is_admin?: boolean
          nacionalidade?: string | null
          nif?: string | null
          nome_completo?: string
          notas?: string | null
          projeto_ids?: string[]
          religiao?: string | null
          status?: Database["public"]["Enums"]["status_pessoa"]
          telefone?: string | null
          tipo_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pessoas_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoas_fundido_em_fkey"
            columns: ["fundido_em"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoas_fundido_em_fkey"
            columns: ["fundido_em"]
            isOneToOne: false
            referencedRelation: "pessoas_com_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoas_tipo_user_id_fkey"
            columns: ["tipo_user_id"]
            isOneToOne: false
            referencedRelation: "tipos_user"
            referencedColumns: ["id"]
          },
        ]
      }
      projetos: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      tipos_user: {
        Row: {
          created_at: string
          id: string
          nome: string
          paginas: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          paginas?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          paginas?: string[]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      pessoas_com_stats: {
        Row: {
          created_at: string | null
          data_nascimento: string | null
          email: string | null
          familia_id: string | null
          familia_nome: string | null
          fundido_em: string | null
          id: string | null
          inscricoes_count: number | null
          nif: string | null
          nome_completo: string | null
          notas: string | null
          status: Database["public"]["Enums"]["status_pessoa"] | null
          telefone: string | null
          tipo_participante: string | null
          ultima_acao_em: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pessoas_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoas_fundido_em_fkey"
            columns: ["fundido_em"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoas_fundido_em_fkey"
            columns: ["fundido_em"]
            isOneToOne: false
            referencedRelation: "pessoas_com_stats"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_user_familia_id: { Args: never; Returns: string }
      current_user_pessoa_id: { Args: never; Returns: string }
      fundir_perfis: {
        Args: { duplicado: string; principal: string }
        Returns: undefined
      }
      inscrever_publico:
        | {
            Args: {
              p_acao_id: string
              p_data_nascimento?: string
              p_email?: string
              p_nif?: string
              p_nome: string
              p_telefone?: string
              p_valores?: Json
            }
            Returns: string
          }
        | {
            Args: {
              p_acao_id: string
              p_atualizar?: boolean
              p_data_nascimento?: string
              p_email?: string
              p_nif?: string
              p_nome: string
              p_telefone?: string
              p_valores?: Json
            }
            Returns: Json
          }
      is_current_user_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      status_acao: "ativa" | "cancelada" | "concluida"
      status_inscricao:
        | "confirmada"
        | "cancelada"
        | "pendente"
        | "presente"
        | "ausente"
      status_pessoa: "ativo" | "suspeito_duplicado" | "fundido"
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
      status_acao: ["ativa", "cancelada", "concluida"],
      status_inscricao: [
        "confirmada",
        "cancelada",
        "pendente",
        "presente",
        "ausente",
      ],
      status_pessoa: ["ativo", "suspeito_duplicado", "fundido"],
    },
  },
} as const
