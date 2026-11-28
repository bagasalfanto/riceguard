import { Fragment, useEffect, useState, type FormEvent, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  Database,
  ExternalLink,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Save,
} from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  CONTENT_KEY_PRESETS,
  invalidateContentQueries,
  useAdminContent,
} from "@/features/admin/adminData"
import { formatTanggalWaktuId, useDataSources } from "@/features/data/dataTransparencyData"
import { apiPut } from "@/lib/api"
import type { ContentItem, SourceItem } from "@/lib/tipe-api"
import { cn } from "@/lib/utils"

function renderInlineMarkdown(text: string): ReactNode[] {
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/g
  const parts = text.split(tokenRegex)

  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={idx}>{part.slice(1, -1)}</em>
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={idx} className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
          {part.slice(1, -1)}
        </code>
      )
    }
    const linkMatch = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(part)
    if (linkMatch) {
      return (
        <a
          key={idx}
          className="text-primary underline underline-offset-4"
          href={linkMatch[2]}
          rel="noopener noreferrer"
          target="_blank"
        >
          {linkMatch[1]}
        </a>
      )
    }
    return <Fragment key={idx}>{part}</Fragment>
  })
}

function MarkdownPreview({ markdown }: { markdown: string }) {
  const trimmed = markdown.trim()
  if (!trimmed) {
    return (
      <p className="text-sm italic text-muted-foreground">
        Isi Markdown kosong. Blok ini akan tersimpan dengan isi kosong.
      </p>
    )
  }

  const lines = markdown.split(/\r?\n/)
  const blocks: ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i] ?? ""
    const stripped = line.trim()

    if (!stripped) {
      i += 1
      continue
    }

    if (stripped.startsWith("### ")) {
      blocks.push(
        <h3 key={`h3-${i}`} className="text-base font-semibold">
          {renderInlineMarkdown(stripped.slice(4))}
        </h3>,
      )
      i += 1
      continue
    }

    if (stripped.startsWith("## ")) {
      blocks.push(
        <h2 key={`h2-${i}`} className="text-lg font-semibold">
          {renderInlineMarkdown(stripped.slice(3))}
        </h2>,
      )
      i += 1
      continue
    }

    if (stripped.startsWith("# ")) {
      blocks.push(
        <h1 key={`h1-${i}`} className="text-xl font-semibold">
          {renderInlineMarkdown(stripped.slice(2))}
        </h1>,
      )
      i += 1
      continue
    }

    if (/^[-*]\s+/.test(stripped)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test((lines[i] ?? "").trim())) {
        items.push((lines[i] ?? "").trim().replace(/^[-*]\s+/, ""))
        i += 1
      }
      blocks.push(
        <ul key={`ul-${i}`} className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>,
      )
      continue
    }

    if (/^\d+\.\s+/.test(stripped)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test((lines[i] ?? "").trim())) {
        items.push((lines[i] ?? "").trim().replace(/^\d+\.\s+/, ""))
        i += 1
      }
      blocks.push(
        <ol key={`ol-${i}`} className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineMarkdown(item)}</li>
          ))}
        </ol>,
      )
      continue
    }

    const paragraphLines: string[] = [stripped]
    i += 1
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() &&
      !/^(#{1,3}\s+|[-*]\s+|\d+\.\s+)/.test((lines[i] ?? "").trim())
    ) {
      paragraphLines.push((lines[i] ?? "").trim())
      i += 1
    }
    blocks.push(
      <p key={`p-${i}`} className="text-sm leading-relaxed text-muted-foreground">
        {renderInlineMarkdown(paragraphLines.join(" "))}
      </p>,
    )
  }

  return <div className="space-y-3">{blocks}</div>
}

interface SourceDraftValues {
  nama: string
  instansi: string
  tabel_resmi: string
  tahun: string
  diperbarui: string
  url: string
}

