import Link from 'next/link';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@foundation/ui';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted">
      <div className="container mx-auto py-16 px-4">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-4">
            Foundation Dev
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Production-ready MVP framework. Define your product in YAML, generate working code.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Spec is the Product</CardTitle>
              <CardDescription>
                Define entities, actions, flows, and policies in simple YAML
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your spec files are the source of truth. Generated code is deterministic output.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Full Stack Generated</CardTitle>
              <CardDescription>
                Database, API, SDK, UI - all from your spec
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Run <code className="bg-muted px-1 rounded">fd generate</code> to create working code.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Production Ready</CardTitle>
              <CardDescription>
                Multi-tenancy, audit logs, rate limits, AI safety
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Built for scale from day one. Enterprise features included.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-16">
          <p className="text-muted-foreground mb-4">
            Run <code className="bg-muted px-2 py-1 rounded">fd generate</code> to generate your UI
          </p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" asChild>
              <Link href="/docs">Documentation</Link>
            </Button>
            <Button asChild>
              <Link href="/flow/documents">Get Started</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
