import { CabecalhoPagina } from "../componentes/Painel";
import ConfigIA from "../componentes/ConfigIA";
import HistoricoDeExclusoes from "../componentes/HistoricoDeExclusoes";

/** Configurações da plataforma (só admin): por enquanto, as IAs de listas e de voz. */
export default function Configuracoes() {
  return (
    <>
      <CabecalhoPagina
        etiqueta="Administração"
        titulo="Configurações"
        descricao="Qual IA cria as listas e as vozes dos listenings, quanto cada professor pode usar por dia, e o que foi apagado."
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <ConfigIA habilidade="gerar_lista" />
        <ConfigIA habilidade="gerar_audio" />
      </div>
      <HistoricoDeExclusoes />
    </>
  );
}
