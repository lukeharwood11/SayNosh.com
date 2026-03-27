import { Link } from 'react-router-dom'

export function TermsOfServicePage() {
  return (
    <div className="min-h-svh bg-background px-5 pb-10 pt-[calc(var(--safe-area-top)+1.5rem)] md:px-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated: March 25, 2026</p>

        <section className="space-y-2 text-sm">
          <h2 className="text-base font-medium">Using nosh</h2>
          <p className="text-muted-foreground">
            You agree to use nosh lawfully and respectfully. You are responsible for activity under your account.
          </p>
        </section>

        <section className="space-y-2 text-sm">
          <h2 className="text-base font-medium">Accounts</h2>
          <p className="text-muted-foreground">
            Keep your sign-in credentials secure. We may suspend accounts that violate these terms or abuse the service.
          </p>
        </section>

        <section className="space-y-2 text-sm">
          <h2 className="text-base font-medium">Service availability</h2>
          <p className="text-muted-foreground">
            We aim for reliable service but do not guarantee uninterrupted availability. Features may change over time.
          </p>
        </section>

        <section className="space-y-2 text-sm">
          <h2 className="text-base font-medium">Limitation of liability</h2>
          <p className="text-muted-foreground">
            nosh is provided "as is" to the fullest extent permitted by law. We are not liable for indirect or consequential damages.
          </p>
        </section>

        <div className="pt-4 text-sm text-muted-foreground">
          <Link to="/" className="text-primary underline underline-offset-2">Back to home</Link>
        </div>
      </div>
    </div>
  )
}
