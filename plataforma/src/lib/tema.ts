import { useState } from "react";

export type Tema = "claro" | "escuro";

function lerTema(): Tema {
  try {
    return localStorage.getItem("tema") === "escuro" ? "escuro" : "claro";
  } catch {
    return "claro";
  }
}

/** Tema da interface. O claro é o padrão, por ser o da marca. */
export function useTema() {
  const [tema, setTema] = useState<Tema>(lerTema);

  function alternar() {
    const novo: Tema = tema === "claro" ? "escuro" : "claro";
    document.documentElement.classList.toggle("dark", novo === "escuro");
    try {
      localStorage.setItem("tema", novo);
    } catch {
      // Sem armazenamento (aba anônima, por exemplo): o tema vale só nesta visita.
    }
    setTema(novo);
  }

  return { tema, alternar };
}
