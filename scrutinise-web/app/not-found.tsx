import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="mb-2 text-sm font-medium uppercase tracking-widest text-muted-foreground">
        404
      </p>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mb-6 text-muted-foreground">
        The page you are looking for does not exist or has been moved.
      </p>
      <Button asChild>
        <Link href="/">Go home</Link>
      </Button>
    </div>
  )
}
