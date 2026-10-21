import { NextRequest, NextResponse } from 'next/server'

import { auth } from '@/auth'
import { requireAdmin } from '@/lib/access'
import { getVatReport } from '@/lib/reports/vat'

function csvCell(value: string | number | undefined) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

export async function GET(req: NextRequest) {
  try {
    requireAdmin(await auth())
  } catch {
    return NextResponse.json({ error: 'Admin permission required' }, { status: 403 })
  }

  const from = req.nextUrl.searchParams.get('from') ?? undefined
  const to = req.nextUrl.searchParams.get('to') ?? undefined
  const { rows } = await getVatReport({ from, to })

  const header = [
    'number',
    'type',
    'reason',
    'issued_at',
    'order_id',
    'currency',
    'net',
    'vat',
    'gross',
  ]

  const lines = [
    header.join(','),
    ...rows.map((row) =>
      [
        row.number,
        row.type,
        row.reason ?? '',
        row.issuedAt.toISOString(),
        row.orderId,
        row.currency,
        row.net.toFixed(2),
        row.vat.toFixed(2),
        row.gross.toFixed(2),
      ]
        .map(csvCell)
        .join(',')
    ),
  ]

  const filenameFrom = (from ?? 'all').replace(/[^0-9-]/g, '')
  const filenameTo = (to ?? 'all').replace(/[^0-9-]/g, '')

  return new NextResponse(`\uFEFF${lines.join('\n')}\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="vat-report-${filenameFrom}-${filenameTo}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
