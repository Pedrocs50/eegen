"""Monta as listas de exemplo da plataforma: confere o conteúdo, gera os áudios e escreve o SQL.

Entrada: ingles.json, espanhol.json e frances.json (mesmo formato que o assistente da plataforma usa).
Saída:
  - audios/*.mp3                 para enviar ao bucket "audios" do Supabase (Storage > audios > Upload);
  - listas_de_exemplo.sql        para rodar no SQL Editor do Supabase, depois de enviar os áudios.

Os áudios saem do edge-tts (as mesmas vozes neurais do gerador.py), que não gasta a cota diária do Gemini.
No editor, as seções ficam com vozes do Gemini escolhidas pelo gênero; se a professora mudar o roteiro,
o "Gerar áudio" do editor refaz o áudio com o Gemini, como numa lista qualquer.

Uso (na raiz do repositório):
    py supabase/exemplos/montar.py            # confere, gera os áudios que faltam e o SQL
    py supabase/exemplos/montar.py --forcar   # refaz todos os áudios
    py supabase/exemplos/montar.py --so-sql   # não gera áudio
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import subprocess
import sys
import tempfile
import unicodedata
import uuid
from pathlib import Path

PASTA = Path(__file__).resolve().parent
RAIZ = PASTA.parents[1]
sys.path.insert(0, str(RAIZ))
import gerador  # noqa: E402  (reaproveita a síntese com repetição e a junção com FFmpeg)

ARQUIVOS = ["ingles.json", "espanhol.json", "frances.json"]
PASTA_AUDIOS = PASTA / "audios"
SAIDA_SQL = PASTA / "listas_de_exemplo.sql"
SAIDA_CURSOS = PASTA / "cursos_de_exemplo.sql"
# Curso de exemplo de cada idioma: quantas listas viram aulas, quantas aulas já ficam liberadas na turma de teste
# e o resto vira exercício avulso da turma.
CURSOS_EXEMPLO = {"ingles": (7, 4), "espanhol": (7, 4), "frances": (3, 2)}
NOMES_IDIOMA = {"ingles": "Inglês", "espanhol": "Espanhol", "frances": "Francês"}
ORIGEM = "exemplo"
NAMESPACE = uuid.UUID("6f2b1c1e-8a7d-4f62-9a4e-0b5d3c2e1f00")

FORMATOS = {"multipla_escolha", "verdadeiro_falso", "lacuna", "lacuna_opcoes", "resposta_curta", "completar_letras"}
HABILIDADES = {"listening", "reading", "grammar", "vocabulary", "writing"}
LACUNA = re.compile(r"_+")

# Vozes do Gemini gravadas na seção (as mesmas do padrão do editor, em plataforma/src/lib/vozes.ts).
GEMINI = {"feminina": ["Kore", "Leda", "Erinome", "Despina"], "masculina": ["Puck", "Charon", "Iapetus", "Achird"]}

# Vozes do edge-tts por idioma e sotaque.
EDGE = {
    "US": {"feminina": "en-US-JennyNeural", "masculina": "en-US-GuyNeural"},
    "GB": {"feminina": "en-GB-SoniaNeural", "masculina": "en-GB-RyanNeural"},
    "ES": {"feminina": "es-ES-ElviraNeural", "masculina": "es-ES-AlvaroNeural"},
    "MX": {"feminina": "es-MX-DaliaNeural", "masculina": "es-MX-JorgeNeural"},
    "FR": {"feminina": "fr-FR-DeniseNeural", "masculina": "fr-FR-HenriNeural"},
}
# Sotaque de cada lista, na ordem dos arquivos: segue o lugar da história (libras e "apologise" → britânico; Peru, Bogotá, Chile → latino).
SOTAQUES = {
    "ingles": ["US", "US", "GB", "US", "GB", "US", "GB", "US", "GB", "GB"],
    "espanhol": ["ES", "ES", "ES", "MX", "MX", "MX", "ES", "ES", "MX", "MX"],
    "frances": ["FR"] * 5,
}
# Mais devagar nos níveis iniciais.
VELOCIDADE = {1: "-12%", 2: "-12%", 3: "-5%", 4: "-5%", 5: "+0%", 6: "+0%"}


class ErroConteudo(Exception):
    pass


def slug(texto: str) -> str:
    sem_acento = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", sem_acento.lower()).strip("-")[:40]


def falantes_do_roteiro(roteiro: str) -> list[str]:
    falantes: list[str] = []
    for linha in roteiro.splitlines():
        achado = re.match(r"^\s*([^:]{1,40}):\s*\S", linha)
        if achado and achado.group(1).strip() not in falantes:
            falantes.append(achado.group(1).strip())
    return falantes


def falas_do_roteiro(roteiro: str) -> list[tuple[str, str]]:
    falas = []
    for linha in roteiro.splitlines():
        achado = re.match(r"^\s*([^:]{1,40}):\s*(.+)$", linha)
        if achado:
            falas.append((achado.group(1).strip(), achado.group(2).strip()))
    return falas


def assinatura(roteiro: str, vozes: dict[str, str]) -> str:
    """Igual a assinaturaAudio() do editor: se bater, o editor considera o áudio atualizado."""
    linhas = "\n".join(l.strip() for l in roteiro.splitlines() if l.strip())
    return ";".join(f"{f}={vozes[f]}" for f in sorted(vozes)) + "|" + linhas


def sem_virgulas(respostas: list[str]) -> list[str]:
    """A correção só ignora pontuação nas pontas; aceita também a resposta sem as vírgulas do meio."""
    todas = list(respostas)
    for r in respostas:
        variante = re.sub(r"\s*,\s*", " ", r)
        if variante not in todas:
            todas.append(variante)
    return todas


def converter_questao(q: dict, padrao: str, onde: str) -> tuple[dict, dict, str]:
    formato = q.get("formato")
    if formato not in FORMATOS:
        raise ErroConteudo(f"{onde}: formato desconhecido {formato!r}")
    habilidade = q.get("habilidade", padrao)
    if habilidade not in HABILIDADES:
        raise ErroConteudo(f"{onde}: habilidade desconhecida {habilidade!r}")
    enunciado = q.get("enunciado", "").strip()
    explicacao = q.get("explicacao", "").strip()
    if not enunciado or not explicacao:
        raise ErroConteudo(f"{onde}: falta enunciado ou explicação")
    lacunas = len(LACUNA.findall(enunciado))
    ignorar = q.get("ignorar_acentos") is True

    if formato == "multipla_escolha":
        opcoes = q["opcoes"]
        if not 2 <= len(opcoes) <= 5 or not 0 <= q["correta"] < len(opcoes) or len(set(opcoes)) != len(opcoes):
            raise ErroConteudo(f"{onde}: opções ou correta inválidas")
        return {"opcoes": opcoes}, {"correta": q["correta"]}, explicacao
    if formato == "verdadeiro_falso":
        if not isinstance(q.get("resposta"), bool):
            raise ErroConteudo(f"{onde}: resposta precisa ser true ou false")
        return {}, {"valor": q["resposta"]}, explicacao
    if formato in ("lacuna", "completar_letras"):
        respostas = q["respostas"]
        if lacunas == 0 or len(respostas) != lacunas or any(not r for r in respostas):
            raise ErroConteudo(f"{onde}: {lacunas} lacuna(s) no enunciado, {len(respostas)} lista(s) de respostas")
        conteudo = {"banco": q.get("banco", [])} if formato == "lacuna" else {}
        return conteudo, {"lacunas": respostas, "ignorar_acentos": ignorar}, explicacao
    if formato == "lacuna_opcoes":
        opcoes, corretas = q["opcoes"], q["corretas"]
        if lacunas == 0 or len(opcoes) != lacunas or len(corretas) != lacunas or any(not 0 <= c < len(o) for o, c in zip(opcoes, corretas)):
            raise ErroConteudo(f"{onde}: opções das lacunas não batem com o enunciado")
        return {"opcoes": opcoes}, {"lacunas": corretas}, explicacao
    aceitas = q["aceitas"]
    if not aceitas:
        raise ErroConteudo(f"{onde}: sem respostas aceitas")
    return {}, {"aceitas": sem_virgulas(aceitas), "ignorar_acentos": ignorar}, explicacao


def montar_listas(url_supabase: str) -> tuple[list[dict], list[dict]]:
    """Lê os JSON e devolve (listas prontas para o SQL, áudios a gerar)."""
    listas, audios = [], []
    for arquivo in ARQUIVOS:
        brutas = json.loads((PASTA / arquivo).read_text(encoding="utf-8"))
        for i, bruta in enumerate(brutas):
            idioma, nivel = bruta["idioma"], bruta["nivel"]
            id_lista = uuid.uuid5(NAMESPACE, f"{idioma}/{bruta['titulo']}")
            lista = {"id": id_lista, "titulo": bruta["titulo"], "tema": bruta["tema"], "descricao": bruta["descricao"],
                     "idioma": idioma, "nivel": nivel, "secoes": []}
            for s_i, bs in enumerate(bruta["secoes"]):
                tipo = bs["tipo"]
                onde_secao = f"{arquivo} › {bruta['titulo']} › seção {s_i + 1}"
                tipo_estimulo = {"dica": "dica", "texto": "texto", "audio": "audio"}.get(tipo, "nenhum")
                estimulo: dict = {}
                if tipo in ("dica", "texto"):
                    estimulo = {"texto": bs["texto"]}
                elif tipo == "audio":
                    roteiro = bs["roteiro"].strip()
                    falantes = falantes_do_roteiro(roteiro)
                    generos = bs["vozes"]
                    if not 1 <= len(falantes) <= 2 or set(falantes) != set(generos):
                        raise ErroConteudo(f"{onde_secao}: falantes {falantes} não batem com as vozes {list(generos)}")
                    usadas: set[str] = set()
                    vozes = {}
                    for f in falantes:
                        voz = next(v for v in GEMINI[generos[f]] if v not in usadas)
                        vozes[f] = voz
                        usadas.add(voz)
                    nome = f"exemplo-{idioma}-{i + 1:02d}-{slug(bruta['titulo'])}.mp3"
                    sotaque = SOTAQUES[idioma][i]
                    audios.append({"arquivo": PASTA_AUDIOS / nome, "falas": falas_do_roteiro(roteiro),
                                   "vozes": {f: EDGE[sotaque][generos[f]] for f in falantes}, "velocidade": VELOCIDADE[nivel],
                                   "estimulo": estimulo})
                    estimulo.update({"roteiro": roteiro, "generos": generos, "vozes": vozes, "transcricao": "depois",
                                     "audio_url": f"{url_supabase}/storage/v1/object/public/audios/{nome}",
                                     "audio_assinatura": assinatura(roteiro, vozes)})
                padrao = "reading" if tipo == "texto" else "listening" if tipo == "audio" else "grammar"
                secao = {"id": uuid.uuid5(id_lista, f"secao-{s_i}"), "titulo": bs.get("titulo", ""), "instrucao": bs.get("instrucao", ""),
                         "tipo_estimulo": tipo_estimulo, "estimulo": estimulo, "questoes": []}
                for q_i, bq in enumerate(bs.get("questoes", [])):
                    conteudo, gabarito, explicacao = converter_questao(bq, padrao, f"{onde_secao} › questão {q_i + 1}")
                    secao["questoes"].append({"id": uuid.uuid5(id_lista, f"q-{s_i}-{q_i}"), "formato": bq["formato"],
                                              "habilidade": bq.get("habilidade", padrao), "enunciado": bq["enunciado"].strip(),
                                              "conteudo": conteudo, "gabarito": gabarito, "explicacao": explicacao})
                if tipo != "dica" and not secao["questoes"]:
                    raise ErroConteudo(f"{onde_secao}: seção sem questões")
                lista["secoes"].append(secao)
            listas.append(lista)
    return listas, audios


async def gerar_audios(audios: list[dict], forcar: bool) -> None:
    PASTA_AUDIOS.mkdir(exist_ok=True)
    limite = asyncio.Semaphore(6)
    for audio in audios:
        destino: Path = audio["arquivo"]
        if destino.exists() and not forcar:
            continue
        with tempfile.TemporaryDirectory(prefix="tts_", dir=PASTA) as temporaria:
            trechos = [Path(temporaria) / f"{n:03d}.mp3" for n in range(len(audio["falas"]))]
            await asyncio.gather(*(gerador.sintetizar(texto, audio["vozes"][falante], trecho, audio["velocidade"], limite)
                                   for (falante, texto), trecho in zip(audio["falas"], trechos)))
            gerador.juntar_trechos(trechos, destino, 500)
        print(f"[+] {destino.name}")


def duracao(arquivo: Path) -> float | None:
    ffprobe = Path(gerador.FFMPEG or "ffmpeg").with_name("ffprobe" + Path(gerador.FFMPEG or "ffmpeg").suffix)
    try:
        saida = subprocess.run([str(ffprobe) if ffprobe.exists() else "ffprobe", "-v", "error", "-show_entries", "format=duration",
                                "-of", "csv=p=0", str(arquivo)], capture_output=True, text=True, check=True).stdout
        return round(float(saida.strip()), 1)
    except (OSError, ValueError, subprocess.CalledProcessError):
        return None


def sql_texto(valor: str) -> str:
    return "'" + valor.replace("'", "''") + "'"


def sql_json(valor) -> str:
    return sql_texto(json.dumps(valor, ensure_ascii=False)) + "::jsonb"


def escrever_sql(listas: list[dict]) -> None:
    admin = "(select id from public.perfis where papel = 'admin' order by criado_em limit 1)"
    linhas = [
        "-- Listas de exemplo da UP English (10 de inglês, 10 de espanhol, 5 de francês), já publicadas.",
        "-- Gerado por supabase/exemplos/montar.py a partir dos arquivos .json desta pasta. Não edite à mão.",
        "-- Antes de rodar: envie os MP3 da pasta audios/ para o bucket \"audios\" (Storage > audios > Upload).",
        "-- Pode rodar de novo: as listas de exemplo antigas são apagadas e recriadas.",
        "-- Para remover os exemplos depois: delete from public.listas where origem = 'exemplo';",
        "",
        "begin;",
        f"delete from public.listas where origem = '{ORIGEM}';",
    ]
    for lista in listas:
        linhas += ["", f"-- {lista['idioma']} · nível {lista['nivel']} · {lista['titulo']}",
                   "insert into public.listas (id, titulo, tema, descricao, idioma, nivel, status, origem, criado_por) values "
                   f"('{lista['id']}', {sql_texto(lista['titulo'])}, {sql_texto(lista['tema'])}, {sql_texto(lista['descricao'])}, "
                   f"'{lista['idioma']}', {lista['nivel']}, 'publicada', '{ORIGEM}', {admin});"]
        for s_ordem, secao in enumerate(lista["secoes"]):
            linhas.append("insert into public.secoes (id, lista_id, ordem, titulo, instrucao, tipo_estimulo, estimulo) values "
                          f"('{secao['id']}', '{lista['id']}', {s_ordem}, {sql_texto(secao['titulo'])}, {sql_texto(secao['instrucao'])}, "
                          f"'{secao['tipo_estimulo']}', {sql_json(secao['estimulo'])});")
            for q_ordem, q in enumerate(secao["questoes"]):
                linhas.append("insert into public.questoes (id, secao_id, lista_id, ordem, formato, habilidade, enunciado, conteudo) values "
                              f"('{q['id']}', '{secao['id']}', '{lista['id']}', {q_ordem}, '{q['formato']}', '{q['habilidade']}', "
                              f"{sql_texto(q['enunciado'])}, {sql_json(q['conteudo'])});")
                linhas.append(f"insert into public.gabaritos (questao_id, gabarito, explicacao) values "
                              f"('{q['id']}', {sql_json(q['gabarito'])}, {sql_texto(q['explicacao'])});")
    linhas += ["", "commit;", ""]
    SAIDA_SQL.write_text("\n".join(linhas), encoding="utf-8")


def url_do_supabase() -> str:
    for linha in (RAIZ / "plataforma" / ".env.local").read_text(encoding="utf-8").splitlines():
        if linha.startswith("VITE_SUPABASE_URL="):
            return linha.split("=", 1)[1].strip().rstrip("/")
    raise SystemExit("VITE_SUPABASE_URL não encontrado em plataforma/.env.local")


def escrever_sql_cursos(listas: list[dict]) -> None:
    admin = "(select id from public.perfis where papel = 'admin' order by criado_em limit 1)"
    ids_cursos = [str(uuid.uuid5(NAMESPACE, f"curso/{idioma}")) for idioma in CURSOS_EXEMPLO]
    linhas = [
        "-- Cursos de exemplo (um por idioma) montados com as listas de exemplo, cada um com uma turma de teste.",
        "-- Gerado por supabase/exemplos/montar.py. Rode DEPOIS de listas_de_exemplo.sql (que, se rodado de novo, desfaz as ligações).",
        "-- Em cada curso: uma aula por lista (sem PDF); na turma de teste, as primeiras aulas já liberadas e o resto como exercícios avulsos.",
        "-- Rodar de novo recria cursos e turmas de exemplo (e tira os alunos que entraram nas turmas de teste).",
        "",
        "begin;",
        "delete from public.cursos where id in (" + ", ".join(f"'{i}'" for i in ids_cursos) + ");",
    ]
    for idioma, (n_aulas, n_liberadas) in CURSOS_EXEMPLO.items():
        do_idioma = [l for l in listas if l["idioma"] == idioma]
        id_curso = uuid.uuid5(NAMESPACE, f"curso/{idioma}")
        id_turma = uuid.uuid5(NAMESPACE, f"turma/{idioma}")
        titulo = f"{NOMES_IDIOMA[idioma]} · Curso de exemplo"
        linhas += ["", f"-- {titulo}",
                   "insert into public.cursos (id, titulo, idioma, nivel, descricao) values "
                   f"('{id_curso}', {sql_texto(titulo)}, '{idioma}', 1, "
                   f"{sql_texto('Curso de demonstração: uma aula por lista de exemplo, do nível 1 ao 6.')});",
                   "insert into public.turmas (id, nome, curso_id, professor_id) values "
                   f"('{id_turma}', 'Turma de teste · {NOMES_IDIOMA[idioma]}', '{id_curso}', {admin});"]
        for i, lista in enumerate(do_idioma[:n_aulas]):
            id_aula = uuid.uuid5(NAMESPACE, f"aula/{idioma}/{i}")
            linhas.append("insert into public.aulas (id, curso_id, numero, titulo, subtitulo) values "
                          f"('{id_aula}', '{id_curso}', {i + 1}, {sql_texto(lista['titulo'])}, {sql_texto(lista['descricao'])});")
            linhas.append(f"insert into public.aula_listas (aula_id, lista_id, ordem) values ('{id_aula}', '{lista['id']}', 0);")
            if i < n_liberadas:
                linhas.append(f"insert into public.aulas_liberadas (turma_id, aula_id) values ('{id_turma}', '{id_aula}');")
        for ordem, lista in enumerate(do_idioma[n_aulas:]):
            linhas.append(f"insert into public.turma_listas (turma_id, lista_id, ordem) values ('{id_turma}', '{lista['id']}', {ordem});")
    linhas += ["", "commit;", ""]
    SAIDA_CURSOS.write_text("\n".join(linhas), encoding="utf-8")


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")  # o terminal do Windows usa cp1252
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--forcar", action="store_true", help="refaz todos os áudios")
    parser.add_argument("--so-sql", action="store_true", help="não gera áudio")
    args = parser.parse_args()
    try:
        listas, audios = montar_listas(url_do_supabase())
    except (ErroConteudo, KeyError) as erro:
        print(f"[ERRO] {erro}")
        return 1
    if not args.so_sql:
        if not gerador.verificar_dependencias(precisa_audio=True, precisa_planilha=False):
            return 1
        asyncio.run(gerar_audios(audios, args.forcar))
    for audio in audios:
        if audio["arquivo"].exists():
            segundos = duracao(audio["arquivo"])
            if segundos:
                audio["estimulo"]["duracao"] = segundos
    escrever_sql(listas)
    escrever_sql_cursos(listas)
    total = sum(len(s["questoes"]) for lista in listas for s in lista["secoes"])
    print(f"{len(listas)} listas, {total} questões, {len(audios)} áudios → {SAIDA_SQL.relative_to(RAIZ)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
