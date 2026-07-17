(() => {
  const STORAGE_KEY = "taskflow.todos.v1";
  const FILTER_KEY = "taskflow.filter.v1";
  const FILTERS = ["all", "active", "completed"];

  const elements = {
    form: document.getElementById("task-form"),
    input: document.getElementById("task-input"),
    list: document.getElementById("task-list"),
    empty: document.getElementById("empty-state"),
    status: document.getElementById("status-message"),
    filters: document.querySelector(".filters"),
    clearCompleted: document.getElementById("clear-completed"),
    clearAll: document.getElementById("clear-all"),
    stats: {
      total: document.querySelector('[data-stat="total"]'),
      active: document.querySelector('[data-stat="active"]'),
      completed: document.querySelector('[data-stat="completed"]'),
      totalSide: document.querySelector('[data-stat="total-side"]'),
      activeSide: document.querySelector('[data-stat="active-side"]'),
      completedSide: document.querySelector('[data-stat="completed-side"]')
    }
  };

  const state = {
    tasks: loadTasks(),
    filter: loadFilter(),
    editingId: null
  };

  function createId() {
    return window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function loadTasks() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function loadFilter() {
    const saved = localStorage.getItem(FILTER_KEY);
    return FILTERS.includes(saved) ? saved : "all";
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
    localStorage.setItem(FILTER_KEY, state.filter);
  }

  function saveTasksOnly() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
  }

  function normalizeTitle(value) {
    return value.trim().replace(/\s+/g, " ");
  }

  function currentTasks() {
    if (state.filter === "active") {
      return state.tasks.filter((task) => !task.completed);
    }

    if (state.filter === "completed") {
      return state.tasks.filter((task) => task.completed);
    }

    return state.tasks;
  }

  function formatDate(isoValue) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(isoValue));
  }

  function announce(message) {
    elements.status.textContent = message;
  }

  function setEditing(id) {
    state.editingId = id;
    render();
  }

  function addTask(title) {
    state.tasks.unshift({
      id: createId(),
      title,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    saveTasksOnly();
    announce(`Task added: ${title}`);
  }

  function toggleTask(id, completed) {
    const task = state.tasks.find((item) => item.id === id);
    if (!task) {
      return;
    }

    task.completed = completed;
    task.updatedAt = new Date().toISOString();
    saveTasksOnly();
    announce(completed ? `Marked completed: ${task.title}` : `Marked active: ${task.title}`);
  }

  function deleteTask(id) {
    const index = state.tasks.findIndex((task) => task.id === id);
    if (index === -1) {
      return;
    }

    const [removed] = state.tasks.splice(index, 1);
    if (state.editingId === id) {
      state.editingId = null;
    }
    saveTasksOnly();
    announce(`Deleted task: ${removed.title}`);
  }

  function updateTask(id, title) {
    const task = state.tasks.find((item) => item.id === id);
    if (!task) {
      return;
    }

    task.title = title;
    task.updatedAt = new Date().toISOString();
    state.editingId = null;
    saveTasksOnly();
    announce(`Updated task: ${title}`);
  }

  function clearCompleted() {
    const before = state.tasks.length;
    state.tasks = state.tasks.filter((task) => !task.completed);
    const removed = before - state.tasks.length;
    state.editingId = null;
    saveTasksOnly();
    announce(removed > 0 ? `Cleared ${removed} completed task${removed === 1 ? "" : "s"}.` : "No completed tasks to clear.");
  }

  function clearAll() {
    const removed = state.tasks.length;
    state.tasks = [];
    state.editingId = null;
    saveTasksOnly();
    announce(removed > 0 ? "Deleted all tasks." : "No tasks to delete.");
  }

  function setFilter(filter) {
    if (!FILTERS.includes(filter)) {
      return;
    }

    state.filter = filter;
    state.editingId = null;
    persist();
    render();
    announce(`Showing ${filter} tasks.`);
  }

  function updateStats() {
    const total = state.tasks.length;
    const completed = state.tasks.filter((task) => task.completed).length;
    const active = total - completed;

    elements.stats.total.textContent = String(total);
    elements.stats.active.textContent = String(active);
    elements.stats.completed.textContent = String(completed);
    elements.stats.totalSide.textContent = String(total);
    elements.stats.activeSide.textContent = String(active);
    elements.stats.completedSide.textContent = String(completed);
  }

  function updateFilterButtons() {
    elements.filters.querySelectorAll("button[data-filter]").forEach((button) => {
      const selected = button.dataset.filter === state.filter;
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function createTaskView(task) {
    const item = document.createElement("li");
    item.className = `task${task.completed ? " is-completed" : ""}`;
    item.dataset.id = task.id;

    if (state.editingId === task.id) {
      const editWrap = document.createElement("div");
      editWrap.className = "task-edit";

      const label = document.createElement("label");
      label.className = "sr-only";
      label.htmlFor = `edit-${task.id}`;
      label.textContent = `Edit task: ${task.title}`;

      const row = document.createElement("div");
      row.className = "task-edit-row";

      const input = document.createElement("input");
      input.id = `edit-${task.id}`;
      input.type = "text";
      input.value = task.title;
      input.maxLength = 120;
      input.dataset.editInput = "true";

      const actions = document.createElement("div");
      actions.className = "task-actions";

      const save = document.createElement("button");
      save.type = "button";
      save.dataset.action = "save";
      save.textContent = "Save";

      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.dataset.action = "cancel";
      cancel.className = "ghost";
      cancel.textContent = "Cancel";

      actions.append(save, cancel);
      row.append(input, actions);
      editWrap.append(label, row);
      item.append(editWrap);
      requestAnimationFrame(() => input.focus());
      return item;
    }

    const main = document.createElement("div");
    main.className = "task-main";

    const label = document.createElement("label");
    label.className = "task-check";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    checkbox.dataset.action = "toggle";

    const textWrap = document.createElement("span");
    textWrap.className = "task-title";

    const title = document.createElement("span");
    title.textContent = task.title;

    const meta = document.createElement("span");
    meta.className = "task-meta";
    meta.textContent = `Updated ${formatDate(task.updatedAt)}`;

    textWrap.append(title, meta);
    label.append(checkbox, textWrap);
    main.append(label);

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const edit = document.createElement("button");
    edit.type = "button";
    edit.dataset.action = "edit";
    edit.textContent = "Edit";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.dataset.action = "delete";
    remove.className = "ghost";
    remove.textContent = "Delete";

    actions.append(edit, remove);
    item.append(main, actions);
    return item;
  }

  function render() {
    updateFilterButtons();
    updateStats();

    const visibleTasks = currentTasks();
    elements.list.replaceChildren(...visibleTasks.map(createTaskView));

    if (state.tasks.length === 0) {
      elements.empty.hidden = false;
      elements.empty.textContent = "No tasks yet. Add your first item above.";
    } else if (visibleTasks.length === 0) {
      elements.empty.hidden = false;
      elements.empty.textContent = state.filter === "active"
        ? "No active tasks right now."
        : "No completed tasks yet.";
    } else {
      elements.empty.hidden = true;
    }

    elements.clearCompleted.disabled = !state.tasks.some((task) => task.completed);
    elements.clearAll.disabled = state.tasks.length === 0;
  }

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();

    const title = normalizeTitle(elements.input.value);
    if (!title) {
      elements.input.focus();
      announce("Please enter a task title.");
      return;
    }

    addTask(title);
    elements.form.reset();
    elements.input.focus();
    render();
  });

  elements.filters.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter]");
    if (!button) {
      return;
    }

    setFilter(button.dataset.filter);
  });

  elements.list.addEventListener("change", (event) => {
    const checkbox = event.target.closest('input[data-action="toggle"]');
    if (!checkbox) {
      return;
    }

    const item = checkbox.closest(".task");
    if (!item) {
      return;
    }

    toggleTask(item.dataset.id, checkbox.checked);
    render();
  });

  elements.list.addEventListener("click", (event) => {
    const control = event.target.closest("button[data-action]");
    if (!control) {
      return;
    }

    const item = control.closest(".task");
    if (!item) {
      return;
    }

    const { action } = control.dataset;

    if (action === "edit") {
      setEditing(item.dataset.id);
      return;
    }

    if (action === "delete") {
      deleteTask(item.dataset.id);
      render();
      return;
    }

    if (action === "cancel") {
      setEditing(null);
      return;
    }

    if (action === "save") {
      const input = item.querySelector("[data-edit-input]");
      const title = normalizeTitle(input?.value || "");

      if (!title) {
        announce("Task title cannot be empty.");
        input?.focus();
        return;
      }

      updateTask(item.dataset.id, title);
      render();
    }
  });

  elements.list.addEventListener("keydown", (event) => {
    const input = event.target.closest("[data-edit-input]");
    if (!input) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setEditing(null);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const taskItem = input.closest(".task");
      const title = normalizeTitle(input.value);

      if (!title) {
        announce("Task title cannot be empty.");
        input.focus();
        return;
      }

      updateTask(taskItem.dataset.id, title);
      render();
    }
  });

  elements.clearCompleted.addEventListener("click", () => {
    clearCompleted();
    render();
  });

  elements.clearAll.addEventListener("click", () => {
    clearAll();
    render();
  });

  window.addEventListener("beforeunload", persist);

  render();
})();