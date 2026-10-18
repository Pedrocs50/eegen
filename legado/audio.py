# -*- coding: utf-8 -*-
"""Gera um MP3 para cada roteiro .txt dentro da pasta ``roteiros``.

Instalação:
    pip install edge-tts pydub

O pydub requer que o FFmpeg esteja instalado e disponível no PATH.

Uso:
    python audio.py
    python audio.py --rate=-10% --pausa 600

Cada fala deve estar em uma linha no formato ``FALANTE: texto``. Linhas sem
falante continuam a fala anterior. O programa também aceita arquivos UTF-8,
UTF-8 com BOM e arquivos antigos em Windows-1252/Latin-1.
"""

from __future__ import annotations

import argparse
import asyncio
import re
import shutil
import tempfile
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PASTA_ROTEIROS = BASE_DIR / "roteiros"
PASTA_AUDIOS = BASE_DIR / "audios"
VOZES = [
    "en-GB-RyanNeural",      # britânico masculino
    "en-GB-SoniaNeural",     # britânica feminina
    "en-US-GuyNeural",       # americano masculino
    "en-US-JennyNeural",     # americana feminina
    "en-AU-NatashaNeural",   # australiana feminina
]
TENTATIVAS_TTS = 3
PADRAO_FALANTE = re.compile(r"^([^:]{1,40}):\s*(.+)$")
edge_tts = None
AudioSegment = None


def ler_texto(caminho: Path) -> str:
    """Lê o arquivo tentando codificações comuns de roteiros no Windows."""
    dados = caminho.read_bytes()
    for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return dados.decode(encoding)
        except UnicodeDecodeError:
            pass
    raise UnicodeError("Não foi possível identificar a codificação do arquivo.")


def ler_roteiro(caminho: Path) -> list[tuple[str, str]]:
    """Extrai ``(falante, texto)`` de um roteiro, ignorando cabeçalhos."""
    falas: list[tuple[str, str]] = []
    for numero, linha_original in enumerate(ler_texto(caminho).splitlines(), start=1):
        linha = linha_original.strip()
        if not linha or linha.upper().startswith("AUDIO SCRIPT"):
            continue

        encontrado = PADRAO_FALANTE.match(linha)
        if encontrado:
            falante = encontrado.group(1).strip()
            texto = encontrado.group(2).strip()
            if falante and texto:
                falas.append((falante, texto))
            continue

        if falas:
            # Permite quebra de linha no meio de uma fala, sem descartar texto.
            ultimo_falante, ultimo_texto = falas[-1]
            falas[-1] = (ultimo_falante, f"{ultimo_texto} {linha}")
        else:
            print(f"[!] {caminho.name}, linha {numero}: ignorada (esperado FALANTE: texto)")
    return falas


async def sintetizar(texto: str, voz: str, saida: Path, rate: str) -> None:
    """Gera um trecho e repete tentativas em falhas transitórias de rede."""
    ultimo_erro: Exception | None = None
    for tentativa in range(1, TENTATIVAS_TTS + 1):
        try:
            await edge_tts.Communicate(texto, voz, rate=rate).save(str(saida))
            if saida.exists() and saida.stat().st_size > 0:
                return
            raise RuntimeError("O serviço retornou um arquivo de áudio vazio.")
        except Exception as erro:  # edge-tts não expõe uma exceção única para rede.
            ultimo_erro = erro
            saida.unlink(missing_ok=True)
            if tentativa < TENTATIVAS_TTS:
                espera = tentativa * 2
                print(f"    tentativa {tentativa} falhou; repetindo em {espera}s...")
                await asyncio.sleep(espera)
    raise RuntimeError(f"TTS falhou após {TENTATIVAS_TTS} tentativas: {ultimo_erro}") from ultimo_erro


def caminho_saida(caminho_roteiro: Path) -> Path:
    """Mantém subpastas de roteiros para evitar nomes de áudio duplicados."""
    relativo = caminho_roteiro.relative_to(PASTA_ROTEIROS).with_suffix(".mp3")
    return PASTA_AUDIOS / relativo


