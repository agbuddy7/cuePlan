import { useState } from 'react';
import { budgetFacts } from '../domain/budget.js';
import { schedule } from '../domain/workflow.js';
import { todayISO } from '../domain/calendar.js';
import { importWorkspace } from '../state/workspace.js';
import { useWorkspace } from '../state/useWorkspace.js';
import { BudgetPanel } from './BudgetPanel.js';
import { ConstraintsForm } from './ConstraintsForm.js';
import { VendorsPanel } from './VendorsPanel.js';
import { TimelinePanel } from './TimelinePanel.js';
import { ScenarioPanel } from './ScenarioPanel.js';
import { Coordinator } from './Coordinator.js';
import { PrintSummary } from './PrintSummary.js';
import { RisksPanel } from './RisksPanel.js';

const tabs = ['Budget', 'Vendors', 'Timeline', 'Decisions', 'Risks', 'Activity'] as const;
type Tab = (typeof tabs)[number];
export function App() {
  const workspace = useWorkspace();
  const { state, dispatch } = workspace;
  const { plan } = state;
  const [tab, setTab] = useState<Tab>('Budget');
  const facts = budgetFacts(plan),
    tasks = schedule(plan.tasks, plan.constraints.eventDate, todayISO());
  function exportPlan(): void {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cueplan-workspace.json';
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }
  return (
    <>
      <a className="skip" href="#main">
        Skip to workspace
      </a>
      <header>
        <a className="brand" href="#main">
          <span aria-hidden="true">C</span>CuePlan
        </a>
        <div className="actions">
          <button type="button" disabled={!state.history.length} onClick={workspace.undo}>
            Undo last change
          </button>
          <button type="button" onClick={exportPlan}>
            Export workspace
          </button>
          <label className="file-button">
            Import workspace
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 2_000_000) {
                  workspace.setNotice('Import rejected. Workspace exceeds the 2 MB limit.');
                  event.target.value = '';
                  return;
                }
                void file
                  .text()
                  .then((text) => {
                    workspace.replace(importWorkspace(text));
                    workspace.setNotice('Workspace imported and validated.');
                  })
                  .catch(() => {
                    workspace.setNotice(
                      'Import rejected. Choose a valid CuePlan v2 workspace under 2 MB.',
                    );
                  });
                event.target.value = '';
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              window.print();
            }}
          >
            Print plan
          </button>
        </div>
      </header>
      <main id="main">
        <section className="hero">
          <div>
            <p className="eyebrow">Community event command center</p>
            <h1>
              Plan confidently.
              <br />
              <span>Decide with the whole picture.</span>
            </h1>
          </div>
          <p>
            Keep budgets, vendor commitments and execution connected. Every decision is reviewable,
            saved in your browser and reversible.
          </p>
        </section>
        <div role="status" className="notice">
          {workspace.notice ||
            'Local workspace ready. Export a copy whenever you need to hand it off.'}
        </div>
        <section className="panel setup" aria-labelledby="constraints-title">
          <h2 id="constraints-title">Event constraints</h2>
          <ConstraintsForm
            input={plan.constraints}
            onApply={(input) => {
              dispatch({ type: 'updateConstraints', input });
            }}
          />
        </section>
        <div className="layout">
          <div>
            <div className="readiness">
              <strong>
                {tasks.filter((t) => t.done).length}/{tasks.length} tasks complete
              </strong>
              <span>{facts.confirmedCategories}/5 categories with accepted quotes</span>
              <span>Revision {plan.revision}</span>
            </div>
            <div className="panel">
              <div className="tabs" role="tablist" aria-label="Event workspace">
                {tabs.map((item, index) => (
                  <button
                    key={item}
                    type="button"
                    role="tab"
                    id={`tab-${item}`}
                    aria-selected={tab === item}
                    aria-controls={`panel-${item}`}
                    tabIndex={tab === item ? 0 : -1}
                    onClick={() => {
                      setTab(item);
                    }}
                    onKeyDown={(event) => {
                      let target: Tab | undefined;
                      if (event.key === 'ArrowRight') target = tabs[(index + 1) % tabs.length];
                      if (event.key === 'ArrowLeft')
                        target = tabs[(index + tabs.length - 1) % tabs.length];
                      if (event.key === 'Home') target = tabs[0];
                      if (event.key === 'End') target = tabs.at(-1);
                      if (target) {
                        event.preventDefault();
                        setTab(target);
                        document.getElementById(`tab-${target}`)?.focus();
                      }
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div
                className="tab-content"
                role="tabpanel"
                id={`panel-${tab}`}
                aria-labelledby={`tab-${tab}`}
                key={tab}
              >
                {tab === 'Budget' && <BudgetPanel plan={plan} dispatch={dispatch} />}{' '}
                {tab === 'Risks' && <RisksPanel plan={plan} />}
                {tab === 'Vendors' && <VendorsPanel plan={plan} dispatch={dispatch} />}{' '}
                {tab === 'Timeline' && <TimelinePanel plan={plan} dispatch={dispatch} />}{' '}
                {tab === 'Decisions' && (
                  <ScenarioPanel key={plan.revision} plan={plan} dispatch={dispatch} />
                )}{' '}
                {tab === 'Activity' && (
                  <section>
                    <h2>Decision history</h2>
                    <p>
                      Undo restores the previous plan snapshot. History is stored locally with the
                      workspace.
                    </p>
                    <ol>
                      {[...state.audit].reverse().map((entry) => (
                        <li key={entry.revision}>
                          <strong>
                            r{entry.revision} · {entry.action}
                          </strong>
                          <p>{entry.detail}</p>
                          <time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time>
                        </li>
                      ))}
                    </ol>
                    {!state.audit.length && <p>Your first saved change will appear here.</p>}
                  </section>
                )}
              </div>
            </div>
          </div>
          <Coordinator plan={plan} />
        </div>
        <PrintSummary plan={plan} />
      </main>
      <footer>
        CuePlan · Costs without accepted quotes are estimates. Browser autosave is local to this
        device.
      </footer>
    </>
  );
}
