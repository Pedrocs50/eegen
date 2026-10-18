# eegen — gerador de exercícios de listening em inglês

Transforma roteiros de diálogo (`roteiros/*.txt`) em:

- **áudios MP3** com vozes neurais diferentes para cada falante (edge-tts);
- **planilha** `planilhas/exercicios.xlsx` com exercícios de verdadeiro/falso e múltipla escolha, com alternativas embaralhadas e gabarito.

## Instalação

1. Python 3.10 ou mais novo.
2. FFmpeg no PATH (ou `ffmpeg.exe` na pasta do projeto).
3. Dependências:

```bash
py -m pip install -r requirements.txt
```

## Uso

```bash
py gerador.py                  # valida, gera áudios e planilha
py gerador.py --validar        # só confere os roteiros
py gerador.py --so-planilha    # não chama o TTS
py gerador.py --so-audio --forcar --rate=-10% --pausa 600
py gerador.py --seed 2         # outro sorteio das alternativas
py gerador.py --paralelo 10    # mais falas ao mesmo tempo no TTS
```

Áudios só são refeitos quando as falas, vozes, velocidade ou pausa mudam.

## Formato do roteiro

```
TITLE: Greetings at the Cafe
LEVEL: Below Beginner (Pre-A1)
VOICE MIA: en-GB-SoniaNeural

AUDIO SCRIPT
MIA: Hello.
SAM: Hello.

TRUE OR FALSE
[T] Sam orders a small coffee.
[F] Sam does not want milk.
> Explicação opcional.

MULTIPLE CHOICE
? What does Sam order?
* Coffee
- Tea
- Juice
```

- `TITLE`, `LEVEL` e `VOICE` são opcionais (título e nível saem do nome `A1_02_Titulo.txt`).
- `*` marca a alternativa correta; `-` as erradas (2 a 5 alternativas).
- `>` logo abaixo de uma questão define a explicação dela.

O TTS roda várias falas ao mesmo tempo (`--paralelo`, padrão 6). Se o serviço começar a recusar, diminua o número.

## Geração automática (GitHub Actions)

A cada push na `main` que altere `roteiros/`, `gerador.py` ou `requirements.txt`, o workflow
[`gerar.yml`](.github/workflows/gerar.yml) valida os roteiros e gera áudios e planilha.
Só os áudios de roteiros alterados são refeitos (o resto vem do cache da execução anterior).

Para baixar: aba **Actions** → execução mais recente → **Artifacts** → `materiais`.
Para rodar na mão ou regerar tudo: **Actions** → *Gerar áudios e planilha* → **Run workflow**.

## Plataforma web (`plataforma/`)

React + Vite + TypeScript + Tailwind, com Supabase (banco, login, arquivos).

1. No Supabase: **SQL Editor** → cole e rode, em ordem, cada arquivo de [`supabase/migrations/`](supabase/migrations/) (`0001_...`, `0002_...`).
2. Copie `plataforma/.env.example` para `plataforma/.env.local` e preencha a publishable key.
3. Rode:

```bash
npm --prefix plataforma install
npm --prefix plataforma run dev
```

Papéis: todo cadastro novo entra como **aluno**; um **admin** promove professores na tela *Usuários*.

## Status das partes

| Parte | Status |
|---|---|
| Login, cadastro, papéis, tela de usuários | Pronto |
| Identidade visual, menu lateral, tema escuro, página da professora | Pronto |
| Cursos, aulas e turmas | **Em espera**: veja [docs/cursos-e-turmas.md](docs/cursos-e-turmas.md) |
| Exercícios | **Foco atual**: desenho em [docs/exercicios.md](docs/exercicios.md) |