export function AdminContentPage() {
  const queryClient = useQueryClient()
  const contentQuery = useAdminContent()
  const sourcesQuery = useDataSources()

  const contentItems = contentQuery.data ?? []
  const sources = sourcesQuery.data ?? []

  const [selectedKey, setSelectedKey] = useState<string>("")
  const [title, setTitle] = useState("")
  const [bodyMd, setBodyMd] = useState("")
  const [savingContent, setSavingContent] = useState(false)

  const [newKeyOpen, setNewKeyOpen] = useState(false)
  const [newKeyInput, setNewKeyInput] = useState("")

  const [editingSource, setEditingSource] = useState<SourceItem | null>(null)
  const [sourceValues, setSourceValues] = useState<SourceDraftValues>({
    nama: "",
    instansi: "",
    tabel_resmi: "",
    tahun: "",
    diperbarui: "",
    url: "",
  })
  const [savingSource, setSavingSource] = useState(false)

  useEffect(() => {
    if (!selectedKey && contentItems.length > 0) {
      const first = contentItems[0]
      if (first) {
        setSelectedKey(first.key)
        setTitle(first.title)
        setBodyMd(first.body_md)
      }
    }
  }, [contentItems, selectedKey])

  function selectContentItem(key: string) {
    setSelectedKey(key)
    const found = contentItems.find((item) => item.key === key)
    if (found) {
      setTitle(found.title)
      setBodyMd(found.body_md)
    } else {
      const preset = CONTENT_KEY_PRESETS.find((p) => p.key === key)
      setTitle(preset?.label ?? key)
      setBodyMd("")
    }
  }

  async function handleSaveContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const key = selectedKey.trim()
    if (!key) {
      toast.error("Pilih atau buat key konten terlebih dahulu.")
      return
    }
    if (!title.trim()) {
      toast.error("Judul konten wajib diisi.")
      return
    }

    setSavingContent(true)
    try {
      await apiPut<ContentItem>(`/admin/content/${encodeURIComponent(key)}`, {
        title: title.trim(),
        body_md: bodyMd,
      })
      await invalidateContentQueries(queryClient)
      toast.success(`Konten "${key}" berhasil disimpan dan langsung aktif di situs publik.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan konten.")
    } finally {
      setSavingContent(false)
    }
  }

  function handleAddNewKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const clean = newKeyInput
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_-]/g, "")
    if (!clean) {
      toast.error("Masukkan nama key yang valid (huruf kecil, angka, garis bawah, atau tanda hubung).")
      return
    }
    setNewKeyOpen(false)
    setNewKeyInput("")
    selectContentItem(clean)
  }

  function openSourceEditor(source: SourceItem) {
    setEditingSource(source)
    setSourceValues({
      nama: source.nama,
      instansi: source.instansi,
      tabel_resmi: source.tabel_resmi ?? "",
      tahun: source.tahun ? String(source.tahun) : "",
      diperbarui: source.diperbarui ?? "",
      url: source.url ?? "",
    })
  }

  async function handleSaveSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingSource) return
    if (!sourceValues.nama.trim() || !sourceValues.instansi.trim()) {
      toast.error("Nama dan instansi sumber data wajib diisi.")
      return
    }

    const parsedYear = sourceValues.tahun.trim() ? Number(sourceValues.tahun.trim()) : null
    if (parsedYear !== null && (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 2100)) {
      toast.error("Tahun sumber data tidak valid.")
      return
    }

    setSavingSource(true)
    try {
      await apiPut<SourceItem>(`/admin/sources/${editingSource.id}`, {
        nama: sourceValues.nama.trim(),
        instansi: sourceValues.instansi.trim(),
        tabel_resmi: sourceValues.tabel_resmi.trim() || null,
        tahun: parsedYear,
        diperbarui: sourceValues.diperbarui.trim() || null,
        url: sourceValues.url.trim() || null,
      })
      await invalidateContentQueries(queryClient)
      toast.success(`Sumber data "${sourceValues.nama.trim()}" berhasil diperbarui.`)
      setEditingSource(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui sumber data.")
    } finally {
      setSavingSource(false)
    }
  }

  const activeContentMeta = contentItems.find((item) => item.key === selectedKey)
  const missingPresets = CONTENT_KEY_PRESETS.filter(
    (preset) => !contentItems.some((item) => item.key === preset.key),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Kelola Konten &amp; Sumber Data</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Perubahan konten narasi dan sumber data langsung berlaku di halaman publik tanpa
          memerlukan deploy ulang, dan tercatat di audit log.
        </p>
      </div>

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">
            <FileText aria-hidden="true" className="size-4" />
            Blok Konten ({contentItems.length})
          </TabsTrigger>
          <TabsTrigger value="sources">
            <Database aria-hidden="true" className="size-4" />
            Sumber Data ({sources.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent className="mt-4" value="content">
          {contentQuery.error ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Gagal memuat blok konten</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {contentQuery.error instanceof Error
                    ? contentQuery.error.message
                    : "Terjadi kesalahan."}
                </span>
                <Button onClick={() => void contentQuery.refetch()} size="sm" variant="outline">
                  Coba Lagi
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
              <Card className="h-fit">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">Daftar Key</CardTitle>
                    <Button
                      onClick={() => setNewKeyOpen(true)}
                      size="xs"
                      type="button"
                      variant="outline"
                    >
                      <Plus aria-hidden="true" className="size-3" />
                      Tambah
                    </Button>
                  </div>
                  <CardDescription>Pilih blok teks untuk disunting.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {contentQuery.isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-9 w-full" />
                      <Skeleton className="h-9 w-full" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col gap-1">
                        {contentItems.map((item) => (
                          <button
                            key={item.key}
                            className={cn(
                              "flex flex-col items-start rounded-md border px-3 py-2 text-left text-sm transition-colors",
                              selectedKey === item.key
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-transparent hover:bg-accent",
                            )}
                            onClick={() => selectContentItem(item.key)}
                            type="button"
                          >
                            <span className="font-mono text-xs font-semibold">{item.key}</span>
                            <span className="line-clamp-1 text-xs text-muted-foreground">
                              {item.title}
                            </span>
                          </button>
                        ))}
                      </div>

                      {selectedKey &&
                      !contentItems.some((item) => item.key === selectedKey) ? (
                        <div className="rounded-md border border-dashed border-primary/50 bg-primary/5 px-3 py-2 text-xs">
                          <span className="font-mono font-semibold">{selectedKey}</span>
                          <p className="text-muted-foreground">Key baru (belum disimpan)</p>
                        </div>
                      ) : null}

                      {missingPresets.length > 0 ? (
                        <div className="border-t pt-3">
                          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                            Preset Belum Dibuat
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {missingPresets.map((preset) => (
                              <Button
                                key={preset.key}
                                onClick={() => selectContentItem(preset.key)}
                                size="xs"
                                type="button"
                                variant="secondary"
                              >
                                + {preset.key}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">
                        Editor Konten {selectedKey ? `· ${selectedKey}` : ""}
                      </CardTitle>
                      <CardDescription>
                        {activeContentMeta
                          ? `Terakhir diperbarui ${formatTanggalWaktuId(activeContentMeta.updated_at)}`
                          : "Pilih atau tambah key untuk mulai menyunting."}
                      </CardDescription>
                    </div>
                    {selectedKey ? (
                      <Badge className="font-mono" variant="outline">
                        {selectedKey}
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={(e) => void handleSaveContent(e)}>
                    <div className="space-y-1.5">
                      <Label htmlFor="content-title">Judul Blok</Label>
                      <Input
                        disabled={!selectedKey || savingContent}
                        id="content-title"
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Judul bagian konten"
                        required
                        value={title}
                      />
                    </div>

                    <Tabs defaultValue="editor">
                      <TabsList>
                        <TabsTrigger value="editor">Editor Markdown</TabsTrigger>
                        <TabsTrigger value="preview">Pratinjau Hasil</TabsTrigger>
                        <TabsTrigger value="split">Berdampingan</TabsTrigger>
                      </TabsList>

                      <TabsContent className="mt-3" value="editor">
                        <Textarea
                          className="min-h-64 font-mono text-sm"
                          disabled={!selectedKey || savingContent}
                          id="content-body"
                          onChange={(e) => setBodyMd(e.target.value)}
                          placeholder="Tulis isi Markdown di sini (boleh dikosongkan untuk mengosongkan blok)..."
                          rows={12}
                          value={bodyMd}
                        />
                      </TabsContent>

                      <TabsContent className="mt-3" value="preview">
                        <div className="min-h-64 rounded-lg border bg-card p-4">
                          <MarkdownPreview markdown={bodyMd} />
                        </div>
                      </TabsContent>

                      <TabsContent className="mt-3" value="split">
                        <div className="grid gap-4 md:grid-cols-2">
                          <Textarea
                            className="min-h-64 font-mono text-sm"
                            disabled={!selectedKey || savingContent}
                            onChange={(e) => setBodyMd(e.target.value)}
                            placeholder="Tulis isi Markdown..."
                            rows={12}
                            value={bodyMd}
                          />
                          <div className="min-h-64 rounded-lg border bg-card p-4">
                            <MarkdownPreview markdown={bodyMd} />
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>

                    <div className="flex justify-end">
                      <Button disabled={!selectedKey || savingContent} type="submit">
                        {savingContent ? (
                          <>
                            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                            Menyimpan...
                          </>
                        ) : (
                          <>
                            <Save aria-hidden="true" className="size-4" />
                            Simpan Konten
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent className="mt-4" value="sources">
          {sourcesQuery.error ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Gagal memuat sumber data</AlertTitle>
              <AlertDescription>
                {sourcesQuery.error instanceof Error
                  ? sourcesQuery.error.message
                  : "Terjadi kesalahan."}
              </AlertDescription>
            </Alert>
          ) : sourcesQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : sources.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Belum ada sumber data terdaftar.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {sources.map((src) => (
                <Card key={src.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{src.nama}</CardTitle>
                        <CardDescription>
                          {src.instansi} · <span className="font-mono text-xs">{src.key}</span>
                        </CardDescription>
                      </div>
                      <Button
                        onClick={() => openSourceEditor(src)}
                        size="xs"
                        type="button"
                        variant="outline"
                      >
                        <Pencil aria-hidden="true" className="size-3" />
                        Edit
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1.5 text-sm">
                    <p className="text-xs text-muted-foreground">
                      Tabel resmi:{" "}
                      <span className="text-foreground">{src.tabel_resmi || "—"}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Tahun acuan:{" "}
                      <span className="font-mono text-foreground">{src.tahun ?? "—"}</span> ·
                      Diperbarui:{" "}
                      <span className="text-foreground">{src.diperbarui || "—"}</span>
                    </p>
                    {src.url ? (
                      <a
                        className="inline-flex items-center gap-1 pt-1 text-xs text-primary underline underline-offset-4"
                        href={src.url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Buka tautan resmi
                        <ExternalLink aria-hidden="true" className="size-3" />
                      </a>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog onOpenChange={setNewKeyOpen} open={newKeyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Key Konten Baru</DialogTitle>
            <DialogDescription>
              Masukkan identifier key (misalnya <code>hero</code>, <code>about</code>,{" "}
              <code>faq</code>).
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleAddNewKey}>
            <div className="space-y-1.5">
              <Label htmlFor="new-content-key">Key Konten</Label>
              <Input
                id="new-content-key"
                onChange={(e) => setNewKeyInput(e.target.value)}
                placeholder="mis. methodology"
                required
                value={newKeyInput}
              />
            </div>
            <DialogFooter>
              <Button onClick={() => setNewKeyOpen(false)} type="button" variant="outline">
                Batal
              </Button>
              <Button type="submit">Lanjut Edit</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) setEditingSource(null)
        }}
        open={Boolean(editingSource)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sumber Data ({editingSource?.key})</DialogTitle>
            <DialogDescription>
              Metadata ini tampil di halaman Landing dan halaman Data &amp; Metodologi.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => void handleSaveSource(e)}>
            <div className="space-y-1.5">
              <Label htmlFor="src-nama">Nama Sumber</Label>
              <Input
                id="src-nama"
                onChange={(e) => setSourceValues((p) => ({ ...p, nama: e.target.value }))}
                required
                value={sourceValues.nama}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="src-instansi">Instansi</Label>
              <Input
                id="src-instansi"
                onChange={(e) => setSourceValues((p) => ({ ...p, instansi: e.target.value }))}
                required
                value={sourceValues.instansi}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="src-tabel">Tabel Resmi</Label>
              <Input
                id="src-tabel"
                onChange={(e) =>
                  setSourceValues((p) => ({ ...p, tabel_resmi: e.target.value }))
                }
                value={sourceValues.tabel_resmi}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="src-tahun">Tahun</Label>
                <Input
                  id="src-tahun"
                  onChange={(e) => setSourceValues((p) => ({ ...p, tahun: e.target.value }))}
                  type="number"
                  value={sourceValues.tahun}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="src-diperbarui">Diperbarui (YYYY-MM-DD)</Label>
                <Input
                  id="src-diperbarui"
                  onChange={(e) =>
                    setSourceValues((p) => ({ ...p, diperbarui: e.target.value }))
                  }
                  placeholder="2025-11-01"
                  value={sourceValues.diperbarui}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="src-url">URL Resmi</Label>
              <Input
                id="src-url"
                onChange={(e) => setSourceValues((p) => ({ ...p, url: e.target.value }))}
                placeholder="https://..."
                type="url"
                value={sourceValues.url}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                disabled={savingSource}
                onClick={() => setEditingSource(null)}
                type="button"
                variant="outline"
              >
                Batal
              </Button>
              <Button disabled={savingSource} type="submit">
                {savingSource ? (
                  <>
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Sumber"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
