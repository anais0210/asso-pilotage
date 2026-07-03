"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  FileDown,
  ExternalLink,
  Trash2,
} from "lucide-react"
import {
  type Brouillon,
  type RapportArchive,
  type SectionTitles,
  BROUILLONS_MOCK,
  HISTORIQUE_MOCK,
  SECTION_TITLES_DEFAUT,
  RAPPORT_KPIS_MOCK,
  SEPARATEUR_DIAPOSITIVES,
  STYLE_DEFAUT,
  STORAGE_BROUILLONS,
  STORAGE_HISTORIQUE,
  STORAGE_SECTIONS,
  decouperDiapositives,
  genererContenuBrouillon,
  migrerContenuBrouillon,
  titrePeriode,
  load,
  save,
} from "@/lib/rapports-data"
import { creerSlide, pdfDownloadUrl, supprimerSlide } from "@/lib/rapports-slides-api"
import { genererRapportIA } from "@/lib/rapports-generation-api"

function RenommableTitre({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function commit() {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed) onChange(trimmed)
    else setDraft(value)
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") { setDraft(value); setEditing(false) }
        }}
        className="font-semibold text-foreground text-base bg-transparent border-b border-rapports focus:outline-none"
      />
    )
  }

  return (
    <button
      type="button"
      onDoubleClick={() => setEditing(true)}
      className="group flex items-center gap-2 font-semibold text-foreground text-base"
    >
      {value}
      <Pencil
        size={13}
        onClick={(e) => { e.stopPropagation(); setEditing(true) }}
        className="text-muted opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </button>
  )
}

function Section({
  title,
  onTitleChange,
  children,
}: {
  title: string
  onTitleChange: (v: string) => void
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="bg-surface rounded-xl border border-border shadow-sm">
      <div className="flex items-center justify-between px-5 py-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-2 text-muted hover:text-foreground transition-colors"
        >
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="flex-1">
          <RenommableTitre value={title} onChange={onTitleChange} />
        </div>
      </div>
      {open && <div className="px-5 pb-5 border-t border-border pt-4">{children}</div>}
    </div>
  )
}

