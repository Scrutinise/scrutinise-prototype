import type { Metadata } from 'next'
import LegislationCompareClient from './LegislationCompareClient'

export const metadata: Metadata = {
  title: 'Legislation Compiler — AI Evaluation | Scrutinise',
  description: 'Compare AI-compiled UK legislation against the National Archives gold standard. Free, open tool.',
}

export default function LegislationComparePage() {
  return <LegislationCompareClient />
}
