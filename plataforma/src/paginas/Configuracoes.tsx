import { CabecalhoPagina } from "../componentes/Painel";
import ConfigIA from "../componentes/ConfigIA";

/** Configurações da plataforma (só admin): por enquanto, as IAs de listas e de voz. */
export default function Configuracoes() {
  return (
    <>
      <CabecalhoPagina
        etiqueta="Administração"
        titulo="Configurações"
        descricao="Qual IA cria as listas e as vozes dos listenings, e quanto cada professor pode usar por dia."
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <ConfigIA habilidade="gerar_lista" />
        <ConfigIA habilidade="gerar_audio" />
      </div>
    </>
  );
}
