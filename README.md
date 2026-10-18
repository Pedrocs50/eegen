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
