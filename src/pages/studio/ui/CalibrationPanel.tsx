/**
 * AI reviewer calibration (content quality gate, WS11c): the AI's verdicts on
 * the golden set against the owner's labels, and whether the trust gate for a
 * full run holds. Read-only — the numbers come from `GET /assessments/calibration`.
 */
import { Gauge } from 'lucide-react';
import {
  ASSESSMENT_CRITERIA,
  ASSESSMENT_VERDICTS,
  CRITERION_LABELS,
  VERDICT_LABELS,
} from '../../../lib/contentAssessment';
import { useCalibrationQuery } from '../lib/queries';
import { VERDICT_TONE } from '../lib/assessmentForm';
import { cn } from './cn';
import { Badge, Disclosure, Metric, Note, Panel } from './kit';

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);
const VALUE_UK = { pass: 'так', fail: 'ні', unsure: '?' } as const;

export function CalibrationPanel() {
  const query = useCalibrationQuery();
  const report = query.data?.report;
  if (query.isLoading || !query.data?.available || !report) return null;

  const t = report.thresholds;
  return (
    <Panel
      title={
        <>
          <Gauge size={14} />
          Калібрування AI-рецензента
        </>
      }
      subtitle={`${report.pairs} пар з ${report.goldenLabels} розмічених${report.missingAi ? ` · ${report.missingAi} ще без вердикту AI` : ''}`}
      action={<Badge tone={report.trusted ? 'success' : 'danger'}>{report.trusted ? 'Можна довіряти' : 'Ще не довіряємо'}</Badge>}
    >
      {report.pairs === 0 ? (
        <Note>
          AI ще не оцінював еталон. Запустіть <code>npm run ai -- ai-review --golden --apply</code>, і тут зʼявиться
          порівняння з вашими оцінками.
        </Note>
      ) : (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Metric
              label="Збіг вердиктів"
              value={pct(report.verdictAgreement)}
              delta={`потрібно ≥ ${pct(t.verdictAgreement)}`}
              tone={report.verdictAgreement !== null && report.verdictAgreement >= t.verdictAgreement ? 'good' : 'bad'}
            />
            <Metric
              label="Ловить «Відхилити»"
              value={pct(report.byVerdict.reject.recall)}
              delta={`потрібно ≥ ${pct(t.rejectRecall)}`}
              tone={report.byVerdict.reject.recall !== null && report.byVerdict.reject.recall >= t.rejectRecall ? 'good' : 'bad'}
              hint="З питань, які ви відхилили, яку частку відхилив і AI"
            />
            <Metric
              label="Точність «Відхилити»"
              value={pct(report.byVerdict.reject.precision)}
              hint="З питань, які відхилив AI, яку частку відхилили й ви"
            />
            <Metric
              label="Помічає проблеми"
              value={pct(report.flagRecall)}
              hint="З питань, де ви бачили будь-яку проблему, на скількох AI теж не сказав «Добре»"
            />
          </div>

          {report.gateFailures.length > 0 && (
            <Note tone="danger">
              Повний прогін по банку заблоковано: {report.gateFailures.join('; ')}.
            </Note>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[11.5px] font-semibold tracking-[0.02em] text-faint uppercase">
                Ваш вердикт → вердикт AI
              </p>
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr>
                    <th className="p-1 text-left font-medium text-faint">Ви \ AI</th>
                    {ASSESSMENT_VERDICTS.map((v) => (
                      <th key={v} className="p-1 text-right font-medium text-faint">
                        {VERDICT_LABELS[v]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ASSESSMENT_VERDICTS.map((g) => (
                    <tr key={g} className="border-t border-line">
                      <th scope="row" className="p-1 text-left font-medium">
                        {VERDICT_LABELS[g]}
                      </th>
                      {ASSESSMENT_VERDICTS.map((a) => {
                        const n = report.confusion[g][a];
                        const missedReject = g === 'reject' && a === 'pass' && n > 0;
                        return (
                          <td
                            key={a}
                            className={cn(
                              'studio-num p-1 text-right',
                              g === a && n > 0 && 'font-semibold text-success',
                              missedReject && 'font-semibold text-danger',
                              n === 0 && 'text-faint',
                            )}
                          >
                            {n}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <p className="mb-1.5 text-[11.5px] font-semibold tracking-[0.02em] text-faint uppercase">За критеріями</p>
              <ul className="grid gap-1 text-[12.5px]">
                {ASSESSMENT_CRITERIA.map((c) => {
                  const s = report.byCriterion[c];
                  return (
                    <li key={c} className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate">{CRITERION_LABELS[c].label}</span>
                      <span className="studio-num w-12 text-right" title="Збіг там, де обидва впевнені">
                        {pct(s.agreement)}
                      </span>
                      <span className="studio-num w-24 text-right text-faint" title="Ваші «Ні», які AI теж не пропустив">
                        {s.goldenFails ? `${s.caught}/${s.goldenFails} «ні»` : '—'}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {report.confidence.agreed !== null && (
                <p className="mt-2 text-[12px] text-faint">
                  Упевненість AI: {pct(report.confidence.agreed)} коли збігається з вами,{' '}
                  {pct(report.confidence.disagreed)} коли ні.
                </p>
              )}
            </div>
          </div>

          {report.disagreements.length > 0 && (
            <Disclosure label="Розбіжності" hint={`${report.disagreements.length}`}>
              <ul className="grid gap-2 px-4 py-3">
                {report.disagreements.map((d) => (
                  <li key={d.questionId} className="grid gap-1 border-b border-line pb-2 text-[12.5px] last:border-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={VERDICT_TONE[d.golden]}>Ви: {VERDICT_LABELS[d.golden]}</Badge>
                      <Badge tone={VERDICT_TONE[d.ai]}>AI: {VERDICT_LABELS[d.ai]}</Badge>
                      {d.aiConfidence !== null && <span className="text-faint">упевненість {pct(d.aiConfidence)}</span>}
                      <span className="studio-mono text-[11px] text-faint">{d.questionId}</span>
                    </div>
                    <p>{d.text}</p>
                    {Object.keys(d.criteria).length > 0 && (
                      <p className="text-faint">
                        {Object.entries(d.criteria)
                          .map(([c, v]) => `${CRITERION_LABELS[c as keyof typeof CRITERION_LABELS].label}: ви «${VALUE_UK[v[0]]}», AI «${VALUE_UK[v[1]]}»`)
                          .join(' · ')}
                      </p>
                    )}
                    {d.aiNotes && <p className="text-faint">AI: {d.aiNotes}</p>}
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}
        </div>
      )}
    </Panel>
  );
}
