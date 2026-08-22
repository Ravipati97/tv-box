import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface BugReportInput {
  title: string
  description: string
  username?: string
  page?: string
  appVersion?: string
  userAgent?: string
}

export interface BugReportResult {
  url: string
  number: number
}

/** Files a GitHub issue via the report-bug Edge Function -- see
 * supabase/functions/report-bug/README.md for the one-time server setup
 * this needs. Until that's done, the function itself returns a clear
 * "not configured" error rather than a confusing generic failure. */
export async function submitBugReport(input: BugReportInput): Promise<BugReportResult> {
  const { data, error } = await supabase.functions.invoke('report-bug', { body: input })

  if (error) {
    let message = 'Failed to submit your report. Try again.'
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json()
        if (body?.error) message = body.error
      } catch {
        // Response body wasn't JSON -- keep the generic message.
      }
    }
    throw new Error(message)
  }

  return data as BugReportResult
}
