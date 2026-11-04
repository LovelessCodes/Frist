import { useEffect, useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useLocale, useTranslations } from 'use-intl'
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  MoreHorizontal,
  Plus,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Menu, MenuItem, MenuPopup, MenuTrigger } from '@/components/ui/menu'
import { cn } from 'cn'
import {
  createMyApiKey,
  disableIcal,
  enableIcal,
  getIcalStatus,
  listMyApiKeys,
  revokeMyApiKey,
  rotateIcal,
} from '@/lib/app.functions'
import { getSession } from '@/lib/auth.functions'

export const Route = createFileRoute('/_app/integrations')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/sign-in' })
    }
    return { user: session.user }
  },
  loader: async () => {
    const [ical, keys] = await Promise.all([getIcalStatus(), listMyApiKeys()])
    return { ical, keys }
  },
  component: Integrations,
})

function maskedPath(path: string) {
  return `${path.slice(0, path.lastIndexOf('/') + 1)}${'•'.repeat(22)}`
}

function formatDate(value: Date | string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

/** Copy icon that crossfades into a check while the value is on the clipboard. */
function CopyGlyph({ copied }: { copied: boolean }) {
  return (
    <span className="relative block size-3.5" aria-hidden="true">
      <Copy
        className={cn(
          'absolute inset-0 size-3.5 transition-[opacity,transform] duration-150 ease-out',
          copied ? 'scale-50 opacity-0' : 'scale-100 opacity-100',
        )}
      />
      <Check
        className={cn(
          'absolute inset-0 size-3.5 text-emerald-600 transition-[opacity,transform] duration-150 ease-out dark:text-emerald-400',
          copied ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
        )}
      />
    </span>
  )
}

function Integrations() {
  const { ical, keys } = Route.useLoaderData()
  const router = useRouter()
  const t = useTranslations('integrations')
  const locale = useLocale()
  const [origin, setOrigin] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<'feed' | 'key' | 'mcp' | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [flash, setFlash] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [revokeId, setRevokeId] = useState<string | null>(null)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const feedUrl = ical.path ? `${origin}${ical.path}` : null
  const mcpUrl = `${origin}/api/mcp`
  const mcpSnippet = `{
  "mcpServers": {
    "frist": {
      "url": "${mcpUrl}",
      "headers": { "x-api-key": "<key>" }
    }
  }
}`
  const revoking = keys.find((key) => key.id === revokeId) ?? null

  async function run(action: () => Promise<unknown>) {
    setPending(true)
    setError(null)
    try {
      await action()
      await router.invalidate()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('errGeneric'))
    } finally {
      setPending(false)
    }
  }

  async function copy(value: string, flag: 'feed' | 'key' | 'mcp') {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(flag)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // clipboard unavailable: the value is visible for manual copying
    }
  }

  function rotate() {
    setRotateOpen(false)
    setRevealed(true)
    setFlash(true)
    window.setTimeout(() => setFlash(false), 1400)
    void run(() => rotateIcal())
  }

  function disableFeed() {
    setDisableOpen(false)
    void run(() => disableIcal())
  }

  function createKey() {
    const name = keyName.trim()
    setCreateOpen(false)
    setKeyName('')
    void run(async () => {
      const created = await createMyApiKey({ data: { name } })
      setCreatedKey(created.key)
    })
  }

  function revokeSelected() {
    const keyId = revokeId
    if (!keyId) return
    setRevokeId(null)
    void run(() => revokeMyApiKey({ data: { keyId } }))
  }

  return (
    <div className="min-h-full">
      <main className="flex w-full flex-col gap-5 px-6 py-8">
        <header className="flex flex-col gap-2">
          <h1 className="font-heading text-lg font-medium">{t('title')}</h1>
          <p className="flex max-w-prose items-start gap-2 text-xs text-muted-foreground">
            <ShieldAlert
              className="mt-px size-3.5 shrink-0"
              aria-hidden="true"
            />
            <span>{t('caution')}</span>
          </p>
        </header>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-1.5">
              <CardTitle>{t('feedTitle')}</CardTitle>
              <CardDescription>{t('feedDescription')}</CardDescription>
            </div>
            <CardAction>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    ical.path ? 'bg-emerald-500' : 'bg-muted-foreground/40',
                  )}
                  aria-hidden="true"
                />
                {ical.path ? t('statusActive') : t('statusDisabled')}
              </span>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {feedUrl ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t('feedUrlLabel')}
                  </p>
                  <div
                    className={cn(
                      'flex items-center gap-1 rounded-lg border border-border bg-muted/30 py-1 pr-1 pl-3 transition-shadow duration-300 ease-out',
                      flash && 'ring-2 ring-primary/40',
                    )}
                  >
                    <code
                      key={revealed ? 'revealed' : 'masked'}
                      className="min-w-0 flex-1 animate-in truncate font-mono text-xs fade-in-0 duration-150"
                    >
                      {revealed
                        ? feedUrl
                        : `${origin}${maskedPath(ical.path ?? '')}`}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={revealed ? t('hideUrl') : t('revealUrl')}
                      onClick={() => setRevealed((value) => !value)}
                    >
                      {revealed ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t('copyUrl')}
                      onClick={() => copy(feedUrl, 'feed')}
                    >
                      <CopyGlyph copied={copied === 'feed'} />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => setRotateOpen(true)}
                  >
                    <RefreshCw className="size-3.5" />
                    {t('rotateUrl')}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={pending}
                    onClick={() => setDisableOpen(true)}
                  >
                    {t('disableFeed')}
                  </Button>
                </div>
                <p className="-mt-1 text-xs text-muted-foreground">
                  {t('rotateNote')}
                </p>
              </>
            ) : (
              <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border p-4">
                <p className="text-sm text-muted-foreground">{t('feedOff')}</p>
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => enableIcal())}
                >
                  {t('enableFeed')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-1.5">
              <CardTitle>{t('mcpTitle')}</CardTitle>
              <CardDescription>{t('mcpDescription')}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium">{t('mcpEndpoint')}</span>
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">
                  {mcpUrl}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(mcpUrl, 'mcp')}
                >
                  <CopyGlyph copied={copied === 'mcp'} />
                  {copied === 'mcp' ? t('copied') : t('copy')}
                </Button>
              </div>
            </div>
            <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {mcpSnippet}
            </pre>
            <p className="text-xs text-muted-foreground">{t('mcpHint')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-1.5">
              <CardTitle>{t('keysTitle')}</CardTitle>
              <CardDescription>{t('keysDescription')}</CardDescription>
            </div>
            <CardAction>
              <Button
                size="sm"
                disabled={pending}
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="size-3.5" />
                {t('createKey')}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {createdKey ? (
              <div className="flex animate-in flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 duration-200 fade-in-0 slide-in-from-top-1">
                <p className="text-xs font-medium">{t('shownOnce')}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">
                    {createdKey}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copy(createdKey, 'key')}
                  >
                    <CopyGlyph copied={copied === 'key'} />
                    {copied === 'key' ? t('copied') : t('copy')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCreatedKey(null)}
                  >
                    {t('done')}
                  </Button>
                </div>
              </div>
            ) : null}

            {keys.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('emptyKeys')}</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">{t('colName')}</th>
                      <th className="px-3 py-2 font-medium">{t('colKey')}</th>
                      <th className="px-3 py-2 font-medium">
                        {t('colCreated')}
                      </th>
                      <th className="px-3 py-2 font-medium">
                        {t('colLastUsed')}
                      </th>
                      <th className="w-10 px-2 py-2">
                        <span className="sr-only">{t('colActions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {keys.map((key) => (
                      <tr
                        key={key.id}
                        className="transition-colors duration-150 ease-out hover:bg-muted/30"
                      >
                        <td className="px-3 py-2.5 text-sm font-medium">
                          {key.name ?? t('unnamedKey')}
                          {key.enabled ? null : (
                            <Badge variant="outline" className="ml-2">
                              {t('disabledBadge')}
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                          {key.start ? `${key.start}…` : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap text-muted-foreground">
                          {formatDate(key.createdAt, locale)}
                        </td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap text-muted-foreground">
                          {key.lastRequest
                            ? formatDate(key.lastRequest, locale)
                            : t('never')}
                        </td>
                        <td className="px-2 py-2.5 text-right">
                          <Menu>
                            <MenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={t('actionsFor', {
                                    name: key.name ?? t('unnamedKey'),
                                  })}
                                />
                              }
                            >
                              <MoreHorizontal className="size-4" />
                            </MenuTrigger>
                            <MenuPopup align="end" className="w-44">
                              <MenuItem
                                variant="destructive"
                                closeOnClick
                                disabled={pending}
                                onClick={() => setRevokeId(key.id)}
                              >
                                {t('revokeKey')}
                              </MenuItem>
                            </MenuPopup>
                          </Menu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('rotateTitle')}</DialogTitle>
            <DialogDescription>{t('rotateDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              {t('cancel')}
            </DialogClose>
            <Button size="sm" disabled={pending} onClick={rotate}>
              {t('rotateUrl')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('disableTitle')}</DialogTitle>
            <DialogDescription>{t('disableDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              {t('keepIt')}
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={disableFeed}
            >
              {t('disableFeed')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) setKeyName('')
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('createTitle')}</DialogTitle>
            <DialogDescription>{t('createDescription')}</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (keyName.trim()) createKey()
            }}
          >
            <Field>
              <FieldLabel htmlFor="key-name">{t('keyNameLabel')}</FieldLabel>
              <Input
                id="key-name"
                autoFocus
                value={keyName}
                onChange={(event) => setKeyName(event.target.value)}
                placeholder={t('keyNamePlaceholder')}
              />
            </Field>
            <DialogFooter>
              <DialogClose
                render={<Button variant="outline" size="sm" type="button" />}
              >
                {t('cancel')}
              </DialogClose>
              <Button
                type="submit"
                size="sm"
                disabled={pending || !keyName.trim()}
              >
                {t('createKey')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={revokeId !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('revokeTitle')}</DialogTitle>
            <DialogDescription>
              {t('revokeDescription', {
                name: revoking?.name ?? t('unnamedKey'),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              {t('keepKey')}
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={revokeSelected}
            >
              {t('revokeKey')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
