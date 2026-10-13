// Tipos compartilhados entre o app offline do admin (cliente) e as rotas /api/admin/* (servidor).
import type {
  AdminMember, Inadimplente, Plan, SlotRow, Treino, Vencimento,
} from "@/app/dashboard/admin/types";
import type { Forma } from "@/app/dashboard/admin/types";
import type { Anamnese, Avaliacao, CamposAnamnese } from "@/lib/anamnese";

export type PagamentoSnapshot = {
  id: number;
  member_id: string;
  nome: string | null;
  valor: number;
  pago_em: string;
  forma: Forma;
  observacao: string | null;
};

export type AdminSnapshot = {
  user_id: string;
  gerado_em: string; // ISO
  hoje: string; // AAAA-MM-DD em São Paulo
  members: AdminMember[];
  plans: Plan[];
  treinos: Treino[];
  slots: SlotRow[];
  resumo: { ativos: number; recebidoMes: number; emAtraso: number };
  vencimentos: Vencimento[];
  inadimplentes: Inadimplente[];
  pagamentos: PagamentoSnapshot[];
  // Ficha do aluno (0013). Opcionais: snapshot salvo por uma versão anterior do app não tem.
  anamneses?: Anamnese[];
  avaliacoes?: Avaliacao[];
};

export type CamposAluno = Partial<{
  plan_id: number | null;
  valor_acordado: number | null;
  status: "ativo" | "inativo" | "pendente";
  nome: string;
  telefone: string;
  email: string | null;
  treino_ids: number[];
}>;

export type AcaoFila =
  | {
      tipo: "pagamento";
      payload: {
        member_id: string;
        forma: Forma;
        valor: number | null;
        pago_em: string;
        observacao: string | null;
      };
    }
  | {
      tipo: "aluno_criar";
      payload: {
        member_id: string; // gerado no aparelho
        nome: string;
        telefone: string;
        email: string | null;
        plan_id: number | null;
        valor_acordado: number | null;
        treino_ids: number[];
      };
    }
  | { tipo: "aluno_editar"; payload: { member_id: string; campos: CamposAluno } }
  | { tipo: "horario_entrar"; payload: { slot_id: number; member_id: string } }
  | { tipo: "horario_sair"; payload: { slot_id: number; member_id: string } }
  | { tipo: "anamnese_salvar"; payload: { member_id: string; campos: CamposAnamnese } }
  // Criar e corrigir: upsert pelo id da avaliação (gerado no aparelho).
  | { tipo: "avaliacao_salvar"; payload: Avaliacao };

export type ItemFila = AcaoFila & {
  id: string; // uuid gerado no aparelho; também é a chave de idempotência no servidor
  user_id: string;
  criado_em: string; // ISO
  status: "pendente" | "erro";
  erro?: string;
  tentativas: number;
};

// regra = o servidor recusou (vai para "Pendências com erro"); temporario = tenta de novo;
// sessao = precisa entrar de novo (a fila fica guardada).
export type RespostaAcao =
  | { ok: true }
  | { ok: false; tipo: "regra" | "temporario" | "sessao"; mensagem: string };
