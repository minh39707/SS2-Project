function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPercent(value) {
  const numericValue = Number(value ?? 0);

  if (!Number.isFinite(numericValue)) {
    return "0%";
  }

  return `${Math.round(numericValue * 100)}%`;
}

function formatDate(value) {
  if (!value) {
    return "N/A";
  }

  return String(value);
}

function renderList(items = []) {
  const normalizedItems = Array.isArray(items) ? items.filter(Boolean) : [];

  if (!normalizedItems.length) {
    return "<p class=\"muted\">No items available.</p>";
  }

  return `<ul>${normalizedItems
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("")}</ul>`;
}

function renderMetricCards(reportMetrics = [], analytics = {}) {
  const summary = analytics?.summary ?? {};
  const fallbackMetrics = [
    {
      label: "Success rate",
      value: formatPercent(summary.completionRate),
      note: "Overall successful habit share",
    },
    {
      label: "Success logs",
      value: String(summary.successCount ?? 0),
      note: "Completed or avoided logs",
    },
    {
      label: "EXP gained",
      value: String(summary.totalExpGained ?? 0),
      note: "Total EXP in selected range",
    },
    {
      label: "Active days",
      value: String(summary.activeDays ?? 0),
      note: "Days with successful activity",
    },
  ];
  const metrics = reportMetrics.length > 0 ? reportMetrics : fallbackMetrics;

  return metrics
    .map(
      (metric) => `
        <div class="metric">
          <p>${escapeHtml(metric.label)}</p>
          <strong>${escapeHtml(metric.value)}</strong>
          <span>${escapeHtml(metric.note)}</span>
        </div>
      `,
    )
    .join("");
}

function renderTopHabits(analytics = {}) {
  const habits = Array.isArray(analytics?.topHabits) ? analytics.topHabits.slice(0, 6) : [];

  if (!habits.length) {
    return "<p class=\"muted\">No completed habits available for this range.</p>";
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Habit</th>
          <th>Type</th>
          <th>Success</th>
          <th>Rate</th>
        </tr>
      </thead>
      <tbody>
        ${habits
          .map(
            (habit) => `
              <tr>
                <td>${escapeHtml(habit.title)}</td>
                <td>${escapeHtml(habit.habitType ?? "positive")}</td>
                <td>${escapeHtml(habit.successCount ?? 0)}</td>
                <td>${escapeHtml(formatPercent(habit.successRate))}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

export function buildAnalyticsReportHtml({ report, analytics, period }) {
  const range = analytics?.range ?? {};
  const generatedAt = new Date().toLocaleString();

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { margin: 32px; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #1e293b;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: #ffffff;
          }
          .hero {
            padding: 24px;
            border-radius: 18px;
            background: #eef5ff;
            border: 1px solid #cfe0ff;
          }
          h1 {
            margin: 0 0 8px;
            font-size: 28px;
            line-height: 1.15;
          }
          h2 {
            margin: 28px 0 12px;
            font-size: 17px;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }
          p {
            margin: 0;
            line-height: 1.55;
          }
          .muted {
            color: #64748b;
          }
          .meta {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 16px;
          }
          .pill {
            padding: 8px 10px;
            border-radius: 999px;
            background: #ffffff;
            color: #475569;
            border: 1px solid #d7e5fb;
            font-size: 12px;
            font-weight: 700;
          }
          .metrics {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            margin-top: 16px;
          }
          .metric {
            padding: 14px;
            border-radius: 14px;
            border: 1px solid #d6e2f6;
            background: #f8fbff;
          }
          .metric p {
            color: #64748b;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .metric strong {
            display: block;
            margin: 8px 0 4px;
            font-size: 24px;
          }
          .metric span {
            color: #64748b;
            font-size: 12px;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 18px;
          }
          .section {
            page-break-inside: avoid;
          }
          ul {
            margin: 0;
            padding-left: 20px;
          }
          li {
            margin-bottom: 8px;
            line-height: 1.45;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
          }
          th, td {
            text-align: left;
            padding: 10px 8px;
            border-bottom: 1px solid #dce6f2;
            font-size: 12px;
          }
          th {
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }
          footer {
            margin-top: 28px;
            padding-top: 16px;
            border-top: 1px solid #dce6f2;
            color: #64748b;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <section class="hero">
          <h1>${escapeHtml(report?.title ?? "Habit Analytics Report")}</h1>
          <p class="muted">${escapeHtml(report?.subtitle ?? "AI-generated local analysis")}</p>
          <div class="meta">
            <span class="pill">Period: ${escapeHtml(period ?? range.period ?? "week")}</span>
            <span class="pill">${escapeHtml(formatDate(range.startDate))} - ${escapeHtml(formatDate(range.endDate))}</span>
            <span class="pill">Generated: ${escapeHtml(generatedAt)}</span>
          </div>
        </section>

        <h2>Executive Summary</h2>
        <p>${escapeHtml(report?.executive_summary)}</p>

        <section class="metrics">
          ${renderMetricCards(report?.key_metrics ?? [], analytics)}
        </section>

        <section class="grid">
          <div class="section">
            <h2>Strengths</h2>
            ${renderList(report?.strengths)}
          </div>
          <div class="section">
            <h2>Risks</h2>
            ${renderList(report?.risks)}
          </div>
        </section>

        <section class="section">
          <h2>Recommendations</h2>
          ${renderList(report?.recommendations)}
        </section>

        <section class="section">
          <h2>Next Week Plan</h2>
          ${renderList(report?.next_week_plan)}
        </section>

        <section class="section">
          <h2>Top Habits</h2>
          ${renderTopHabits(analytics)}
        </section>

        <footer>
          ${escapeHtml(report?.closing_note ?? "Generated from your current habit analytics.")}
        </footer>
      </body>
    </html>
  `;
}
