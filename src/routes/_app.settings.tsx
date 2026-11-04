import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  Link,
  createFileRoute,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { cn } from 'cn'
import { IncomeSourcesCard } from '@/components/income-sources-card'
import { ManagedListsCard } from '@/components/managed-lists-card'
import { PasskeyCard } from '@/components/passkey-card'
import { TwoFactorCard } from '@/components/two-factor-card'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Tabs,
  TabsList,
  TabsPanel,
  TabsPanels,
  TabsTab,
} from '@/components/ui/coss-tabs'
import { getMySettings, updateMySettings } from '@/lib/app.functions'
import { getSession } from '@/lib/auth.functions'
import { fromMajorUnits, toMajorUnits } from '@/lib/money'
import type { Settings, Theme, WeekStart } from '@/server/services/settings'

const LOCALES = [
  'en',
  'da',
  'de',
  'sv',
  'nb',
  'fi',
  'nl',
  'fr',
  'es',
  'it',
  'pl',
  'zh',
  'fo',
  'uk',
]

/** Own-language names, so the list reads the same wherever you are. */
const ENDONYMS: Record<string, string> = {
  en: 'English',
  da: 'Dansk',
  de: 'Deutsch',
  sv: 'Svenska',
  nb: 'Norsk bokmål',
  fi: 'Suomi',
  nl: 'Nederlands',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  pl: 'Polski',
  zh: '简体中文',
  fo: 'Føroyskt',
  uk: 'Українська',
}
const THEMES = ['light', 'dark', 'system'] as const
const WEEK_STARTS = ['monday', 'sunday'] as const

const SECTIONS = [
  'preferences',
  'budget',
  'reminders',
  'lists',
  'security',
] as const
type Section = (typeof SECTIONS)[number]

const SECTION_LABEL_KEYS = {
  preferences: 'tabPreferences',
  budget: 'tabBudget',
  reminders: 'tabReminders',
  lists: 'tabLists',
  security: 'tabSecurity',
} as const

const SECTION_LEAD_KEYS = {
  preferences: 'preferencesLead',
  budget: 'budgetLead',
  reminders: 'remindersLead',
  lists: 'listsLead',
  security: 'securityLead',
} as const

const THEME_LABEL_KEYS = {
  light: 'themeLight',
  dark: 'themeDark',
  system: 'themeSystem',
} as const

const WEEK_LABEL_KEYS = {
  monday: 'weekMonday',
  sunday: 'weekSunday',
} as const

export const Route = createFileRoute('/_app/settings')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/sign-in' })
    }
    return { user: session.user }
  },
  loader: async () => ({ settings: await getMySettings() }),
  component: SettingsPage,
})

export function applyTheme(theme: string) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  try {
    localStorage.setItem('frist-theme', theme)
  } catch {
    // private mode: the theme still applies for this session
  }
}

