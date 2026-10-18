import { BriefcaseBusiness, Globe2, Languages, MapPin, MessagesSquare } from "lucide-react";
import foto from "../assets/monique.jpg";
import { Pontilhado } from "../componentes/ui";

const ESPECIALIDADES = [
  "Aulas de conversação",
  "Inglês para negócios",
  "Preparação para entrevistas em inglês",
  "Inglês para fins específicos",
  "Tradução de currículo e LinkedIn",
  "Comunicação intercultural",
];

const FATOS = [
  { icone: Languages, texto: "Inglês, espanhol e francês" },
  { icone: MapPin, texto: "Mora no Canadá" },
  { icone: BriefcaseBusiness, texto: "Experiência em comércio exterior" },
  { icone: Globe2, texto: "Ensinando desde 2013" },
];

/** Apresentação da Teacher Monique. Aparece com ou sem login. */
export default function Sobre() {
  return (
    <article className="space-y-8">
      <section className="overflow-hidden rounded-3xl bg-marinho-800 text-white lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <img
          src={foto}
          alt="Teacher Monique Barros sorrindo, com um rio e a cidade ao fundo"
          className="aspect-square w-full object-cover object-[50%_70%] lg:aspect-auto lg:h-full"
        />
        <div className="p-6 sm:p-10">
          <p className="text-[11px] font-bold tracking-[0.14em] text-azul-300 uppercase">Conheça a professora</p>
          <h1 className="mt-2 text-4xl font-bold">Teacher Monique Barros</h1>
          <p className="mt-2 font-serif text-xl text-azul-300 italic">Idiomas como porta para oportunidades globais.</p>
          <Pontilhado className="mt-6 text-white/80" />
          <p className="mt-6 leading-relaxed text-white/85">
            Com mais de uma década de carreira, a Monique une dois mundos: o dinamismo dos negócios internacionais e o
            ensino de idiomas. Ela ensina o inglês e o espanhol não só como matéria, mas como ferramenta para atravessar
            fronteiras, com aulas práticas e personalizadas para o objetivo de cada aluno.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {FATOS.map(({ icone: Icone, texto }) => (
              <li key={texto} className="flex items-center gap-3 text-sm">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10"><Icone className="size-5 text-azul-300" /></span>
                {texto}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="rounded-2xl border border-borda bg-superficie p-6">
          <h2 className="text-xl font-bold text-marca">Especialidades</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {ESPECIALIDADES.map((item) => (
              <li key={item} className="rounded-full bg-destaque-suave px-3 py-1.5 text-sm font-medium text-marca">{item}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border-l-4 border-marca bg-creme p-6">
          <MessagesSquare className="size-6 text-marca" aria-hidden="true" />
          <p className="mt-3 font-serif text-lg italic">
            Cada aula é personalizada para tornar o idioma acessível e prático no dia a dia.
          </p>
          <a
            href="https://linktr.ee/teachermoniquebarros"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-sm font-semibold text-destaque hover:underline"
          >
            Agendar uma aula →
          </a>
        </div>
      </section>
    </article>
  );
}
