import type { Metadata } from 'next'
import LegislationBrowseClient from './LegislationBrowseClient'

export const metadata: Metadata = {
  title: 'Legislation | Scrutinise',
  description: 'Browse AI-compiled UK legislation. Search Acts and Statutory Instruments compiled against the National Archives.',
}

export default function LegislationPage() {
  return <LegislationBrowseClient />
}
