/**
 * 리포트 생성기 - JSON, Markdown, HTML 형식 지원
 */

import * as fs from 'node:fs';
import type { ProjectReport, RefactorItem, DimensionBreakdown } from './scanner.js';

export type ReportFormat = 'json' | 'markdown' | 'html';

/**
 * 리포트 생성 및 저장
 */
export function generateReportFile(
  report: ProjectReport,
  outputPath: string,
  format: ReportFormat
): string {
  let content: string;
  let extension: string;

  switch (format) {
    case 'json':
      content = generateJsonReport(report);
      extension = '.json';
      break;
    case 'markdown':
      content = generateMarkdownReport(report);
      extension = '.md';
      break;
    case 'html':
      content = generateHtmlReport(report);
      extension = '.html';
      break;
  }

  const finalPath = outputPath.endsWith(extension) ? outputPath : `${outputPath}${extension}`;
  fs.writeFileSync(finalPath, content, 'utf-8');
  return finalPath;
}

// ─────────────────────────────────────────────────────────────────
// JSON 리포트
// ─────────────────────────────────────────────────────────────────

function generateJsonReport(report: ProjectReport): string {
  // files에서 functions 상세 정보 제거 (크기 축소)
  const compactReport = {
    ...report,
    files: report.files.map((f) => ({
      filePath: f.relativePath,
      functionCount: f.functionCount,
      totalMcCabe: f.totalMcCabe,
      totalDimensional: Math.round(f.totalDimensional * 10) / 10,
    })),
  };
  return JSON.stringify(compactReport, null, 2);
}

// ─────────────────────────────────────────────────────────────────
// Markdown 리포트
// ─────────────────────────────────────────────────────────────────

