import { useEffect, useState } from 'react';
import { createPlan, type Command } from '../domain/plan.js';
import { shiftDate, todayISO } from '../domain/calendar.js';
import {
  applyCommand,
  initialWorkspace,
  loadWorkspace,
  saveWorkspace,
  undo,
  type Workspace,
} from './workspace.js';

function defaultState(): Workspace {
  const today = todayISO();
  return initialWorkspace(
    createPlan(
      {
        eventType: 'community-fest',
        budget: 120000,
        guests: 120,
        eventDate: shiftDate(today, 42),
        priority: 'balanced',
      },
      today,
      crypto.randomUUID(),
    ),
  );
}
export function useWorkspace() {
  const [notice, setNotice] = useState('');
  const [state, setState] = useState(() => {
    try {
      return loadWorkspace(localStorage) ?? defaultState();
    } catch {
      return defaultState();
    }
  });
  useEffect(() => {
    try {
      saveWorkspace(localStorage, state);
    } catch {
      setNotice('Browser storage is unavailable. Export your workspace to keep a copy.');
    }
  }, [state]);
  function dispatch(command: Command): void {
    try {
      const next = applyCommand(state, command, todayISO(), new Date().toISOString());
      setState(next);
      setNotice('Plan updated and saved in this browser.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not apply this change.');
    }
  }
  return {
    state,
    dispatch,
    notice,
    setNotice,
    replace: setState,
    undo: () => {
      setState((current) => undo(current, new Date().toISOString()));
    },
  };
}
