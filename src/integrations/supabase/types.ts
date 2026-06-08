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
          bolsa_transporte: boolean
          config_campos: Json
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          id: string
          imagem_url: string | null
          inscricoes_abertas: boolean
          local: string | null
          mapa_url: string | null
          nome: string
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          bolsa_transporte?: boolean
          config_campos?: Json
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          imagem_url?: string | null
          inscricoes_abertas?: boolean
          local?: string | null
          mapa_url?: string | null
          nome: string
          status?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          bolsa_transporte?: boolean
          config_campos?: Json
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          imagem_url?: string | null
          inscricoes_abertas?: boolean
          local?: string | null
          mapa_url?: string | null
          nome?: string
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      atividades_catalogo: {
        Row: {
          ativo: boolean
          categoria: string | null
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      bolsas_cidades: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
          valor_sentido: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
          valor_sentido: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
          valor_sentido?: number
        }
        Relationships: []
      }
      dashboard_config: {
        Row: {
          charts: Json
          created_at: string
          id: string
          key: string
          kpis: Json
          updated_at: string
        }
        Insert: {
          charts?: Json
          created_at?: string
          id?: string
          key: string
          kpis?: Json
          updated_at?: string
        }
        Update: {
          charts?: Json
          created_at?: string
          id?: string
          key?: string
          kpis?: Json
          updated_at?: string
        }
        Relationships: []
      }
      familia_atividades: {
        Row: {
          atividade_id: string
          created_at: string
          created_by: string | null
          data: string | null
          descricao: string | null
          familia_id: string
          id: string
          updated_at: string
        }
        Insert: {
          atividade_id: string
          created_at?: string
          created_by?: string | null
          data?: string | null
          descricao?: string | null
          familia_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          atividade_id?: string
          created_at?: string
          created_by?: string | null
          data?: string | null
          descricao?: string | null
          familia_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "familia_atividades_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "atividades_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "familia_atividades_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias"
            referencedColumns: ["id"]
          },
        ]
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
          cartao_cidadao: string | null
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
          is_voluntario: boolean
          morada: string | null
          nacionalidade: string | null
          nif: string | null
          nome_completo: string
          notas: string | null
          profissao: string | null
          projeto_ids: string[]
          religiao: string | null
          status: Database["public"]["Enums"]["status_pessoa"]
          telefone: string | null
          tipo_user_id: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          cartao_cidadao?: string | null
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
          is_voluntario?: boolean
          morada?: string | null
          nacionalidade?: string | null
          nif?: string | null
          nome_completo: string
          notas?: string | null
          profissao?: string | null
          projeto_ids?: string[]
          religiao?: string | null
          status?: Database["public"]["Enums"]["status_pessoa"]
          telefone?: string | null
          tipo_user_id?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          cartao_cidadao?: string | null
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
          is_voluntario?: boolean
          morada?: string | null
          nacionalidade?: string | null
          nif?: string | null
          nome_completo?: string
          notas?: string | null
          profissao?: string | null
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
      vistas_guardadas: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_admin_view: boolean
          name: string
          snapshot: Json
          storage_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_admin_view?: boolean
          name: string
          snapshot?: Json
          storage_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_admin_view?: boolean
          name?: string
          snapshot?: Json
          storage_key?: string
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
      get_agrupamento: {
        Args: { p_coluna: string; p_tabela: string }
        Returns: Json
      }
      get_estatisticas_publicas: { Args: never; Returns: Json }
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
      is_current_user_staff: { Args: never; Returns: boolean }
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
