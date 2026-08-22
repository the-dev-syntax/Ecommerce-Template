'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X, Cookie, ChevronDown, ChevronUp, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ConsentState = {
  necessary: true
  analytics: boolean
  marketing: boolean
  preferences: boolean
}

const CONSENT_KEY = 'ev-cookie-consent'
const CONSENT_VERSION = '1.0'

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [consent, setConsent] = useState<ConsentState>({
    necessary: true,
    analytics: false,
    marketing: false,
    preferences: false,
  })

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.version === CONSENT_VERSION) return
      }
    } catch {}
    const t = setTimeout(() => setVisible(true), 800)
    return () => clearTimeout(t)
  }, [])

  const saveConsent = (state: ConsentState) => {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ ...state, version: CONSENT_VERSION, timestamp: new Date().toISOString() })
    )
    setVisible(false)
  }

  const acceptAll = () =>
    saveConsent({ necessary: true, analytics: true, marketing: true, preferences: true })

  const rejectAll = () =>
    saveConsent({ necessary: true, analytics: false, marketing: false, preferences: false })

  const saveCustom = () => saveConsent(consent)

  if (!visible) return null

  

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-[9999] p-4 md:p-6"
    >
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm md:hidden" />
      <div className="relative max-w-4xl mx-auto rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-500" />
        <div className="p-5 md:p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="mt-0.5 flex-shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-900/40 p-2">
              <Cookie className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-base md:text-lg leading-tight">
                We value your privacy
              </h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                We use cookies to enhance your browsing experience, analyse site traffic, and
                personalise content. By clicking <strong>Accept All</strong>, you consent to our
                use of cookies. Read our{' '}
                <Link href="/page/privacy-policy" className="underline underline-offset-2 hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>{' '}
                and{' '}
                <Link href="/page/conditions-of-use" className="underline underline-offset-2 hover:text-foreground transition-colors">
                  Terms of Use
                </Link>
                .
              </p>
            </div>
            <button
              onClick={rejectAll}
              className="flex-shrink-0 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Close and reject optional cookies"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={() => setShowDetails((p) => !p)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            aria-expanded={showDetails}
          >
            {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {showDetails ? 'Hide' : 'Customise'} cookie preferences
          </button>

          {showDetails && (
            <div className="rounded-xl border border-border bg-muted/40 p-4 mb-4 space-y-3">
              <CookieToggle
                id="necessary"
                label="Strictly Necessary"
                description="Required for the site to function. Cannot be disabled."
                checked={true}
                disabled
              />
              <CookieToggle
                id="analytics"
                label="Analytics & Performance"
                description="Help us understand how visitors interact with the site."
                checked={consent.analytics}
                onChange={(v) => setConsent((p) => ({ ...p, analytics: v }))}
              />
              <CookieToggle
                id="marketing"
                label="Marketing & Advertising"
                description="Used to deliver personalised advertisements relevant to you."
                checked={consent.marketing}
                onChange={(v) => setConsent((p) => ({ ...p, marketing: v }))}
              />
              <CookieToggle
                id="preferences"
                label="Preferences & Functionality"
                description="Remember your settings such as language, currency, and theme."
                checked={consent.preferences}
                onChange={(v) => setConsent((p) => ({ ...p, preferences: v }))}
              />
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
            <Shield className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              You may withdraw consent at any time via your browser settings. California residents:{' '}
              <Link href="/page/privacy-policy#ccpa" className="underline hover:text-foreground">
                CCPA rights
              </Link>
              .
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={rejectAll} className="sm:w-auto w-full rounded-full">
              Reject Non-Essential
            </Button>
            {showDetails && (
              <Button variant="outline" size="sm" onClick={saveCustom} className="sm:w-auto w-full rounded-full">
                Save My Choices
              </Button>
            )}
            <Button
              size="sm"
              onClick={acceptAll}
              className="sm:w-auto w-full rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Accept All
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CookieToggle({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange?: (v: boolean) => void
}) {
  const labelId = `cookie-toggle-label-${id}`
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p id={labelId} className="text-sm font-medium leading-tight">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId} 
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange?.(!checked)}
        className={`relative flex-shrink-0 mt-0.5 h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
          disabled
            ? 'bg-emerald-500 cursor-not-allowed opacity-70'
            : checked
            ? 'bg-emerald-500 cursor-pointer'
            : 'bg-muted-foreground/30 cursor-pointer'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