export default function RapportsPage() {
  const router = useRouter()
  const [sectionTitles, setSectionTitles] = useState<SectionTitles>(SECTION_TITLES_DEFAUT)
  const [brouillons, setBrouillons] = useState<Brouillon[]>(BROUILLONS_MOCK)
  const [historique, setHistorique] = useState<RapportArchive[]>(HISTORIQUE_MOCK)
  const [du, setDu] = useState("")
  const [au, setAu] = useState("")
  const [generation, setGeneration] = useState(false)
  const [genererErreur, setGenererErreur] = useState<string | null>(null)

  useEffect(() => {
    setSectionTitles(load(STORAGE_SECTIONS, SECTION_TITLES_DEFAUT))
    const brouillonsCharges = load(STORAGE_BROUILLONS, BROUILLONS_MOCK)
      .map((b) => ({ ...b, contenu: migrerContenuBrouillon(b.contenu) }))
    setBrouillons(brouillonsCharges)
    save(STORAGE_BROUILLONS, brouillonsCharges)
    setHistorique(load(STORAGE_HISTORIQUE, HISTORIQUE_MOCK))
  }, [])

  function persistSectionTitles(next: SectionTitles) {
    setSectionTitles(next)
    save(STORAGE_SECTIONS, next)
  }

  function persistBrouillons(next: Brouillon[]) {
    setBrouillons(next)
    save(STORAGE_BROUILLONS, next)
  }

  function persistHistorique(next: RapportArchive[]) {
    setHistorique(next)
    save(STORAGE_HISTORIQUE, next)
  }

  async function handleGenerer() {
    if (!du || !au) return
    setGeneration(true)
    setGenererErreur(null)
    const id = `b-${Date.now()}`
    const titre = `Rapport ${du} → ${au}`

    let contenu: string
    try {
      const segments = await genererRapportIA(RAPPORT_KPIS_MOCK, du, au)
      contenu = [titrePeriode(du, au), ...segments].join(SEPARATEUR_DIAPOSITIVES)
    } catch (e) {
      contenu = genererContenuBrouillon(RAPPORT_KPIS_MOCK, du, au)
      setGenererErreur(
        (e instanceof Error ? e.message : "Génération IA indisponible") +
        " — contenu simplifié généré à la place."
      )
    }

    const slide = await creerSlide(decouperDiapositives(contenu), titre)

    const nouveau: Brouillon = {
      id,
      titre,
      periodeDebut: du,
      periodeFin: au,
      modifieLe: new Date().toISOString().split("T")[0],
      contenu,
      slideId: slide?.presentationId,
      slideUrl: slide?.url,
      style: STYLE_DEFAUT,
    }
    persistBrouillons([nouveau, ...brouillons])
    router.push(`/rapports/edition/${id}`)
  }

  async function handleSupprimerBrouillon(b: Brouillon) {
    const avertissement = b.slideId
      ? "Supprimer ce brouillon supprimera aussi définitivement son fichier Google Slides sur Drive. Continuer ?"
      : "Supprimer ce brouillon ? Cette action est irréversible."
    if (!window.confirm(avertissement)) return
    if (b.slideId) await supprimerSlide(b.slideId)
    persistBrouillons(brouillons.filter((x) => x.id !== b.id))
  }

  async function handleSupprimerArchive(h: RapportArchive) {
    const avertissement = h.slideId
      ? "Supprimer ce rapport supprimera aussi définitivement son fichier Google Slides sur Drive. Continuer ?"
      : "Supprimer ce rapport ? Cette action est irréversible."
    if (!window.confirm(avertissement)) return
    if (h.slideId) await supprimerSlide(h.slideId)
    persistHistorique(historique.filter((x) => x.id !== h.id))
  }

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col gap-5">
      <header className="mb-2">
        <h1 className="text-2xl font-bold text-foreground">Rapports</h1>
        <p className="text-sm text-muted mt-1">
          Génération des rapports d'activité à partir des données Google Sheets
        </p>
      </header>

      <Section
        title={sectionTitles.creation}
        onTitleChange={(v) => persistSectionTitles({ ...sectionTitles, creation: v })}
      >
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted uppercase tracking-wider">
            Du
            <input
              type="date"
              value={du}
              onChange={(e) => setDu(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-rapports"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted uppercase tracking-wider">
            Au
            <input
              type="date"
              value={au}
              onChange={(e) => setAu(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-rapports"
            />
          </label>
          <button
            type="button"
            disabled={!du || !au || generation}
            onClick={handleGenerer}
            className="bg-rapports text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {generation ? "Génération en cours…" : "Générer la première version du rapport"}
          </button>
        </div>

        {genererErreur && (
          <p className="text-xs text-alert bg-red-50 rounded-lg px-3 py-2 mt-3">{genererErreur}</p>
        )}
      </Section>

      <Section
        title={sectionTitles.brouillons}
        onTitleChange={(v) => persistSectionTitles({ ...sectionTitles, brouillons: v })}
      >
        {brouillons.length === 0 ? (
          <p className="text-sm text-muted">Aucun brouillon en cours.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {brouillons.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-rapports-light/40 border border-rapports/10"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{b.titre}</p>
                  <p className="text-xs text-muted mt-0.5">Modifié le {b.modifieLe}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => router.push(`/rapports/edition/${b.id}`)}
                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-rapports/20 text-rapports-dark hover:bg-rapports-light transition-colors"
                  >
                    <Pencil size={13} /> Reprendre l'édition
                  </button>
                  {b.slideId ? (
                    <a
                      href={pdfDownloadUrl(b.slideId)}
                      className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border text-muted hover:bg-slate-50 transition-colors"
                    >
                      <FileDown size={13} /> PDF
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      title="Disponible une fois les dossiers Drive Rapports configurés"
                      className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border text-muted opacity-50 cursor-not-allowed"
                    >
                      <FileDown size={13} /> PDF
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSupprimerBrouillon(b)}
                    title="Supprimer ce brouillon"
                    aria-label="Supprimer ce brouillon"
                    className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border text-alert hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title={sectionTitles.historique}
        onTitleChange={(v) => persistSectionTitles({ ...sectionTitles, historique: v })}
      >
        {historique.length === 0 ? (
          <p className="text-sm text-muted">Aucun rapport archivé.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {historique.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-slate-50 border border-border"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{h.titre}</p>
                  <p className="text-xs text-muted mt-0.5">Généré le {h.dateGeneration}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {h.slideId ? (
                    <a
                      href={pdfDownloadUrl(h.slideId)}
                      className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border text-muted hover:bg-slate-50 transition-colors"
                    >
                      <FileDown size={13} /> PDF
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      title="Disponible une fois les dossiers Drive Rapports configurés"
                      className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border text-muted opacity-50 cursor-not-allowed"
                    >
                      <FileDown size={13} /> PDF
                    </button>
                  )}
                  {h.slideUrl ? (
                    <a
                      href={h.slideUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border text-muted hover:bg-slate-50 transition-colors"
                    >
                      <ExternalLink size={13} /> Slides
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      title="Disponible une fois les dossiers Drive Rapports configurés"
                      className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border text-muted opacity-50 cursor-not-allowed"
                    >
                      <ExternalLink size={13} /> Slides
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSupprimerArchive(h)}
                    title="Supprimer ce rapport"
                    aria-label="Supprimer ce rapport"
                    className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border text-alert hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
