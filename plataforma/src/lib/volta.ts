/**
 * "Voltar para": quem abre um link interno (ex.: um exercício compartilhado) sem estar logado passa pelo
 * login ou cadastro e depois volta para esse endereço. Só aceitamos caminhos internos ("/praticar/...")
 * para ninguém usar o parâmetro para mandar o usuário a outro site.
 */
export function destinoSeguro(valor: string | null | undefined): string | null {
  if (!valor || !valor.startsWith("/") || valor.startsWith("//") || valor.startsWith("/\\")) return null;
  return valor;
}

export function lerVolta(busca: string): string | null {
  return destinoSeguro(new URLSearchParams(busca).get("volta"));
}

/** Acrescenta ?volta=... a uma rota de login/cadastro, quando houver para onde voltar. */
export function comVolta(rota: string, volta: string | null): string {
  return volta ? `${rota}?volta=${encodeURIComponent(volta)}` : rota;
}

/** Endereço público de um exercício, para copiar e mandar aos alunos. */
export function linkDoExercicio(idLista: string): string {
  return `${window.location.origin}/praticar/${idLista}`;
}
