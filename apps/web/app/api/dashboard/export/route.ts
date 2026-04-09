import { NextRequest, NextResponse } from 'next/server';

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

function escapeCsv(value: unknown) {
  const raw = value == null ? '' : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

function buildCsv(rows: Array<{ key: string; value: unknown }>) {
  const header = 'key,value';
  const body = rows.map((row) => `${escapeCsv(row.key)},${escapeCsv(row.value)}`).join('\n');
  return `${header}\n${body}`;
}

function buildSimplePdf(lines: string[]) {
  const sanitized = lines
    .map((line) => line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'))
    .map((line) => `(${line}) Tj`)
    .join(' T* ');

  const stream = `BT /F1 10 Tf 50 780 Td ${sanitized} ET`;
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
  ];

  let body = '';
  const offsets: number[] = [];
  for (const object of objects) {
    offsets.push(body.length);
    body += `${object}\n`;
  }

  const xrefStart = `%PDF-1.4\n${body}`.length;
  const xrefEntries = ['0000000000 65535 f ']
    .concat(offsets.map((offset) => `${String(offset + 9).padStart(10, '0')} 00000 n `))
    .join('\n');

  const trailer = `xref\n0 ${objects.length + 1}\n${xrefEntries}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(`%PDF-1.4\n${body}${trailer}`, 'utf-8');
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const format = (searchParams.get('format') ?? 'csv').toLowerCase();

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const summaryQuery = new URLSearchParams({ organizationId });
    if (startDate) summaryQuery.set('startDate', startDate);
    if (endDate) summaryQuery.set('endDate', endDate);

    const response = await fetch(
      `${getApiBaseUrl()}/analytics/executive-summary?${summaryQuery.toString()}`,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(request.headers.get('authorization')
            ? { Authorization: request.headers.get('authorization') as string }
            : {}),
        },
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch executive summary from backend' },
        { status: response.status },
      );
    }

    const summary = (await response.json()) as {
      organizationId: string;
      range: { startDate: string; endDate: string };
      kpis: {
        revenue: number;
        revenueGrowthRate: number;
        cac: number;
        ltv: number;
        ltvToCacRatio: number;
        churnRate: number;
        activeCustomers: number;
        pipelineValue: number;
      };
      topRecommendation: string;
      confidence?: { score?: number };
    };

    const csvRows: Array<{ key: string; value: unknown }> = [
      { key: 'organizationId', value: summary.organizationId },
      { key: 'range.startDate', value: summary.range.startDate },
      { key: 'range.endDate', value: summary.range.endDate },
      { key: 'kpis.revenue', value: summary.kpis.revenue },
      { key: 'kpis.revenueGrowthRate', value: summary.kpis.revenueGrowthRate },
      { key: 'kpis.cac', value: summary.kpis.cac },
      { key: 'kpis.ltv', value: summary.kpis.ltv },
      { key: 'kpis.ltvToCacRatio', value: summary.kpis.ltvToCacRatio },
      { key: 'kpis.churnRate', value: summary.kpis.churnRate },
      { key: 'kpis.activeCustomers', value: summary.kpis.activeCustomers },
      { key: 'kpis.pipelineValue', value: summary.kpis.pipelineValue },
      { key: 'topRecommendation', value: summary.topRecommendation },
      { key: 'confidence.score', value: summary.confidence?.score ?? '' },
    ];

    if (format === 'pdf') {
      const lines = csvRows.map((row) => `${row.key}: ${String(row.value ?? '')}`);
      const pdf = buildSimplePdf(['Dashboard Snapshot Export', ...lines]);
      const filename = `dashboard-export-${organizationId}-${new Date().toISOString().slice(0, 10)}.pdf`;

      return new NextResponse(pdf, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const csv = buildCsv(csvRows);
    const filename = `dashboard-export-${organizationId}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to export dashboard data' },
      { status: 500 },
    );
  }
}
