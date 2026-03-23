import { SignIn } from '@clerk/nextjs'

interface Props {
  searchParams: Promise<{ redirect_url?: string }>
}

export default async function SignInPage({ searchParams }: Props) {
  const { redirect_url } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-[--background] px-4">
      <SignIn forceRedirectUrl={redirect_url} />
    </div>
  )
}
