import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import CreateIdeaClient from './CreateIdeaClient'

export default async function CreateIdeaPage() {
  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in?redirect_url=/ideas/create')
  }

  return <CreateIdeaClient />
}