function SettingsPage() {
  const { settings } = Route.useLoaderData()
  const router = useRouter()
  const t = useTranslations('settings')
  const [section, setSection] = useState<Section>('preferences')
  const [form, setForm] = useState(() => formFrom(settings))
  const [baseline, setBaseline] = useState(() => formFrom(settings))
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)
  const savedTimer = useRef<number | null>(null)

  const dirty = (Object.keys(form) as Array<keyof typeof form>).some(
    (key) => form[key] !== baseline[key],
  )

  const localeOptions = [...new Set([settings.locale, ...LOCALES])].map(
    (code) => ({ value: code, label: ENDONYMS[code] ?? code }),
  )
  const themeOptions = THEMES.map((theme) => ({
    value: theme,
    label: t(THEME_LABEL_KEYS[theme]),
  }))
  const weekOptions = WEEK_STARTS.map((day) => ({
    value: day,
    label: t(WEEK_LABEL_KEYS[day]),
  }))

  function change(key: keyof typeof form, value: string) {
    setError(null)
    setForm((current) => ({ ...current, [key]: value }))
    if (key === 'theme') {
      applyTheme(value)
    }
  }

  /**
   * Everything saves on its own (shortly after you stop typing), so there is
   * no save button to hunt for. Validation mirrors the server's schema, and
   * the error stays up until the next edit.
   */
  const save = useCallback(
    async (next: ReturnType<typeof formFrom>) => {
      const currency = next.currency.trim().toUpperCase() || settings.currency
      if (!/^[A-Z]{3}$/.test(currency)) {
        setError(t('errCurrency'))
        return
      }
      const budgetAmount = Number(next.budget.replace(',', '.'))
      if (
        next.budget.trim() !== '' &&
        (!Number.isFinite(budgetAmount) || budgetAmount < 0)
      ) {
        setError(t('errBudget'))
        return
      }
      const anchorDay = next.anchor.trim() === '' ? null : Number(next.anchor)
      if (
        anchorDay !== null &&
        (!Number.isInteger(anchorDay) || anchorDay < 1 || anchorDay > 31)
      ) {
        setError(t('errAnchor'))
        return
      }
      const remindDays =
        next.remindDays.trim() === '' ? null : Number(next.remindDays)
      if (
        remindDays !== null &&
        (!Number.isInteger(remindDays) || remindDays < 0 || remindDays > 60)
      ) {
        setError(t('errRemind'))
        return
      }

      const normalized = { ...next, currency }
      setStatus('saving')
      try {
        await updateMySettings({
          data: {
            currency,
            locale: next.locale,
            weekStart: next.weekStart as WeekStart,
            theme: next.theme as Theme,
            budgetAmountMinor:
              next.budget.trim() === ''
                ? null
                : fromMajorUnits(budgetAmount, currency),
            payAnchorDay: anchorDay,
            payAnchorShiftWeekends: next.anchorWeekend === 'on',
            remindDaysBefore: remindDays,
            remindersEnabled: next.remindEnabled === 'on',
          },
        })
        applyTheme(normalized.theme)
        // Reflect fallbacks (an emptied currency snaps back) without stomping
        // edits made while the save was in flight.
        setForm((current) => ({ ...current, currency: normalized.currency }))
        setBaseline(normalized)
        setStatus('saved')
        if (savedTimer.current !== null) {
          window.clearTimeout(savedTimer.current)
        }
        savedTimer.current = window.setTimeout(() => setStatus('idle'), 1800)
        void router.invalidate()
      } catch (caught) {
        setStatus('idle')
        setError(caught instanceof Error ? caught.message : t('errSave'))
      }
    },
    [router, settings.currency, t],
  )

  useEffect(() => {
    if (!dirty) return
    const id = window.setTimeout(() => void save(form), 650)
    return () => window.clearTimeout(id)
  }, [dirty, form, save])

  useEffect(() => {
    return () => {
      if (savedTimer.current !== null) {
        window.clearTimeout(savedTimer.current)
      }
    }
  }, [])

  return (
    <div className="min-h-full">
      <main className="flex w-full flex-col gap-6 px-6 py-8">
        <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h1 className="font-heading text-lg font-medium">{t('title')}</h1>
          <SaveStatus state={status} error={error} />
        </header>

        <Tabs
          value={section}
          onValueChange={(value) => setSection(value as Section)}
          className="gap-6"
        >
          <TabsList
            variant="square"
            className="w-auto -mx-6 px-6 max-sm:overflow-x-auto"
          >
            {SECTIONS.map((id) => (
              <TabsTab key={id} value={id} className="sm:basis-0">
                {t(SECTION_LABEL_KEYS[id])}
              </TabsTab>
            ))}
          </TabsList>

          <TabsPanels>
            <TabsPanel value="preferences" className="flex flex-col gap-5">
              <SectionLead section="preferences" />
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="settings-currency">
                      {t('currency')}
                    </FieldLabel>
                    <Input
                      id="settings-currency"
                      value={form.currency}
                      onChange={(event) =>
                        change('currency', event.target.value.toUpperCase())
                      }
                      maxLength={3}
                    />
                    <FieldDescription>{t('currencyHelp')}</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel>{t('language')}</FieldLabel>
                    <Select
                      value={form.locale}
                      items={localeOptions}
                      onValueChange={(value) => change('locale', String(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {localeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>{t('languageHelp')}</FieldDescription>
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>{t('weekStart')}</FieldLabel>
                    <Select
                      value={form.weekStart}
                      items={weekOptions}
                      onValueChange={(value) =>
                        change('weekStart', String(value))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {weekOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>{t('theme')}</FieldLabel>
                    <Select
                      value={form.theme}
                      items={themeOptions}
                      onValueChange={(value) => change('theme', String(value))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {themeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </FieldGroup>
            </TabsPanel>

            <TabsPanel value="budget" className="flex flex-col gap-5">
              <SectionLead section="budget" />
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="settings-budget">
                      {t('budget', { currency: form.currency })}
                    </FieldLabel>
                    <Input
                      id="settings-budget"
                      value={form.budget}
                      onChange={(event) => change('budget', event.target.value)}
                      inputMode="decimal"
                      placeholder={t('budgetPlaceholder')}
                    />
                    <FieldDescription>{t('budgetHelp')}</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="settings-anchor">
                      {t('anchor')}
                    </FieldLabel>
                    <Input
                      id="settings-anchor"
                      value={form.anchor}
                      onChange={(event) => change('anchor', event.target.value)}
                      inputMode="numeric"
                      placeholder={t('anchorPlaceholder')}
                    />
                  </Field>
                </div>
                {form.anchor.trim() !== '' && (
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldLabel htmlFor="settings-anchor-weekend">
                        {t('anchorWeekend')}
                      </FieldLabel>
                      <FieldDescription>
                        {t('anchorWeekendHelp')}
                      </FieldDescription>
                    </FieldContent>
                    <Switch
                      id="settings-anchor-weekend"
                      checked={form.anchorWeekend === 'on'}
                      onCheckedChange={(checked) =>
                        change('anchorWeekend', checked ? 'on' : 'off')
                      }
                    />
                  </Field>
                )}
                <AnchorNote />
              </FieldGroup>
              <IncomeSourcesCard
                currency={settings.currency}
                locale={settings.locale}
              />
            </TabsPanel>

            <TabsPanel value="reminders" className="flex flex-col gap-5">
              <SectionLead section="reminders" />
              <Field orientation="horizontal">
                <Switch
                  checked={form.remindEnabled === 'on'}
                  onCheckedChange={(checked) =>
                    change('remindEnabled', checked ? 'on' : 'off')
                  }
                />
                <FieldLabel>{t('remindSwitch')}</FieldLabel>
              </Field>
              <Field>
                <FieldLabel htmlFor="settings-remind">
                  {t('remindDays')}
                </FieldLabel>
                <Input
                  id="settings-remind"
                  value={form.remindDays}
                  onChange={(event) => change('remindDays', event.target.value)}
                  inputMode="numeric"
                  placeholder={t('remindPlaceholder')}
                  className="max-w-40"
                />
                <FieldDescription>{t('remindHelp')}</FieldDescription>
              </Field>
            </TabsPanel>

            <TabsPanel value="lists" className="flex flex-col gap-5">
              <SectionLead section="lists" />
              <ManagedListsCard />
            </TabsPanel>

            <TabsPanel value="security" className="flex flex-col gap-5">
              <SectionLead section="security" />
              <div className="flex flex-col gap-4">
                <PasskeyCard />
                <TwoFactorCard />
              </div>
            </TabsPanel>
          </TabsPanels>
        </Tabs>

        <p className="text-sm text-muted-foreground">
          {t('adminPrefix')}{' '}
          <Link
            to="/admin"
            className="underline underline-offset-4 hover:text-foreground"
          >
            {t('adminLink')}
          </Link>
          .
        </p>
      </main>
    </div>
  )
}

function SectionLead({ section }: { section: Section }) {
  const t = useTranslations('settings')
  return (
    <p className="text-sm text-muted-foreground">
      {t(SECTION_LEAD_KEYS[section])}
    </p>
  )
}

function SaveStatus({
  state,
  error,
}: {
  state: 'idle' | 'saving' | 'saved'
  error: string | null
}) {
  const t = useTranslations('settings')
  return (
    <div className="flex items-center gap-2" aria-live="polite">
      {error !== null ? (
        <span role="alert" className="text-sm text-destructive">
          {error}
        </span>
      ) : (
        <span
          className={cn(
            'flex items-center gap-1 text-sm text-muted-foreground transition-opacity duration-200 ease-out',
            state === 'idle' && 'opacity-0',
          )}
        >
          {state === 'saving' ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              {t('saving')}
            </>
          ) : (
            <>
              <Check className="size-3.5" />
              {t('saved')}
            </>
          )}
        </span>
      )}
    </div>
  )
}

/** The pay-day anchor explanation, folded away until asked for. */
function AnchorNote({ className }: { className?: string }) {
  const t = useTranslations('settings')
  const [open, setOpen] = useState(false)
  const id = useId()

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={id}
        className="inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {t('anchorNote')}
        <ChevronDown
          className={cn(
            'size-4 transition-transform duration-200 ease-out',
            open && 'rotate-180',
          )}
        />
      </button>
      <div
        id={id}
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <p className="pt-2 text-sm leading-relaxed text-muted-foreground">
            {t('anchorBody')}
          </p>
        </div>
      </div>
    </div>
  )
}

function formFrom(settings: Settings) {
  return {
    currency: settings.currency,
    locale: settings.locale,
    weekStart: String(settings.weekStart),
    theme: String(settings.theme),
    budget:
      settings.budgetAmountMinor === null
        ? ''
        : String(toMajorUnits(settings.budgetAmountMinor, settings.currency)),
    anchor: settings.payAnchorDay === null ? '' : String(settings.payAnchorDay),
    anchorWeekend: settings.payAnchorShiftWeekends ? 'on' : 'off',
    remindDays: String(settings.remindDaysBefore),
    remindEnabled: settings.remindersEnabled ? 'on' : 'off',
  }
}
