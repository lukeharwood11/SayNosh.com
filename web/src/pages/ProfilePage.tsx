import { useState, useEffect } from 'react'
import { MdLogout, MdPerson, MdEmail } from 'react-icons/md'
import { useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { UserAvatar } from '@/components/ui/avatar'
import { usePostHog } from '@posthog/react'
import { useAuth } from '@/hooks/use-auth'
import { canEditProfileDisplayName, getProfileDisplayName } from '@/lib/user-profile'

export function ProfilePage() {
  const posthog = usePostHog()
  const { user, signOut, updateDisplayName } = useAuth()
  const navigate = useNavigate()

  const resolvedName = getProfileDisplayName(user)
  const editable = canEditProfileDisplayName(user)
  const email = user?.email ?? ''

  const [nameDraft, setNameDraft] = useState(resolvedName)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveOk, setSaveOk] = useState(false)

  useEffect(() => {
    setNameDraft(resolvedName)
  }, [resolvedName])

  const handleSaveName = async () => {
    setSaveError('')
    setSaveOk(false)
    const trimmed = nameDraft.trim()
    if (!trimmed) {
      setSaveError('Name is required')
      return
    }
    setSaving(true)
    const { error } = await updateDisplayName(trimmed)
    setSaving(false)
    if (error) {
      setSaveError(error.message ?? 'Could not update name')
      return
    }
    setSaveOk(true)
    setTimeout(() => setSaveOk(false), 2000)
  }

  const handleSignOut = async () => {
    posthog?.capture('signed_out')
    await signOut()
    navigate('/auth')
  }

  return (
    <div className="flex flex-1 flex-col">
      <Header title="Profile" />

      <div className="flex flex-1 flex-col items-center gap-6 p-5 pt-8">
        <UserAvatar name={resolvedName || 'User'} size="lg" className="h-20 w-20 text-2xl" />
        <div className="text-center">
          <h2 className="text-xl font-medium">{resolvedName || 'User'}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{email}</p>
        </div>

        <Card className="w-full">
          <CardContent className="divide-y p-0">
            <div className="flex flex-col gap-3 px-4 py-4">
              <div className="flex items-center gap-3">
                <MdPerson className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Display name</p>
                  {editable ? (
                    <>
                      <Input
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        className="mt-1.5"
                        maxLength={80}
                        autoComplete="nickname"
                      />
                      {saveError && (
                        <p className="mt-2 text-xs text-destructive">{saveError}</p>
                      )}
                      {saveOk && (
                        <p className="mt-2 text-xs text-nosh-yes">Saved</p>
                      )}
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-2"
                        disabled={saving || nameDraft.trim() === resolvedName}
                        onClick={handleSaveName}
                      >
                        {saving ? 'Saving...' : 'Save name'}
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium">{resolvedName || '—'}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Name comes from your Google account. Change it in your Google profile if needed.
                      </p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 px-0 pb-0 pt-1">
                <MdEmail className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{email}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-auto w-full pb-4">
          <Button
            variant="outline"
            className="w-full gap-2 text-destructive hover:bg-destructive/5 hover:text-destructive"
            onClick={handleSignOut}
          >
            <MdLogout className="h-5 w-5" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}