function generateMarkdownReport(report: ProjectReport): string {
  const lines: string[] = [];

  // 헤더
  lines.push(`# Complexity Analysis Report`);
  lines.push('');
  lines.push(`**Project:** ${report.projectName}`);
  lines.push(`**Scan Date:** ${new Date(report.scanDate).toLocaleString()}`);
  lines.push(`**Path:** \`${report.projectPath}\``);
  lines.push('');

  // 요약
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total Files | ${report.summary.totalFiles} |`);
  lines.push(`| Total Functions | ${report.summary.totalFunctions} |`);
  lines.push(`| Average McCabe | ${report.summary.averageMcCabe} |`);
  lines.push(`| Average Dimensional | ${report.summary.averageDimensional} |`);
  lines.push(`| Average Ratio | ${report.summary.averageRatio}x |`);
  lines.push(`| High-Risk Functions | ${report.summary.functionsAboveThreshold} |`);
  lines.push('');

  // 차원별 분석
  lines.push('## Dimension Breakdown');
  lines.push('');
  lines.push('| Dimension | Total | Average | Max |');
  lines.push('|-----------|-------|---------|-----|');
  lines.push(`| 1D Control | ${report.dimensionBreakdown.control.total} | ${report.dimensionBreakdown.control.average} | ${report.dimensionBreakdown.control.max} |`);
  lines.push(`| 2D Nesting | ${report.dimensionBreakdown.nesting.total} | ${report.dimensionBreakdown.nesting.average} | ${report.dimensionBreakdown.nesting.max} |`);
  lines.push(`| 3D State | ${report.dimensionBreakdown.state.total} | ${report.dimensionBreakdown.state.average} | ${report.dimensionBreakdown.state.max} |`);
  lines.push(`| 4D Async | ${report.dimensionBreakdown.async.total} | ${report.dimensionBreakdown.async.average} | ${report.dimensionBreakdown.async.max} |`);
  lines.push(`| 5D Coupling | ${report.dimensionBreakdown.coupling.total} | ${report.dimensionBreakdown.coupling.average} | ${report.dimensionBreakdown.coupling.max} |`);
  lines.push('');

  // 핫스팟
  lines.push('## Hotspots (Top 20)');
  lines.push('');
  if (report.hotspots.length > 0) {
    lines.push('| Function | File | McCabe | Dimensional | Ratio | Primary |');
    lines.push('|----------|------|--------|-------------|-------|---------|');
    for (const h of report.hotspots) {
      lines.push(`| ${h.function} | ${h.file}:${h.line} | ${h.mccabe} | ${h.dimensional} | ${h.ratio}x | ${h.primaryDimension} |`);
    }
  } else {
    lines.push('No significant hotspots found.');
  }
  lines.push('');

  // 리팩토링 우선순위
  lines.push('## Refactoring Priority');
  lines.push('');
  const critical = report.refactorPriority.filter((r) => r.priority === 'critical');
  const high = report.refactorPriority.filter((r) => r.priority === 'high');
  const medium = report.refactorPriority.filter((r) => r.priority === 'medium');

  if (critical.length > 0) {
    lines.push('### Critical');
    lines.push('');
    for (const r of critical) {
      lines.push(`- **${r.function}** @ \`${r.file}:${r.line}\``);
      lines.push(`  - Reason: ${r.reason}`);
      lines.push(`  - Suggestion: ${r.suggestion}`);
    }
    lines.push('');
  }

  if (high.length > 0) {
    lines.push('### High');
    lines.push('');
    for (const r of high) {
      lines.push(`- **${r.function}** @ \`${r.file}:${r.line}\``);
      lines.push(`  - Reason: ${r.reason}`);
      lines.push(`  - Suggestion: ${r.suggestion}`);
    }
    lines.push('');
  }

  if (medium.length > 0) {
    lines.push('### Medium');
    lines.push('');
    for (const r of medium.slice(0, 10)) {
      lines.push(`- **${r.function}** @ \`${r.file}:${r.line}\``);
      lines.push(`  - Reason: ${r.reason}`);
    }
    lines.push('');
  }

  // 파일별 요약
  lines.push('## Files Summary');
  lines.push('');
  const sortedFiles = [...report.files].sort((a, b) => b.totalDimensional - a.totalDimensional);
  lines.push('| File | Functions | McCabe | Dimensional |');
  lines.push('|------|-----------|--------|-------------|');
  for (const f of sortedFiles.slice(0, 30)) {
    lines.push(`| ${f.relativePath} | ${f.functionCount} | ${f.totalMcCabe} | ${Math.round(f.totalDimensional * 10) / 10} |`);
  }
  lines.push('');

  // 푸터
  lines.push('---');
  lines.push('');
  lines.push('*Generated by semantic-complexity-cli*');

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────
// HTML 리포트
// ─────────────────────────────────────────────────────────────────

