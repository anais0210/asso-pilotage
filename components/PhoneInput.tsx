"use client"
import { useState, useEffect } from "react"

export const INDICATIFS = [
  { code: "+33",  pays: "France" },
  { code: "+32",  pays: "Belgique" },
  { code: "+41",  pays: "Suisse" },
  { code: "+34",  pays: "Espagne" },
  { code: "+351", pays: "Portugal" },
  { code: "+44",  pays: "Royaume-Uni" },
  { code: "+49",  pays: "Allemagne" },
  { code: "+212", pays: "Maroc" },
  { code: "+213", pays: "Algérie" },
  { code: "+216", pays: "Tunisie" },
  { code: "+221", pays: "Sénégal" },
  { code: "+223", pays: "Mali" },
  { code: "+224", pays: "Guinée" },
  { code: "+225", pays: "Côte d'Ivoire" },
  { code: "+237", pays: "Cameroun" },
  { code: "+242", pays: "Congo" },
  { code: "+243", pays: "RD Congo" },
  { code: "+229", pays: "Bénin" },
  { code: "+226", pays: "Burkina Faso" },
  { code: "+228", pays: "Togo" },
  { code: "+227", pays: "Niger" },
  { code: "+245", pays: "Guinée-Bissau" },
  { code: "+238", pays: "Cap-Vert" },
]

// Trie par longueur de code décroissante pour matcher +351 avant +35
const INDICATIFS_SORTED = [...INDICATIFS].sort((a, b) => b.code.length - a.code.length)

export function parsePhone(value: string): { indicatif: string; numero: string } {
  if (!value) return { indicatif: "+33", numero: "" }
  const match = INDICATIFS_SORTED.find(i => value.startsWith(i.code))
  if (match) return { indicatif: match.code, numero: value.slice(match.code.length).trim() }
  return { indicatif: "+33", numero: value }
}

const BASE = "px-3 py-2.5 rounded-xl border border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ateliers"

export default function PhoneInput({
  value,
  onChange,
  placeholder = "6 12 34 56 78",
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const init = parsePhone(value)
  const [indicatif, setIndicatif] = useState(init.indicatif)
  const [numero, setNumero] = useState(init.numero)

  // Sync si la valeur change de l'extérieur (ex : reset du form)
  useEffect(() => {
    const p = parsePhone(value)
    setIndicatif(p.indicatif)
    setNumero(p.numero)
  }, [value])

  function emit(ind: string, num: string) {
    onChange(num.trim() ? `${ind} ${num.trim()}` : "")
  }

  return (
    <div className="flex gap-1.5">
      <select
        value={indicatif}
        onChange={e => { setIndicatif(e.target.value); emit(e.target.value, numero) }}
        className={`shrink-0 w-36 ${BASE}`}
      >
        {INDICATIFS.map(i => (
          <option key={i.code} value={i.code}>{i.code} — {i.pays}</option>
        ))}
      </select>
      <input
        type="tel"
        value={numero}
        onChange={e => { setNumero(e.target.value); emit(indicatif, e.target.value) }}
        placeholder={placeholder}
        className={`flex-1 placeholder:text-slate-300 ${BASE}`}
      />
    </div>
  )
}
