/** Validate a directed task graph and derive readiness from completed prerequisites. */
export function resolveWorkflow(tasks, completedIds = []) {
  const byId = new Map(tasks.map(task => [task.id, task]));
  if (byId.size !== tasks.length) throw new Error("Task IDs must be unique.");
  const visited = new Set();
  const visiting = new Set();
  function visit(id) {
    if (!byId.has(id)) throw new Error("Unknown task dependency: " + id);
    if (visiting.has(id)) throw new Error("Task graph contains a cycle.");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id).dependsOn) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  }
  for (const task of tasks) visit(task.id);
  const completed = new Set(completedIds);
  for (const id of completed) {
    if (!byId.has(id)) throw new Error("Unknown completed task: " + id);
    if (!byId.get(id).dependsOn.every(dep => completed.has(dep))) {
      throw new Error("Complete prerequisite tasks first.");
    }
  }
  return tasks.map(task => ({
    ...task,
    status: completed.has(task.id) ? "completed" : task.dependsOn.every(id => completed.has(id)) ? "ready" : "blocked",
  }));
}
