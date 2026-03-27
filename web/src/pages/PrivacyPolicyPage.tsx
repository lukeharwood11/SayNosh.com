import { Link } from 'react-router-dom'

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-svh bg-background px-5 pb-10 pt-[calc(var(--safe-area-top)+1.5rem)] md:px-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: March 25, 2026</p>

        <section className="space-y-2 text-sm">
          <h2 className="text-base font-medium">What we collect</h2>
          <p className="text-muted-foreground">
            We collect account information (like email and display name), session activity (such as swipes and matches), and basic technical data needed to run and secure nosh.
          </p>
          <p className="text-muted-foreground">
            We use PostHog to understand how the product is used (for example page views, taps, and errors). PostHog may receive device and usage data associated with an anonymous or signed-in identifier. You can read more in{' '}
            <a
              href="https://posthog.com/privacy"
              className="text-primary underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              PostHog&apos;s privacy policy
            </a>
            .
          </p>
        </section>

        <section className="space-y-2 text-sm">
          <h2 className="text-base font-medium">How we use data</h2>
          <p className="text-muted-foreground">
            We use your data to provide the product, personalize your experience, prevent abuse, and improve the service.
          </p>
        </section>

        <section className="space-y-2 text-sm">
          <h2 className="text-base font-medium">Sharing</h2>
          <p className="text-muted-foreground">
            We do not sell personal information. Data may be shared with trusted infrastructure providers strictly to operate nosh, including analytics services such as PostHog as described above.
          </p>
        </section>

        <section className="space-y-2 text-sm">
          <h2 className="text-base font-medium">Your choices</h2>
          <p className="text-muted-foreground">
            You can update your profile details in-app and request account deletion by contacting support.
          </p>
        </section>

        <div className="pt-4 text-sm text-muted-foreground">
          <Link to="/" className="text-primary underline underline-offset-2">Back to home</Link>
        </div>
      </div>
    </div>
  )
}
