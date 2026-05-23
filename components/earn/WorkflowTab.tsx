"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── Types ─────────────────────────────────────────────────────────────────────

type PricingPatch = {
  costPerOrder?: number | null;
  costPerKg?: number | null;
  costPerKgPerKm?: number | null;
  costPerItemPerKm?: number | null;
};

type StepAssignee = PricingPatch & {
  id: string;
  stepId: string;
  collaborationId: string;
  sequence: number;
  displayName: string;
  collaboration: {
    id: string;
    role: string;
    teamRole: string | null;
    scope: string;
    requester: { title: string; avatarUrl: string | null };
    receiver: { title: string; avatarUrl: string | null };
  };
};

type AvailableCollab = {
  id: string;
  role: string;
  teamRole: string | null;
  customRole: string | null;
  scope: string;
  displayName: string;
};

type WorkflowStep = {
  id: string;
  name: string;
  sequence: number;
  assigneeType: string;
  assigneeId: string | null;
  assignmentMode: string;
  quoteRequired: boolean;
  quoteTimeoutHours: number;
  assignees: StepAssignee[];
};

type StepPatch = Partial<
  Pick<WorkflowStep, "name" | "assigneeId" | "assigneeType" | "quoteRequired" | "quoteTimeoutHours" | "assignmentMode">
>;

// ── Small helpers ─────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
  );
}

function DragHandle(props: React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      tabIndex={-1}
      aria-label="Drag to reorder"
      className="p-1 text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none shrink-0"
    >
      <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
        <circle cx="3" cy="2.5"  r="1.2" /><circle cx="9" cy="2.5"  r="1.2" />
        <circle cx="3" cy="7"    r="1.2" /><circle cx="9" cy="7"    r="1.2" />
        <circle cx="3" cy="11.5" r="1.2" /><circle cx="9" cy="11.5" r="1.2" />
      </svg>
    </button>
  );
}

// ── AssigneeRow ───────────────────────────────────────────────────────────────