async def gerar(caminho_roteiro: Path, pausa_ms: int, rate: str) -> bool:
    """Gera um único MP3. Retorna False sem derrubar os outros roteiros."""
    try:
        falas = ler_roteiro(caminho_roteiro)
    except (OSError, UnicodeError) as erro:
        print(f"[ERRO] {caminho_roteiro.name}: não foi possível ler o roteiro: {erro}")
        return False

    if not falas:
        print(f"[!] {caminho_roteiro.name}: nenhuma fala reconhecida; pulado.")
        return False

    falantes = list(dict.fromkeys(falante for falante, _ in falas))
    mapa_vozes = {falante: VOZES[indice % len(VOZES)] for indice, falante in enumerate(falantes)}
    destino = caminho_saida(caminho_roteiro)
    print(f"[+] {caminho_roteiro.relative_to(PASTA_ROTEIROS)}: {len(falas)} falas, {len(falantes)} voz(es)")

    destino.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="tts_", dir=BASE_DIR) as pasta_temporaria:
        temporario = Path(pasta_temporaria)
        audio_final = AudioSegment.silent(duration=700)
        geradas = 0

        for indice, (falante, texto) in enumerate(falas, start=1):
            trecho = temporario / f"{indice:03d}.mp3"
            try:
                await sintetizar(texto, mapa_vozes[falante], trecho, rate)
                audio_final += AudioSegment.from_mp3(trecho)
                audio_final += AudioSegment.silent(duration=pausa_ms)
                geradas += 1
            except Exception as erro:
                # Um diálogo defeituoso não impede o restante do lote.
                print(f"    [!] fala {indice} de {falante} ignorada: {erro}")

        if not geradas:
            print(f"[ERRO] {caminho_roteiro.name}: nenhuma fala pôde ser sintetizada.")
            return False

        arquivo_parcial = destino.with_suffix(".part.mp3")
        try:
            audio_final.export(str(arquivo_parcial), format="mp3")
            arquivo_parcial.replace(destino)
        except Exception as erro:
            arquivo_parcial.unlink(missing_ok=True)
            print(f"[ERRO] {caminho_roteiro.name}: não foi possível salvar o MP3: {erro}")
            return False

    status = "com falas ignoradas" if geradas != len(falas) else "ok"
    print(f"    -> {destino.relative_to(BASE_DIR)} ({status})")
    return True


def verificar_dependencias() -> bool:
    """Carrega dependências e informa exatamente o que falta."""
    global edge_tts, AudioSegment
    try:
        import edge_tts as edge_tts_modulo
        from pydub import AudioSegment as classe_audio
    except ModuleNotFoundError as erro:
        print(f"[ERRO] Pacote Python ausente: {erro.name}")
        print("Instale as dependências com: pip install edge-tts pydub")
        return False

    edge_tts = edge_tts_modulo
    AudioSegment = classe_audio
    if shutil.which("ffmpeg"):
        return True
    print("[ERRO] FFmpeg não foi encontrado no PATH.")
    print("Instale o FFmpeg, feche e abra o terminal novamente, e execute o comando outra vez.")
    return False


async def main() -> int:
    parser = argparse.ArgumentParser(description="Gera MP3s para todos os roteiros .txt.")
    parser.add_argument("--pausa", type=int, default=450, help="silêncio entre falas, em ms (padrão: 450)")
    parser.add_argument("--rate", default="-5%", help="velocidade de fala do edge-tts (padrão: -5%%)")
    args = parser.parse_args()

    if args.pausa < 0:
        parser.error("--pausa deve ser zero ou maior.")
    if not PASTA_ROTEIROS.is_dir():
        print(f"[ERRO] Pasta de roteiros não encontrada: {PASTA_ROTEIROS}")
        return 1
    if not verificar_dependencias():
        return 1

    arquivos = sorted(PASTA_ROTEIROS.rglob("*.txt"), key=lambda caminho: str(caminho).lower())
    if not arquivos:
        print(f"[!] Nenhum arquivo .txt encontrado em: {PASTA_ROTEIROS}")
        return 0

    print(f"Encontrados {len(arquivos)} roteiro(s).")
    resultados = [await gerar(arquivo, args.pausa, args.rate) for arquivo in arquivos]
    sucesso = sum(resultados)
    print(f"\nConcluído: {sucesso}/{len(arquivos)} MP3(s) gerados em {PASTA_AUDIOS}")
    return 0 if sucesso == len(arquivos) else 2


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(main()))
    except KeyboardInterrupt:
        print("\nGeração cancelada pelo usuário.")
        raise SystemExit(130)
