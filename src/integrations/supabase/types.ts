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
      acao_parceiros: {
        Row: {
          acao_id: string
          created_at: string
          parceiro_id: string
        }
        Insert: {
          acao_id: string
          created_at?: string
          parceiro_id: string
        }
        Update: {
          acao_id?: string
          created_at?: string
          parceiro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acao_parceiros_acao_id_fkey"
            columns: ["acao_id"]
            isOneToOne: false
            referencedRelation: "acoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acao_parceiros_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros"
            referencedColumns: ["id"]
          },
        ]
      }
      acoes: {
        Row: {
          bolsa_transporte: boolean
          categoria: string | null
          config_campos: Json
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          formador_ids: string[]
          google_event_id: string | null
          id: string
          imagem_position: string
          imagem_url: string | null
          inscricoes_abertas: boolean
          local: string | null
          localizacao_id: string | null
          mapa_url: string | null
          nome: string
          projeto_ids: string[]
          publico: boolean
          restrito_a_projetos: boolean
          status: string
          tipo: string
          tipo_acao_id: string | null
          updated_at: string
        }
        Insert: {
          bolsa_transporte?: boolean
          categoria?: string | null
          config_campos?: Json
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          formador_ids?: string[]
          google_event_id?: string | null
          id?: string
          imagem_position?: string
          imagem_url?: string | null
          inscricoes_abertas?: boolean
          local?: string | null
          localizacao_id?: string | null
          mapa_url?: string | null
          nome: string
          projeto_ids?: string[]
          publico?: boolean
          restrito_a_projetos?: boolean
          status?: string
          tipo?: string
          tipo_acao_id?: string | null
          updated_at?: string
        }
        Update: {
          bolsa_transporte?: boolean
          categoria?: string | null
          config_campos?: Json
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          formador_ids?: string[]
          google_event_id?: string | null
          id?: string
          imagem_position?: string
          imagem_url?: string | null
          inscricoes_abertas?: boolean
          local?: string | null
          localizacao_id?: string | null
          mapa_url?: string | null
          nome?: string
          projeto_ids?: string[]
          publico?: boolean
          restrito_a_projetos?: boolean
          status?: string
          tipo?: string
          tipo_acao_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "acoes_localizacao_id_fkey"
            columns: ["localizacao_id"]
            isOneToOne: false
            referencedRelation: "localizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acoes_tipo_acao_id_fkey"
            columns: ["tipo_acao_id"]
            isOneToOne: false
            referencedRelation: "tipos_acao"
            referencedColumns: ["id"]
          },
        ]
      }
      areas_interesse_catalogo: {
        Row: {
          ativo: boolean
          categoria: string | null
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          id?: string
          nome?: string
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
      bolsas_pagamentos: {
        Row: {
          acao_id: string
          created_at: string
          data_pagamento: string | null
          estado: string
          id: string
          inscricao_id: string
          metodo_pagamento: string | null
          notas: string | null
          pessoa_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          acao_id: string
          created_at?: string
          data_pagamento?: string | null
          estado?: string
          id?: string
          inscricao_id: string
          metodo_pagamento?: string | null
          notas?: string | null
          pessoa_id: string
          updated_at?: string
          valor?: number
        }
        Update: {
          acao_id?: string
          created_at?: string
          data_pagamento?: string | null
          estado?: string
          id?: string
          inscricao_id?: string
          metodo_pagamento?: string | null
          notas?: string | null
          pessoa_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "bolsas_pagamentos_acao_id_fkey"
            columns: ["acao_id"]
            isOneToOne: false
            referencedRelation: "acoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bolsas_pagamentos_inscricao_id_fkey"
            columns: ["inscricao_id"]
            isOneToOne: true
            referencedRelation: "inscricoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bolsas_pagamentos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bolsas_pagamentos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas_com_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      caso_objetivos: {
        Row: {
          caso_id: string
          created_at: string
          descricao: string
          estado: string
          id: string
          notas: string | null
          position: number
          prazo: string | null
        }
        Insert: {
          caso_id: string
          created_at?: string
          descricao: string
          estado?: string
          id?: string
          notas?: string | null
          position?: number
          prazo?: string | null
        }
        Update: {
          caso_id?: string
          created_at?: string
          descricao?: string
          estado?: string
          id?: string
          notas?: string | null
          position?: number
          prazo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caso_objetivos_caso_id_fkey"
            columns: ["caso_id"]
            isOneToOne: false
            referencedRelation: "casos_apoio"
            referencedColumns: ["id"]
          },
        ]
      }
      caso_registos: {
        Row: {
          autor_id: string | null
          caso_id: string
          conteudo: string
          created_at: string
          data: string
          estado_anterior: string | null
          estado_novo: string | null
          id: string
          tipo: string
          titulo: string | null
          visivel_para_pessoa: boolean
        }
        Insert: {
          autor_id?: string | null
          caso_id: string
          conteudo: string
          created_at?: string
          data?: string
          estado_anterior?: string | null
          estado_novo?: string | null
          id?: string
          tipo: string
          titulo?: string | null
          visivel_para_pessoa?: boolean
        }
        Update: {
          autor_id?: string | null
          caso_id?: string
          conteudo?: string
          created_at?: string
          data?: string
          estado_anterior?: string | null
          estado_novo?: string | null
          id?: string
          tipo?: string
          titulo?: string | null
          visivel_para_pessoa?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "caso_registos_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caso_registos_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "pessoas_com_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caso_registos_caso_id_fkey"
            columns: ["caso_id"]
            isOneToOne: false
            referencedRelation: "casos_apoio"
            referencedColumns: ["id"]
          },
        ]
      }
      caso_transferencias: {
        Row: {
          caso_id: string
          created_at: string
          data: string
          id: string
          mediadora_entrada_id: string | null
          mediadora_saida_id: string | null
          motivo: string | null
          notas_transicao: string
        }
        Insert: {
          caso_id: string
          created_at?: string
          data?: string
          id?: string
          mediadora_entrada_id?: string | null
          mediadora_saida_id?: string | null
          motivo?: string | null
          notas_transicao: string
        }
        Update: {
          caso_id?: string
          created_at?: string
          data?: string
          id?: string
          mediadora_entrada_id?: string | null
          mediadora_saida_id?: string | null
          motivo?: string | null
          notas_transicao?: string
        }
        Relationships: [
          {
            foreignKeyName: "caso_transferencias_caso_id_fkey"
            columns: ["caso_id"]
            isOneToOne: false
            referencedRelation: "casos_apoio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caso_transferencias_mediadora_entrada_id_fkey"
            columns: ["mediadora_entrada_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caso_transferencias_mediadora_entrada_id_fkey"
            columns: ["mediadora_entrada_id"]
            isOneToOne: false
            referencedRelation: "pessoas_com_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caso_transferencias_mediadora_saida_id_fkey"
            columns: ["mediadora_saida_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caso_transferencias_mediadora_saida_id_fkey"
            columns: ["mediadora_saida_id"]
            isOneToOne: false
            referencedRelation: "pessoas_com_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      casos_apoio: {
        Row: {
          area: string
          created_at: string
          created_by_auth_id: string | null
          data_abertura: string
          data_conclusao: string | null
          data_prevista_conclusao: string | null
          descricao: string | null
          estado: string
          familia_id: string | null
          id: string
          mediadora_id: string | null
          numero: string | null
          objetivo: string | null
          origem: string
          pessoa_id: string | null
          prioridade: string
          resultado_final: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          area: string
          created_at?: string
          created_by_auth_id?: string | null
          data_abertura?: string
          data_conclusao?: string | null
          data_prevista_conclusao?: string | null
          descricao?: string | null
          estado?: string
          familia_id?: string | null
          id?: string
          mediadora_id?: string | null
          numero?: string | null
          objetivo?: string | null
          origem: string
          pessoa_id?: string | null
          prioridade?: string
          resultado_final?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          area?: string
          created_at?: string
          created_by_auth_id?: string | null
          data_abertura?: string
          data_conclusao?: string | null
          data_prevista_conclusao?: string | null
          descricao?: string | null
          estado?: string
          familia_id?: string | null
          id?: string
          mediadora_id?: string | null
          numero?: string | null
          objetivo?: string | null
          origem?: string
          pessoa_id?: string | null
          prioridade?: string
          resultado_final?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "casos_apoio_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "casos_apoio_mediadora_id_fkey"
            columns: ["mediadora_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "casos_apoio_mediadora_id_fkey"
            columns: ["mediadora_id"]
            isOneToOne: false
            referencedRelation: "pessoas_com_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "casos_apoio_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "casos_apoio_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas_com_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradores: {
        Row: {
          ativo: boolean
          auth_user_id: string | null
          created_at: string
          email: string | null
          iban: string | null
          id: string
          matricula: string | null
          morada: string | null
          nif: string | null
          nome_completo: string
          notas: string | null
          pessoa_id: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          iban?: string | null
          id?: string
          matricula?: string | null
          morada?: string | null
          nif?: string | null
          nome_completo: string
          notas?: string | null
          pessoa_id?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          auth_user_id?: string | null
          created_at?: string
          email?: string | null
          iban?: string | null
          id?: string
          matricula?: string | null
          morada?: string | null
          nif?: string | null
          nome_completo?: string
          notas?: string | null
          pessoa_id?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaboradores_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas_com_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      component_library: {
        Row: {
          categoria: string
          created_at: string
          descricao: string | null
          id: string
          ordem: number
          preview_key: string | null
          prompt_en: string | null
          prompt_pt: string
          snippet: string | null
          titulo: string
          tokens: string[]
          updated_at: string
        }
        Insert: {
          categoria?: string
          created_at?: string
          descricao?: string | null
          id?: string
          ordem?: number
          preview_key?: string | null
          prompt_en?: string | null
          prompt_pt?: string
          snippet?: string | null
          titulo: string
          tokens?: string[]
          updated_at?: string
        }
        Update: {
          categoria?: string
          created_at?: string
          descricao?: string | null
          id?: string
          ordem?: number
          preview_key?: string | null
          prompt_en?: string | null
          prompt_pt?: string
          snippet?: string | null
          titulo?: string
          tokens?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      convites: {
        Row: {
          created_at: string
          criado_por: string | null
          email: string
          enviado: boolean
          expira_em: string
          id: string
          pessoa_id: string | null
          token: string
          updated_at: string
          usado_em: string | null
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          email: string
          enviado?: boolean
          expira_em?: string
          id?: string
          pessoa_id?: string | null
          token: string
          updated_at?: string
          usado_em?: string | null
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          email?: string
          enviado?: boolean
          expira_em?: string
          id?: string
          pessoa_id?: string | null
          token?: string
          updated_at?: string
          usado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "convites_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convites_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "pessoas_com_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convites_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convites_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas_com_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculos: {
        Row: {
          areas_interesse: string[]
          carta_conducao: boolean
          carta_conducao_categorias: string[]
          carta_motivacao_nome_ficheiro: string | null
          carta_motivacao_texto: string | null
          carta_motivacao_url: string | null
          competencias: string[]
          created_at: string
          cv_nome_ficheiro: string | null
          cv_url: string | null
          disponibilidade: string | null
          id: string
          linguas: Json
          notas: string | null
          pessoa_id: string
          updated_at: string
        }
        Insert: {
          areas_interesse?: string[]
          carta_conducao?: boolean
          carta_conducao_categorias?: string[]
          carta_motivacao_nome_ficheiro?: string | null
          carta_motivacao_texto?: string | null
          carta_motivacao_url?: string | null
          competencias?: string[]
          created_at?: string
          cv_nome_ficheiro?: string | null
          cv_url?: string | null
          disponibilidade?: string | null
          id?: string
          linguas?: Json
          notas?: string | null
          pessoa_id: string
          updated_at?: string
        }
        Update: {
          areas_interesse?: string[]
          carta_conducao?: boolean
          carta_conducao_categorias?: string[]
          carta_motivacao_nome_ficheiro?: string | null
          carta_motivacao_texto?: string | null
          carta_motivacao_url?: string | null
          competencias?: string[]
          created_at?: string
          cv_nome_ficheiro?: string | null
          cv_url?: string | null
          disponibilidade?: string | null
          id?: string
          linguas?: Json
          notas?: string | null
          pessoa_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: true
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: true
            referencedRelation: "pessoas_com_stats"
            referencedColumns: ["id"]
          },
        ]
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
      design_tokens: {
        Row: {
          id: boolean
          tokens: Json
          updated_at: string
        }
        Insert: {
          id?: boolean
          tokens?: Json
          updated_at?: string
        }
        Update: {
          id?: boolean
          tokens?: Json
          updated_at?: string
        }
        Relationships: []
      }
      email_pedidos_ajuda: {
        Row: {
          atribuido_a: string | null
          body_text: string | null
          caso_id: string | null
          created_at: string
          estado: string
          familia_id: string | null
          from_email: string | null
          from_name: string | null
          gmail_message_id: string
          gmail_thread_id: string | null
          id: string
          idioma: string | null
          motivos: string | null
          notas: string | null
          pessoa_id: string | null
          received_at: string | null
          resumo: string | null
          score: number
          snippet: string | null
          subject: string | null
          updated_at: string
        }
        Insert: {
          atribuido_a?: string | null
          body_text?: string | null
          caso_id?: string | null
          created_at?: string
          estado?: string
          familia_id?: string | null
          from_email?: string | null
          from_name?: string | null
          gmail_message_id: string
          gmail_thread_id?: string | null
          id?: string
          idioma?: string | null
          motivos?: string | null
          notas?: string | null
          pessoa_id?: string | null
          received_at?: string | null
          resumo?: string | null
          score?: number
          snippet?: string | null
          subject?: string | null
          updated_at?: string
        }
        Update: {
          atribuido_a?: string | null
          body_text?: string | null
          caso_id?: string | null
          created_at?: string
          estado?: string
          familia_id?: string | null
          from_email?: string | null
          from_name?: string | null
          gmail_message_id?: string
          gmail_thread_id?: string | null
          id?: string
          idioma?: string | null
          motivos?: string | null
          notas?: string | null
          pessoa_id?: string | null
          received_at?: string | null
          resumo?: string | null
          score?: number
          snippet?: string | null
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_pedidos_ajuda_caso_id_fkey"
            columns: ["caso_id"]
            isOneToOne: false
            referencedRelation: "casos_apoio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_pedidos_ajuda_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_pedidos_ajuda_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_pedidos_ajuda_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas_com_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sync_state: {
        Row: {
          id: number
          last_error: string | null
          last_history_id: string | null
          last_message_internal_date: number | null
          last_synced_at: string | null
        }
        Insert: {
          id?: number
          last_error?: string | null
          last_history_id?: string | null
          last_message_internal_date?: number | null
          last_synced_at?: string | null
        }
        Update: {
          id?: number
          last_error?: string | null
          last_history_id?: string | null
          last_message_internal_date?: number | null
          last_synced_at?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          assunto: string
          ativo: boolean
          chave: string
          conteudo_html: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
          variaveis: Json
        }
        Insert: {
          assunto: string
          ativo?: boolean
          chave: string
          conteudo_html?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
          variaveis?: Json
        }
        Update: {
          assunto?: string
          ativo?: boolean
          chave?: string
          conteudo_html?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
          variaveis?: Json
        }
        Relationships: []
      }
      etiquetas: {
        Row: {
          cor: string
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          cor?: string
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          cor?: string
          created_at?: string
          id?: string
          nome?: string
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
      familia_contexto: {
        Row: {
          created_at: string
          familia_id: string
          frequencia_participacao: string | null
          linguas: string[]
          notas_relacionais: string | null
          redes_suporte: string[]
          territorio: string | null
          tradicao_cultural: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          familia_id: string
          frequencia_participacao?: string | null
          linguas?: string[]
          notas_relacionais?: string | null
          redes_suporte?: string[]
          territorio?: string | null
          tradicao_cultural?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          familia_id?: string
          frequencia_participacao?: string | null
          linguas?: string[]
          notas_relacionais?: string | null
          redes_suporte?: string[]
          territorio?: string | null
          tradicao_cultural?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "familia_contexto_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: true
            referencedRelation: "familias"
            referencedColumns: ["id"]
          },
        ]
      }
      familias: {
        Row: {
          contacto_meeru_id: string | null
          created_at: string
          deleted_at: string | null
          direito_bolsa: boolean
          direito_mapa_km: boolean
          id: string
          nome: string
          notas: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contacto_meeru_id?: string | null
          created_at?: string
          deleted_at?: string | null
          direito_bolsa?: boolean
          direito_mapa_km?: boolean
          id?: string
          nome: string
          notas?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contacto_meeru_id?: string | null
          created_at?: string
          deleted_at?: string | null
          direito_bolsa?: boolean
          direito_mapa_km?: boolean
          id?: string
          nome?: string
          notas?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "familias_contacto_meeru_id_fkey"
            columns: ["contacto_meeru_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "familias_contacto_meeru_id_fkey"
            columns: ["contacto_meeru_id"]
            isOneToOne: false
            referencedRelation: "pessoas_com_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      financiamento_indicadores: {
        Row: {
          created_at: string
          financiamento_id: string
          indicador_id: string
        }
        Insert: {
          created_at?: string
          financiamento_id: string
          indicador_id: string
        }
        Update: {
          created_at?: string
          financiamento_id?: string
          indicador_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financiamento_indicadores_financiamento_id_fkey"
            columns: ["financiamento_id"]
            isOneToOne: false
            referencedRelation: "financiamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financiamento_indicadores_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "projeto_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      financiamento_projetos: {
        Row: {
          created_at: string
          financiamento_id: string
          projeto_id: string
        }
        Insert: {
          created_at?: string
          financiamento_id: string
          projeto_id: string
        }
        Update: {
          created_at?: string
          financiamento_id?: string
          projeto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financiamento_projetos_financiamento_id_fkey"
            columns: ["financiamento_id"]
            isOneToOne: false
            referencedRelation: "financiamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financiamento_projetos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      financiamentos: {
        Row: {
          aprovado_valor: number | null
          candidatura_url: string | null
          centros_custos: string | null
          cluster: string | null
          contrato_url: string | null
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          distribuicao_url: string | null
          estado: string
          financiador: string
          financiador_id: string | null
          id: string
          incluido_orcamento: boolean | null
          mais_informacoes: string | null
          metricas: string | null
          nome: string
          notas: string | null
          obrigacoes: string | null
          orcamento_valor: number | null
          referencia: string | null
          responsavel: string | null
          status_externo: string | null
          tipo: string
          updated_at: string
          valor_total: number | null
        }
        Insert: {
          aprovado_valor?: number | null
          candidatura_url?: string | null
          centros_custos?: string | null
          cluster?: string | null
          contrato_url?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          distribuicao_url?: string | null
          estado?: string
          financiador: string
          financiador_id?: string | null
          id?: string
          incluido_orcamento?: boolean | null
          mais_informacoes?: string | null
          metricas?: string | null
          nome: string
          notas?: string | null
          obrigacoes?: string | null
          orcamento_valor?: number | null
          referencia?: string | null
          responsavel?: string | null
          status_externo?: string | null
          tipo: string
          updated_at?: string
          valor_total?: number | null
        }
        Update: {
          aprovado_valor?: number | null
          candidatura_url?: string | null
          centros_custos?: string | null
          cluster?: string | null
          contrato_url?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          distribuicao_url?: string | null
          estado?: string
          financiador?: string
          financiador_id?: string | null
          id?: string
          incluido_orcamento?: boolean | null
          mais_informacoes?: string | null
          metricas?: string | null
          nome?: string
          notas?: string | null
          obrigacoes?: string | null
          orcamento_valor?: number | null
          referencia?: string | null
          responsavel?: string | null
          status_externo?: string | null
          tipo?: string
          updated_at?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financiamentos_financiador_id_fkey"
            columns: ["financiador_id"]
            isOneToOne: false
            referencedRelation: "parceiros"
            referencedColumns: ["id"]
          },
        ]
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
      localizacoes: {
        Row: {
          created_at: string
          id: string
          link_mapa: string | null
          nome: string
          notas: string | null
          proprietario: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          link_mapa?: string | null
          nome: string
          notas?: string | null
          proprietario?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          link_mapa?: string | null
          nome?: string
          notas?: string | null
          proprietario?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      mapa_km: {
        Row: {
          acao_id: string | null
          created_at: string
          data: string
          data_pagamento: string | null
          estado: string
          familia_id: string
          id: string
          km: number
          matricula: string | null
          metodo_pagamento: string | null
          motivo: string
          n_carros: number
          notas: string | null
          updated_at: string
          valor: number | null
        }
        Insert: {
          acao_id?: string | null
          created_at?: string
          data?: string
          data_pagamento?: string | null
          estado?: string
          familia_id: string
          id?: string
          km: number
          matricula?: string | null
          metodo_pagamento?: string | null
          motivo: string
          n_carros?: number
          notas?: string | null
          updated_at?: string
          valor?: number | null
        }
        Update: {
          acao_id?: string | null
          created_at?: string
          data?: string
          data_pagamento?: string | null
          estado?: string
          familia_id?: string
          id?: string
          km?: number
          matricula?: string | null
          metodo_pagamento?: string | null
          motivo?: string
          n_carros?: number
          notas?: string | null
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mapa_km_acao_id_fkey"
            columns: ["acao_id"]
            isOneToOne: false
            referencedRelation: "acoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mapa_km_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familias"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          count: number
          created_at: string
          descricao: string | null
          group_key: string | null
          id: string
          lida: boolean
          lida_em: string | null
          link: string | null
          recipient_auth_id: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          count?: number
          created_at?: string
          descricao?: string | null
          group_key?: string | null
          id?: string
          lida?: boolean
          lida_em?: string | null
          link?: string | null
          recipient_auth_id: string
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          count?: number
          created_at?: string
          descricao?: string | null
          group_key?: string | null
          id?: string
          lida?: boolean
          lida_em?: string | null
          link?: string | null
          recipient_auth_id?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      pagamentos: {
        Row: {
          colaborador_id: string
          created_at: string
          data_pagamento: string
          id: string
          metodo: string | null
          notas: string | null
          referencia: string | null
          total: number
          updated_at: string
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          data_pagamento?: string
          id?: string
          metodo?: string | null
          notas?: string | null
          referencia?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          data_pagamento?: string
          id?: string
          metodo?: string | null
          notas?: string | null
          referencia?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      parceiro_interacoes: {
        Row: {
          created_at: string
          data: string
          id: string
          notas: string | null
          parceiro_id: string
          tipo: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: string
          id?: string
          notas?: string | null
          parceiro_id: string
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          notas?: string | null
          parceiro_id?: string
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parceiro_interacoes_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros"
            referencedColumns: ["id"]
          },
        ]
      }
      parceiro_projetos: {
        Row: {
          created_at: string
          parceiro_id: string
          projeto_id: string
        }
        Insert: {
          created_at?: string
          parceiro_id: string
          projeto_id: string
        }
        Update: {
          created_at?: string
          parceiro_id?: string
          projeto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parceiro_projetos_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parceiro_projetos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      parceiros: {
        Row: {
          created_at: string
          email_contacto: string | null
          estado: string
          id: string
          nome: string
          notas: string | null
          pessoa_contacto: string | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_contacto?: string | null
          estado?: string
          id?: string
          nome: string
          notas?: string | null
          pessoa_contacto?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_contacto?: string | null
          estado?: string
          id?: string
          nome?: string
          notas?: string | null
          pessoa_contacto?: string | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pessoa_etiquetas: {
        Row: {
          created_at: string
          etiqueta_id: string
          pessoa_id: string
        }
        Insert: {
          created_at?: string
          etiqueta_id: string
          pessoa_id: string
        }
        Update: {
          created_at?: string
          etiqueta_id?: string
          pessoa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pessoa_etiquetas_etiqueta_id_fkey"
            columns: ["etiqueta_id"]
            isOneToOne: false
            referencedRelation: "etiquetas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoa_etiquetas_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoa_etiquetas_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas_com_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoa_tipos: {
        Row: {
          created_at: string
          pessoa_id: string
          tipo_user_id: string
        }
        Insert: {
          created_at?: string
          pessoa_id: string
          tipo_user_id: string
        }
        Update: {
          created_at?: string
          pessoa_id?: string
          tipo_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pessoa_tipos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoa_tipos_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoas_com_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoa_tipos_tipo_user_id_fkey"
            columns: ["tipo_user_id"]
            isOneToOne: false
            referencedRelation: "tipos_user"
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
          deleted_at: string | null
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
          parceiro_id: string | null
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
          deleted_at?: string | null
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
          parceiro_id?: string | null
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
          deleted_at?: string | null
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
          parceiro_id?: string | null
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
            foreignKeyName: "pessoas_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "parceiros"
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
      projeto_kpis: {
        Row: {
          created_at: string
          estado: string
          filtro: Json
          fonte: string
          id: string
          meta: number
          narrativa: string | null
          nome: string
          position: number
          projeto_id: string
          unidade: string
          updated_at: string
          valor_manual: number | null
        }
        Insert: {
          created_at?: string
          estado?: string
          filtro?: Json
          fonte: string
          id?: string
          meta?: number
          narrativa?: string | null
          nome: string
          position?: number
          projeto_id: string
          unidade?: string
          updated_at?: string
          valor_manual?: number | null
        }
        Update: {
          created_at?: string
          estado?: string
          filtro?: Json
          fonte?: string
          id?: string
          meta?: number
          narrativa?: string | null
          nome?: string
          position?: number
          projeto_id?: string
          unidade?: string
          updated_at?: string
          valor_manual?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projeto_kpis_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
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
      registos_servico: {
        Row: {
          colaborador_id: string
          created_at: string
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          estado: string
          id: string
          km: number | null
          notas_admin: string | null
          outros_custos: number
          outros_custos_descricao: string | null
          pagamento_id: string | null
          preco_unitario_override: number | null
          quantidade: number
          sessao_id: string | null
          submetido_pelo_colaborador: boolean
          tipo_servico_id: string
          updated_at: string
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          descricao?: string | null
          estado?: string
          id?: string
          km?: number | null
          notas_admin?: string | null
          outros_custos?: number
          outros_custos_descricao?: string | null
          pagamento_id?: string | null
          preco_unitario_override?: number | null
          quantidade?: number
          sessao_id?: string | null
          submetido_pelo_colaborador?: boolean
          tipo_servico_id: string
          updated_at?: string
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          estado?: string
          id?: string
          km?: number | null
          notas_admin?: string | null
          outros_custos?: number
          outros_custos_descricao?: string | null
          pagamento_id?: string | null
          preco_unitario_override?: number | null
          quantidade?: number
          sessao_id?: string | null
          submetido_pelo_colaborador?: boolean
          tipo_servico_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registos_servico_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registos_servico_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registos_servico_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessoes_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registos_servico_tipo_servico_id_fkey"
            columns: ["tipo_servico_id"]
            isOneToOne: false
            referencedRelation: "tipos_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorio_secoes: {
        Row: {
          config: Json
          conteudo_texto: string | null
          created_at: string
          id: string
          position: number
          relatorio_id: string
          tipo: string
          titulo: string | null
        }
        Insert: {
          config?: Json
          conteudo_texto?: string | null
          created_at?: string
          id?: string
          position?: number
          relatorio_id: string
          tipo: string
          titulo?: string | null
        }
        Update: {
          config?: Json
          conteudo_texto?: string | null
          created_at?: string
          id?: string
          position?: number
          relatorio_id?: string
          tipo?: string
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_secoes_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorio_snapshots: {
        Row: {
          criado_em: string
          criado_por_id: string | null
          dados: Json
          id: string
          relatorio_id: string
        }
        Insert: {
          criado_em?: string
          criado_por_id?: string | null
          dados?: Json
          id?: string
          relatorio_id: string
        }
        Update: {
          criado_em?: string
          criado_por_id?: string | null
          dados?: Json
          id?: string
          relatorio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_snapshots_criado_por_id_fkey"
            columns: ["criado_por_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorio_snapshots_criado_por_id_fkey"
            columns: ["criado_por_id"]
            isOneToOne: false
            referencedRelation: "pessoas_com_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorio_snapshots_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorios: {
        Row: {
          created_at: string
          criado_por_id: string | null
          data_submissao_prevista: string | null
          data_submissao_real: string | null
          estado: string
          financiador: string
          geral: boolean
          id: string
          periodo_fim: string
          periodo_inicio: string
          projeto_id: string | null
          projeto_ids: string[]
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por_id?: string | null
          data_submissao_prevista?: string | null
          data_submissao_real?: string | null
          estado?: string
          financiador: string
          geral?: boolean
          id?: string
          periodo_fim: string
          periodo_inicio: string
          projeto_id?: string | null
          projeto_ids?: string[]
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por_id?: string | null
          data_submissao_prevista?: string | null
          data_submissao_real?: string | null
          estado?: string
          financiador?: string
          geral?: boolean
          id?: string
          periodo_fim?: string
          periodo_inicio?: string
          projeto_id?: string | null
          projeto_ids?: string[]
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_criado_por_id_fkey"
            columns: ["criado_por_id"]
            isOneToOne: false
            referencedRelation: "pessoas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_criado_por_id_fkey"
            columns: ["criado_por_id"]
            isOneToOne: false
            referencedRelation: "pessoas_com_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      security_finding_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          created_at: string
          event_type: string
          finding_id: string
          from_status: string | null
          id: string
          note: string | null
          to_status: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          event_type: string
          finding_id: string
          from_status?: string | null
          id?: string
          note?: string | null
          to_status?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          event_type?: string
          finding_id?: string
          from_status?: string | null
          id?: string
          note?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_finding_events_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "security_findings"
            referencedColumns: ["id"]
          },
        ]
      }
      security_findings: {
        Row: {
          connector: string
          created_at: string
          description: string | null
          external_id: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          metadata: Json
          resource: string | null
          severity: string
          status: string
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          connector: string
          created_at?: string
          description?: string | null
          external_id?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          metadata?: Json
          resource?: string | null
          severity?: string
          status?: string
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          connector?: string
          created_at?: string
          description?: string | null
          external_id?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          metadata?: Json
          resource?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      sessoes_servico: {
        Row: {
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          id: string
          local: string | null
          nome: string
          preco_unitario_override: number | null
          quantidade_por_colaborador: number
          tipo_servico_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio: string
          descricao?: string | null
          id?: string
          local?: string | null
          nome: string
          preco_unitario_override?: number | null
          quantidade_por_colaborador?: number
          tipo_servico_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          id?: string
          local?: string | null
          nome?: string
          preco_unitario_override?: number | null
          quantidade_por_colaborador?: number
          tipo_servico_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessoes_servico_tipo_servico_id_fkey"
            columns: ["tipo_servico_id"]
            isOneToOne: false
            referencedRelation: "tipos_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      sidebar_groups: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_system: boolean
          is_visible: boolean
          key: string
          label: string
          position: number
          updated_at: string
          visible_to: string[]
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_system?: boolean
          is_visible?: boolean
          key: string
          label: string
          position?: number
          updated_at?: string
          visible_to?: string[]
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_system?: boolean
          is_visible?: boolean
          key?: string
          label?: string
          position?: number
          updated_at?: string
          visible_to?: string[]
        }
        Relationships: []
      }
      sidebar_items: {
        Row: {
          badge_query: string | null
          created_at: string
          group_id: string
          icon: string
          id: string
          is_system: boolean
          is_visible: boolean
          key: string
          label: string
          position: number
          sub_group: string | null
          updated_at: string
          url: string
          visible_to: string[]
        }
        Insert: {
          badge_query?: string | null
          created_at?: string
          group_id: string
          icon?: string
          id?: string
          is_system?: boolean
          is_visible?: boolean
          key: string
          label: string
          position?: number
          sub_group?: string | null
          updated_at?: string
          url: string
          visible_to?: string[]
        }
        Update: {
          badge_query?: string | null
          created_at?: string
          group_id?: string
          icon?: string
          id?: string
          is_system?: boolean
          is_visible?: boolean
          key?: string
          label?: string
          position?: number
          sub_group?: string | null
          updated_at?: string
          url?: string
          visible_to?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "sidebar_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "sidebar_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_acao: {
        Row: {
          created_at: string
          id: string
          nome: string
          ordem: number
          requer_formadores: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          requer_formadores?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          requer_formadores?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      tipos_servico: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          preco_unitario: number
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          preco_unitario?: number
          unidade?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          preco_unitario?: number
          unidade?: string
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
      convite_consumir: {
        Args: {
          p_data_nascimento?: string
          p_nome: string
          p_telefone?: string
          p_token: string
        }
        Returns: Json
      }
      convite_validar: { Args: { p_token: string }; Returns: Json }
      count_casos_novos: { Args: never; Returns: number }
      count_duplicates: { Args: never; Returns: number }
      count_relatorios_pendentes: { Args: never; Returns: number }
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
      notificar_mediadora: {
        Args: {
          p_descricao?: string
          p_group_key?: string
          p_link?: string
          p_mediadora_id: string
          p_tipo: string
          p_titulo: string
        }
        Returns: undefined
      }
      notificar_nova_entrada_pendente: {
        Args: { p_colaborador_id: string }
        Returns: number
      }
      notificar_servicos_por_pagar: {
        Args: { p_window_days?: number }
        Returns: number
      }
      notificar_staff:
        | {
            Args: {
              p_descricao?: string
              p_link?: string
              p_tipo: string
              p_titulo: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_descricao?: string
              p_group_key?: string
              p_link?: string
              p_tipo: string
              p_titulo: string
            }
            Returns: undefined
          }
      recalcular_total_pagamento: {
        Args: { p_pagamento_id: string }
        Returns: undefined
      }
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