function AssigneeRow({
  assignee,
  canEdit,
  onRemove,
  onPricingUpdate,
}: {
  assignee: StepAssignee;
  canEdit: boolean;
  onRemove: (assigneeId: string) => void;
  onPricingUpdate: (assigneeId: string, patch: PricingPatch) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: assignee.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 30 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
  };

  const [pricingOpen, setPricingOpen] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roleLabel = (
    assignee.collaboration.teamRole ?? assignee.collaboration.role
  ).replace(/_/g, " ");

  function handlePricingBlur(field: keyof PricingPatch, val: string) {
    const num = val.trim() === "" ? null : parseFloat(val);
    const clean = num === null || isNaN(num) ? null : num;
    onPricingUpdate(assignee.id, { [field]: clean });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setSavedFeedback(true);
    feedbackTimer.current = setTimeout(() => setSavedFeedback(false), 2000);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-gray-800 bg-gray-950 overflow-hidden"
    >
      {/* Main row */}
      <div className="flex items-center gap-1.5 px-2 py-2">
        {canEdit && <DragHandle {...attributes} {...listeners} />}
        <span className="w-5 text-center text-xs font-mono text-gray-600 shrink-0 select-none">
          {assignee.sequence}
        </span>
        <span className="flex-1 text-sm text-white truncate min-w-0">
          {assignee.displayName}
        </span>
        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 shrink-0 capitalize">
          {roleLabel}
        </span>
        {canEdit && (
          <button
            onClick={() => setPricingOpen((o) => !o)}
            className={`text-xs px-1.5 py-0.5 rounded transition-colors shrink-0 ${
              pricingOpen
                ? "bg-indigo-900/40 text-indigo-300"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            ₹ Pricing {pricingOpen ? "▲" : "▼"}
          </button>
        )}
        {savedFeedback && (
          <span className="text-xs text-green-400 shrink-0">Saved ✓</span>
        )}
        {canEdit && (
          <button
            onClick={() => onRemove(assignee.id)}
            className="text-xs text-gray-600 hover:text-red-400 transition-colors shrink-0 px-0.5"
            aria-label="Remove assignee"
          >
            ×
          </button>
        )}
      </div>

      {/* Pricing panel */}
      {pricingOpen && (
        <div className="border-t border-gray-800 px-3 py-2.5 grid grid-cols-2 gap-x-3 gap-y-2">
          {(
            [
              ["costPerOrder",     "Per order (₹)"],
              ["costPerKg",        "Per kg (₹)"],
              ["costPerKgPerKm",   "Per kg/km (₹)"],
              ["costPerItemPerKm", "Per item/km (₹)"],
            ] as [keyof PricingPatch, string][]
          ).map(([field, label]) => (
            <div key={field} className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-500">{label}</span>
              <input
                key={String(assignee[field])}
                type="number"
                min={0}
                step={0.01}
                defaultValue={assignee[field] ?? ""}
                disabled={!canEdit}
                onBlur={(e) => handlePricingBlur(field, e.target.value)}
                placeholder="—"
                className="w-full text-xs bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white outline-none disabled:opacity-50 focus:border-indigo-500"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AssigneeSection ───────────────────────────────────────────────────────────

function AssigneeSection({
  step,
  availableCollabs,
  canEdit,
  onAdd,
  onRemove,
  onPricingUpdate,
  onReorder,
}: {
  step: WorkflowStep;
  availableCollabs: AvailableCollab[];
  canEdit: boolean;
  onAdd: (collaborationId: string) => void;
  onRemove: (assigneeId: string) => void;
  onPricingUpdate: (assigneeId: string, patch: PricingPatch) => void;
  onReorder: (activeId: string, overId: string) => void;
}) {
  const [addingPartner, setAddingPartner] = useState(false);

  const innerSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const assignedCollabIds = new Set(step.assignees.map((a) => a.collaborationId));
  const unassigned = availableCollabs.filter((c) => !assignedCollabIds.has(c.id));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorder(String(active.id), String(over.id));
  }

  return (
    <div className="space-y-1.5">
      {/* Assignee rows */}
      {step.assignees.length > 0 && (
        <DndContext
          sensors={innerSensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={step.assignees.map((a) => a.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {step.assignees.map((a) => (
                <AssigneeRow
                  key={a.id}
                  assignee={a}
                  canEdit={canEdit}
                  onRemove={onRemove}
                  onPricingUpdate={onPricingUpdate}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add Partner */}
      {canEdit && (
        addingPartner ? (
          <select
            autoFocus
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                onAdd(e.target.value);
                setAddingPartner(false);
              }
            }}
            onBlur={() => setAddingPartner(false)}
            className="w-full text-xs bg-gray-950 border border-indigo-600 rounded-lg px-2 py-1.5 text-white outline-none"
          >
            <option value="" disabled>Select partner…</option>
            {unassigned.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName} · {(c.customRole ?? c.teamRole ?? c.role).replace(/_/g, " ")}
              </option>
            ))}
            {unassigned.length === 0 && (
              <option value="" disabled>All partners already added</option>
            )}
          </select>
        ) : (
          <button
            onClick={() => setAddingPartner(true)}
            disabled={unassigned.length === 0}
            className="w-full text-xs py-1.5 rounded-lg border border-dashed border-gray-700 text-gray-500 hover:border-indigo-600 hover:text-indigo-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + Add Partner
          </button>
        )
      )}

      {step.assignees.length === 0 && !addingPartner && (
        <p className="text-xs text-gray-600 italic">No partners assigned yet.</p>
      )}
    </div>
  );
}

// ── StepCard ──────────────────────────────────────────────────────────────────

function StepCard({
  step,
  availableCollabs,
  pageId,
  onUpdate,
  onDelete,
  onAddAssignee,
  onRemoveAssignee,
  onUpdateAssigneePricing,
  onReorderAssignees,
  isSaving,
  canEdit,
}: {
  step: WorkflowStep;
  availableCollabs: AvailableCollab[];
  pageId: string;
  onUpdate: (id: string, patch: StepPatch) => void;
  onDelete: (id: string) => void;
  onAddAssignee: (stepId: string, collaborationId: string) => void;
  onRemoveAssignee: (stepId: string, assigneeId: string) => void;
  onUpdateAssigneePricing: (stepId: string, assigneeId: string, patch: PricingPatch) => void;
  onReorderAssignees: (stepId: string, activeId: string, overId: string) => void;
  isSaving: boolean;
  canEdit: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 20 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
  };

  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal]         = useState(step.name);
  const [confirmDel, setConfirmDel]   = useState(false);
  const timeoutDebounce               = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setNameVal(step.name); }, [step.name]);

  function commitName() {
    setEditingName(false);
    const v = nameVal.trim();
    if (v && v !== step.name) onUpdate(step.id, { name: v });
    else setNameVal(step.name);
  }

  function handleTimeoutInput(val: string) {
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 1) return;
    if (timeoutDebounce.current) clearTimeout(timeoutDebounce.current);
    timeoutDebounce.current = setTimeout(() => onUpdate(step.id, { quoteTimeoutHours: n }), 600);
  }

  const assignmentMode = step.assignmentMode ?? "sequential";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 p-3 rounded-xl border border-gray-800 bg-gray-900/60"
    >
      {canEdit && <DragHandle {...attributes} {...listeners} />}

      <div className="flex-1 min-w-0 space-y-3">

        {/* Row 1 — sequence + name */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 font-mono w-5 shrink-0 select-none">
            {step.sequence}.
          </span>
          {canEdit && editingName ? (
            <input
              autoFocus
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter")  commitName();
                if (e.key === "Escape") { setEditingName(false); setNameVal(step.name); }
              }}
              className="flex-1 bg-transparent border-b border-indigo-500 text-sm text-white outline-none py-0.5"
            />
          ) : (
            <button
              onClick={() => canEdit && setEditingName(true)}
              className={`flex-1 text-sm font-medium text-white text-left truncate ${canEdit ? "hover:text-indigo-300" : "cursor-default"}`}
            >
              {step.name}
            </button>
          )}
          {isSaving && <Spinner />}
        </div>

        {/* Row 2 — assignment mode toggle */}
        {canEdit && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-16 shrink-0">Mode</span>
            <div className="flex gap-1">
              {(["sequential", "first_to_accept"] as const).map((mode) => (
                <button
                  key={mode}
                  disabled={isSaving}
                  onClick={() => assignmentMode !== mode && onUpdate(step.id, { assignmentMode: mode })}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    assignmentMode === mode
                      ? "border-indigo-600 bg-indigo-900/30 text-indigo-300"
                      : "border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600"
                  } disabled:opacity-50`}
                >
                  {mode === "sequential" ? "Sequential" : "First to Accept"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Row 3 — assignee list */}
        <div className="flex items-start gap-2">
          <span className="text-xs text-gray-500 w-16 shrink-0 pt-1.5">Partners</span>
          <div className="flex-1 min-w-0">
            <AssigneeSection
              step={step}
              availableCollabs={availableCollabs}
              canEdit={canEdit}
              onAdd={(collabId) => onAddAssignee(step.id, collabId)}
              onRemove={(assigneeId) => onRemoveAssignee(step.id, assigneeId)}
              onPricingUpdate={(assigneeId, patch) => onUpdateAssigneePricing(step.id, assigneeId, patch)}
              onReorder={(activeId, overId) => onReorderAssignees(step.id, activeId, overId)}
            />
          </div>
        </div>

        {/* Row 4 — quote toggle + timeout */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 w-16 shrink-0">Quote req.</span>
          <button
            role="switch"
            aria-checked={step.quoteRequired}
            disabled={isSaving || !canEdit}
            onClick={() => canEdit && onUpdate(step.id, { quoteRequired: !step.quoteRequired })}
            className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${
              step.quoteRequired ? "bg-indigo-600" : "bg-gray-700"
            } disabled:opacity-50`}
          >
            <span
              className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                step.quoteRequired ? "translate-x-[18px]" : "translate-x-0.5"
              }`}
            />
          </button>
          {step.quoteRequired && (
            <div className="flex items-center gap-1.5 ml-1">
              <input
                type="number"
                min={1}
                defaultValue={step.quoteTimeoutHours}
                disabled={isSaving || !canEdit}
                onChange={(e) => handleTimeoutInput(e.target.value)}
                className="w-14 text-xs bg-gray-950 border border-gray-700 rounded-lg px-2 py-1 text-white outline-none disabled:opacity-50"
              />
              <span className="text-xs text-gray-500">hrs timeout</span>
            </div>
          )}
        </div>

        {/* Row 5 — legacy assigneeId notice */}
        {step.assigneeId && (
          <p className="text-xs text-amber-500/80 border border-amber-900/40 rounded-lg px-2 py-1.5 bg-amber-900/10">
            Legacy assignee set — add partners above to use the new system.
          </p>
        )}
      </div>

      {/* Delete */}
      {canEdit && (
        <div className="shrink-0 mt-0.5">
          {confirmDel ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onDelete(step.id)}
                className="text-xs px-2 py-1 rounded-md bg-red-900/50 text-red-400 border border-red-800/50 hover:bg-red-900 transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmDel(false)}
                className="text-xs px-2 py-1 rounded-md border border-gray-700 text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDel(true)}
              disabled={isSaving}
              className="text-xs text-gray-600 hover:text-red-400 transition-colors disabled:opacity-50 p-1"
              aria-label="Delete step"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── WorkflowTab ───────────────────────────────────────────────────────────────

export default function WorkflowTab({ pageId, canEdit = true }: { pageId: string; canEdit?: boolean }) {
  const [steps,      setSteps]      = useState<WorkflowStep[]>([]);
  const [availableCollabs, setAvailableCollabs] = useState<AvailableCollab[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState<Set<string>>(new Set());
  const [addingStep, setAddingStep] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const outerSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/initiative/${pageId}/workflow`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSteps(
        (data.steps ?? []).map((s: WorkflowStep) => ({
          ...s,
          assignees: s.assignees ?? [],
          assignmentMode: s.assignmentMode ?? "sequential",
        }))
      );
      setAvailableCollabs(data.assignees ?? []);
    } catch {
      setError("Failed to load workflow. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => { load(); }, [load]);

  function setSavingId(id: string, on: boolean) {
    setSaving((prev) => {
      const next = new Set(prev);
      on ? next.add(id) : next.delete(id);
      return next;
    });
  }

  async function handleUpdate(stepId: string, patch: StepPatch) {
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, ...patch } : s)));
    setSavingId(stepId, true);
    try {
      const res = await fetch(`/api/initiative/${pageId}/workflow/${stepId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) await load();
    } catch {
      await load();
    } finally {
      setSavingId(stepId, false);
    }
  }

  async function handleDelete(stepId: string) {
    setSteps((prev) => prev.filter((s) => s.id !== stepId));
    setSavingId(stepId, true);
    try {
      const res = await fetch(`/api/initiative/${pageId}/workflow/${stepId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) await load();
    } catch {
      await load();
    } finally {
      setSavingId(stepId, false);
    }
  }

  async function handleAddStep() {
    setAddingStep(true);
    try {
      const res = await fetch(`/api/initiative/${pageId}/workflow`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const step = await res.json();
        setSteps((prev) => [
          ...prev,
          { ...step, assignees: step.assignees ?? [], assignmentMode: step.assignmentMode ?? "sequential" },
        ]);
      }
    } finally {
      setAddingStep(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = steps.findIndex((s) => s.id === active.id);
    const newIdx = steps.findIndex((s) => s.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;

    const reordered = arrayMove(steps, oldIdx, newIdx).map((s, i) => ({ ...s, sequence: i + 1 }));
    setSteps(reordered);

    fetch(`/api/initiative/${pageId}/workflow/reorder`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps: reordered.map((s) => ({ id: s.id, sequence: s.sequence })) }),
    }).catch(() => load());
  }

  async function handleAddAssignee(stepId: string, collaborationId: string) {
    try {
      const res = await fetch(`/api/initiative/${pageId}/workflow/${stepId}/assignees`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collaborationId }),
      });
      if (res.ok) {
        const created = await res.json();
        setSteps((prev) =>
          prev.map((s) =>
            s.id === stepId ? { ...s, assignees: [...s.assignees, created] } : s
          )
        );
      }
    } catch {
      /* silent — user can retry */
    }
  }

  async function handleRemoveAssignee(stepId: string, assigneeId: string) {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === stepId
          ? { ...s, assignees: s.assignees.filter((a) => a.id !== assigneeId).map((a, i) => ({ ...a, sequence: i + 1 })) }
          : s
      )
    );
    try {
      await fetch(`/api/initiative/${pageId}/workflow/${stepId}/assignees/${assigneeId}`, {
        method: "DELETE",
        credentials: "include",
      });
    } catch {
      await load();
    }
  }

  function handleUpdateAssigneePricing(stepId: string, assigneeId: string, patch: PricingPatch) {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === stepId
          ? { ...s, assignees: s.assignees.map((a) => (a.id === assigneeId ? { ...a, ...patch } : a)) }
          : s
      )
    );
    fetch(`/api/initiative/${pageId}/workflow/${stepId}/assignees/${assigneeId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {/* silent — optimistic update already applied */});
  }

  function handleReorderAssignees(stepId: string, activeId: string, overId: string) {
    let reordered: StepAssignee[] = [];

    setSteps((prev) =>
      prev.map((s) => {
        if (s.id !== stepId) return s;
        const oldIdx = s.assignees.findIndex((a) => a.id === activeId);
        const newIdx = s.assignees.findIndex((a) => a.id === overId);
        if (oldIdx === -1 || newIdx === -1) return s;
        reordered = arrayMove(s.assignees, oldIdx, newIdx).map((a, i) => ({ ...a, sequence: i + 1 }));
        return { ...s, assignees: reordered };
      })
    );

    if (reordered.length > 0) {
      fetch(`/api/initiative/${pageId}/workflow/${stepId}/assignees/reorder`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignees: reordered.map((a) => ({ id: a.id, sequence: a.sequence })) }),
      }).catch(() => load());
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12 text-gray-600">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl border border-red-900/40 bg-red-900/10 text-red-400 text-sm flex items-center gap-3">
        <span>{error}</span>
        <button onClick={load} className="underline text-red-300 shrink-0">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">
        Workflow Steps ({steps.length})
      </p>

      <DndContext
        sensors={outerSensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {steps.map((step) => (
              <StepCard
                key={step.id}
                step={step}
                availableCollabs={availableCollabs}
                pageId={pageId}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onAddAssignee={handleAddAssignee}
                onRemoveAssignee={handleRemoveAssignee}
                onUpdateAssigneePricing={handleUpdateAssigneePricing}
                onReorderAssignees={handleReorderAssignees}
                isSaving={saving.has(step.id)}
                canEdit={canEdit}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {steps.length === 0 && (
        <div className="py-8 text-center text-gray-500 text-sm border border-dashed border-gray-800 rounded-xl">
          No steps defined yet.
        </div>
      )}

      {canEdit && (
        <button
          onClick={handleAddStep}
          disabled={addingStep}
          className="flex items-center justify-center gap-2 w-full py-2.5 mt-1 rounded-xl border border-dashed border-gray-700 text-sm text-gray-400 hover:border-indigo-600 hover:text-indigo-400 transition-colors disabled:opacity-50"
        >
          {addingStep ? <Spinner /> : <span className="text-base leading-none">+</span>}
          Add Step
        </button>
      )}
    </div>
  );
}
