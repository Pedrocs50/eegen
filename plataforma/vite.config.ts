import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // O pacote principal (~510 KB, ~150 KB comprimido) é a base: React, roteamento e Supabase.
  // As telas internas e o encoder de MP3 já são carregados sob demanda.
  build: { chunkSizeWarningLimit: 600 },
});
