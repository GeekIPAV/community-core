import { useEffect } from "react";

/**
 * Atalhos de teclado globais.
 *  /   → foca a barra de pesquisa da tabela visível
 *  n   → clica no primeiro botão "Novo …" visível (criar registo)
 *  Esc → desfoca o input ativo
 * Ignorado quando o utilizador está a escrever num campo de texto.
 */
export function GlobalShortcuts() {
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el.isContentEditable
      );
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Escape") {
        const el = document.activeElement as HTMLElement | null;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) el.blur();
        return;
      }

      if (isTyping()) return;

      if (e.key === "/") {
        const input = document.querySelector<HTMLInputElement>(
          "[data-smart-table-search]",
        );
        if (input) {
          e.preventDefault();
          input.focus();
          input.select();
        }
        return;
      }

      if (e.key === "n" || e.key === "N") {
        const btn = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
          (b) =>
            b.offsetParent !== null &&
            !b.disabled &&
            /\bnovo\b/i.test(b.textContent ?? ""),
        );
        if (btn) {
          e.preventDefault();
          btn.click();
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}