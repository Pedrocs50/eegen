import { useState } from "react";
import { useAuth } from "../lib/auth";

export function iniciais(nome: string, email: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return email.slice(0, 2).toUpperCase();
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

/**
 * Foto da pessoa: a do Google, quando entrou com Google; senão, as iniciais.
 * (referrerPolicy: o Google não entrega a foto quando o site manda o endereço de origem.)
 */
export default function Avatar({ tamanho = "size-10", texto = "text-sm" }: { tamanho?: string; texto?: string }) {
  const { perfil, sessao } = useAuth();
  const [falhou, setFalhou] = useState(false);
  if (!perfil) return null;
  const meta = (sessao?.user.user_metadata ?? {}) as Record<string, unknown>;
  const foto = (meta.avatar_url ?? meta.picture) as string | undefined;

  if (foto && !falhou) {
    return <img src={foto} alt="" width={48} height={48} referrerPolicy="no-referrer" onError={() => setFalhou(true)} className={`${tamanho} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <span className={`grid ${tamanho} shrink-0 place-items-center rounded-full bg-marca ${texto} font-bold text-sobre-marca`} aria-hidden="true">
      {iniciais(perfil.nome, perfil.email)}
    </span>
  );
}
