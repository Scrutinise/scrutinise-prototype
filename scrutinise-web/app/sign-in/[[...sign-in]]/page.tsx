import { SignIn } from '@clerk/nextjs'

interface Props {
  searchParams: Promise<{ redirect_url?: string }>
}

export default async function SignInPage({ searchParams }: Props) {
  const { redirect_url } = await searchParams
  const afterSignInUrl =
    !redirect_url || redirect_url === '/ideas/create' ? '/dashboard' : redirect_url

  return (
    <div className="min-h-screen flex items-center justify-center bg-[--background] px-4">
      <SignIn forceRedirectUrl={afterSignInUrl} />
    </div>
  )
}