function generateHtmlReport(report: ProjectReport): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Complexity Report - ${report.projectName}</title>
  <style>
    :root {
      --bg: #0d1117;
      --fg: #c9d1d9;
      --border: #30363d;
      --accent: #58a6ff;
      --success: #3fb950;
      --warning: #d29922;
      --danger: #f85149;
      --card-bg: #161b22;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--fg);
      line-height: 1.6;
      padding: 2rem;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { color: var(--accent); margin-bottom: 0.5rem; }
    h2 { color: var(--fg); margin: 2rem 0 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
    h3 { color: var(--warning); margin: 1.5rem 0 0.5rem; }
    .meta { color: #8b949e; margin-bottom: 2rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 1rem 0; }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
    }
    .card-title { font-size: 0.875rem; color: #8b949e; }
    .card-value { font-size: 2rem; font-weight: bold; color: var(--accent); }
    .card-sub { font-size: 0.75rem; color: #8b949e; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid var(--border); }
    th { background: var(--card-bg); color: #8b949e; font-weight: 500; }
    tr:hover { background: rgba(88, 166, 255, 0.1); }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .badge-critical { background: var(--danger); color: white; }
    .badge-high { background: var(--warning); color: black; }
    .badge-medium { background: #388bfd; color: white; }
    .badge-low { background: var(--success); color: white; }
    .bar-container { display: flex; gap: 2px; height: 20px; }
    .bar { height: 100%; min-width: 4px; }
    .bar-1d { background: #58a6ff; }
    .bar-2d { background: #a371f7; }
    .bar-3d { background: #3fb950; }
    .bar-4d { background: #d29922; }
    .bar-5d { background: #f85149; }
    .legend { display: flex; gap: 1rem; margin: 1rem 0; flex-wrap: wrap; }
    .legend-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
    .legend-color { width: 12px; height: 12px; border-radius: 2px; }
    .file-path { font-family: monospace; font-size: 0.875rem; }
    .issue-list { font-size: 0.75rem; color: #8b949e; }
    footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--border); color: #8b949e; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Complexity Analysis Report</h1>
    <p class="meta">
      <strong>${report.projectName}</strong> &bull;
      ${new Date(report.scanDate).toLocaleString()} &bull;
      <code>${report.projectPath}</code>
    </p>

    <h2>Summary</h2>
    <div class="grid">
      <div class="card">
        <div class="card-title">Total Files</div>
        <div class="card-value">${report.summary.totalFiles}</div>
      </div>
      <div class="card">
        <div class="card-title">Total Functions</div>
        <div class="card-value">${report.summary.totalFunctions}</div>
      </div>
      <div class="card">
        <div class="card-title">Avg McCabe</div>
        <div class="card-value">${report.summary.averageMcCabe}</div>
      </div>
      <div class="card">
        <div class="card-title">Avg Dimensional</div>
        <div class="card-value">${report.summary.averageDimensional}</div>
      </div>
      <div class="card">
        <div class="card-title">Avg Ratio</div>
        <div class="card-value">${report.summary.averageRatio}x</div>
        <div class="card-sub">Dimensional / McCabe</div>
      </div>
      <div class="card">
        <div class="card-title">High-Risk</div>
        <div class="card-value" style="color: var(--danger)">${report.summary.functionsAboveThreshold}</div>
        <div class="card-sub">Functions > 20</div>
      </div>
    </div>

    <h2>Dimension Breakdown</h2>
    <div class="legend">
      <div class="legend-item"><div class="legend-color bar-1d"></div> 1D Control</div>
      <div class="legend-item"><div class="legend-color bar-2d"></div> 2D Nesting</div>
      <div class="legend-item"><div class="legend-color bar-3d"></div> 3D State</div>
      <div class="legend-item"><div class="legend-color bar-4d"></div> 4D Async</div>
      <div class="legend-item"><div class="legend-color bar-5d"></div> 5D Coupling</div>
    </div>
    <table>
      <thead>
        <tr><th>Dimension</th><th>Total</th><th>Average</th><th>Max</th><th>Distribution</th></tr>
      </thead>
      <tbody>
        ${generateDimensionRows(report.dimensionBreakdown)}
      </tbody>
    </table>

    <h2>Hotspots (Top 20)</h2>
    <table>
      <thead>
        <tr><th>Function</th><th>File</th><th>McCabe</th><th>Dimensional</th><th>Ratio</th><th>Primary</th><th>Issues</th></tr>
      </thead>
      <tbody>
        ${report.hotspots.map((h) => `
          <tr>
            <td><strong>${escapeHtml(h.function)}</strong></td>
            <td class="file-path">${escapeHtml(h.file)}:${h.line}</td>
            <td>${h.mccabe}</td>
            <td>${h.dimensional}</td>
            <td>${h.ratio}x</td>
            <td><span class="badge badge-${getDimensionBadge(h.primaryDimension)}">${h.primaryDimension}</span></td>
            <td class="issue-list">${h.issues.join(', ') || '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <h2>Refactoring Priority</h2>
    ${generateRefactorSection(report.refactorPriority)}

    <h2>Files Summary</h2>
    <table>
      <thead>
        <tr><th>File</th><th>Functions</th><th>McCabe</th><th>Dimensional</th><th>Distribution</th></tr>
      </thead>
      <tbody>
        ${[...report.files]
          .sort((a, b) => b.totalDimensional - a.totalDimensional)
          .slice(0, 50)
          .map((f) => `
            <tr>
              <td class="file-path">${escapeHtml(f.relativePath)}</td>
              <td>${f.functionCount}</td>
              <td>${f.totalMcCabe}</td>
              <td>${Math.round(f.totalDimensional * 10) / 10}</td>
              <td>${generateFileBar(f)}</td>
            </tr>
          `).join('')}
      </tbody>
    </table>

    <footer>
      Generated by <strong>semantic-complexity-cli</strong> &bull; McCabe vs Dimensional Complexity Analysis
    </footer>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function generateDimensionRows(breakdown: DimensionBreakdown): string {
  const dims = [
    { name: '1D Control', data: breakdown.control, class: 'bar-1d' },
    { name: '2D Nesting', data: breakdown.nesting, class: 'bar-2d' },
    { name: '3D State', data: breakdown.state, class: 'bar-3d' },
    { name: '4D Async', data: breakdown.async, class: 'bar-4d' },
    { name: '5D Coupling', data: breakdown.coupling, class: 'bar-5d' },
  ];

  const maxTotal = Math.max(...dims.map((d) => d.data.total));

  return dims.map((d) => {
    const width = maxTotal > 0 ? (d.data.total / maxTotal) * 100 : 0;
    return `
      <tr>
        <td>${d.name}</td>
        <td>${d.data.total}</td>
        <td>${d.data.average}</td>
        <td>${d.data.max}</td>
        <td>
          <div class="bar-container">
            <div class="bar ${d.class}" style="width: ${width}%"></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function getDimensionBadge(dim: string): string {
  if (dim.includes('5D')) return 'critical';
  if (dim.includes('4D')) return 'high';
  if (dim.includes('3D')) return 'medium';
  return 'low';
}

function generateRefactorSection(items: RefactorItem[]): string {
  const critical = items.filter((r) => r.priority === 'critical');
  const high = items.filter((r) => r.priority === 'high');
  const medium = items.filter((r) => r.priority === 'medium');

  let html = '';

  if (critical.length > 0) {
    html += '<h3>Critical</h3><table><thead><tr><th>Function</th><th>File</th><th>Reason</th><th>Suggestion</th></tr></thead><tbody>';
    html += critical.map((r) => `
      <tr>
        <td><strong>${escapeHtml(r.function)}</strong></td>
        <td class="file-path">${escapeHtml(r.file)}:${r.line}</td>
        <td>${escapeHtml(r.reason)}</td>
        <td>${escapeHtml(r.suggestion)}</td>
      </tr>
    `).join('');
    html += '</tbody></table>';
  }

  if (high.length > 0) {
    html += '<h3>High</h3><table><thead><tr><th>Function</th><th>File</th><th>Reason</th><th>Suggestion</th></tr></thead><tbody>';
    html += high.map((r) => `
      <tr>
        <td><strong>${escapeHtml(r.function)}</strong></td>
        <td class="file-path">${escapeHtml(r.file)}:${r.line}</td>
        <td>${escapeHtml(r.reason)}</td>
        <td>${escapeHtml(r.suggestion)}</td>
      </tr>
    `).join('');
    html += '</tbody></table>';
  }

  if (medium.length > 0) {
    html += '<h3>Medium</h3><table><thead><tr><th>Function</th><th>File</th><th>Reason</th></tr></thead><tbody>';
    html += medium.slice(0, 10).map((r) => `
      <tr>
        <td><strong>${escapeHtml(r.function)}</strong></td>
        <td class="file-path">${escapeHtml(r.file)}:${r.line}</td>
        <td>${escapeHtml(r.reason)}</td>
      </tr>
    `).join('');
    html += '</tbody></table>';
  }

  return html || '<p>No significant refactoring needed.</p>';
}

function generateFileBar(file: { totalMcCabe: number; totalDimensional: number }): string {
  const ratio = file.totalMcCabe > 0 ? file.totalDimensional / file.totalMcCabe : 1;
  const width = Math.min(ratio * 10, 100);

  let colorClass = 'bar-1d';
  if (ratio > 5) colorClass = 'bar-5d';
  else if (ratio > 3) colorClass = 'bar-4d';
  else if (ratio > 2) colorClass = 'bar-3d';
  else if (ratio > 1.5) colorClass = 'bar-2d';

  return `<div class="bar-container"><div class="bar ${colorClass}" style="width: ${width}%"></div></div>`;
}
