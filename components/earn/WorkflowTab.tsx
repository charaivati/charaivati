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
  activityType: string;
  assignees: StepAssignee[];
};

type StepPatch = Partial<
  Pick<WorkflowStep, "name" | "assigneeId" | "assigneeType" | "quoteRequired" | "quoteTimeoutHours" | "assignmentMode" | "activityType">
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
      style={{ ...style, padding: "10px" }}
      className="rounded-md bg-gray-800/40"
    >
      {/* Line 1: drag handle + partner name + edit icon + remove */}
      <div className="flex items-center gap-2">
        {canEdit && <DragHandle {...attributes} {...listeners} />}
        <span className="flex-1 text-sm text-white truncate min-w-0">{assignee.displayName}</span>
        {savedFeedback && <span className="text-xs text-green-400 shrink-0">✓</span>}
        {canEdit && (
          <button
            onClick={() => setPricingOpen((o) => !o)}
            className={`shrink-0 p-0.5 transition-colors ${pricingOpen ? "text-indigo-400" : "text-gray-500 hover:text-gray-300"}`}
            aria-label="Edit pricing"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
        {canEdit && (
          <button
            onClick={() => onRemove(assignee.id)}
            className="text-gray-600 hover:text-red-400 transition-colors shrink-0 p-0.5"
            aria-label="Remove assignee"
          >
            ×
          </button>
        )}
      </div>

      {/* Line 2: always-visible price per order */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-500">Price per order</span>
        <span className="text-xs text-white font-medium shrink-0 ml-2">
          {assignee.costPerOrder != null ? `₹${assignee.costPerOrder}` : "—"}
        </span>
      </div>

      {/* Expanded pricing panel */}
      {pricingOpen && (
        <div className="mt-2 pt-2 border-t border-gray-700/50 grid grid-cols-2 gap-x-3 gap-y-2">
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
    <div className="space-y-2">
      {/* Partner cards */}
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
            <div className="space-y-2">
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
            className="w-full min-h-[44px] rounded-lg border border-dashed border-gray-700 flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:border-indigo-600 hover:text-indigo-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="text-base leading-none">+</span>
            Add partner
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

  const dragStyle = {
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
  const activityType   = step.activityType   ?? "normal";

  return (
    <div
      ref={setNodeRef}
      style={{ ...dragStyle, border: "0.5px solid rgba(75, 85, 99, 0.45)", padding: "14px" }}
      className="rounded-xl bg-gray-900/60 space-y-3"
    >
      {/* Header row: drag handle + number + name + spinner + delete */}
      <div className="flex items-center gap-2">
        {canEdit && <DragHandle {...attributes} {...listeners} />}
        <span className="text-xs text-gray-500 font-mono shrink-0 select-none">
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
            className="flex-1 min-w-0 bg-transparent border-b border-indigo-500 text-sm font-medium text-white outline-none py-0.5"
          />
        ) : (
          <button
            onClick={() => canEdit && setEditingName(true)}
            className={`flex-1 min-w-0 text-sm font-medium text-white text-left truncate ${canEdit ? "hover:text-indigo-300" : "cursor-default"}`}
          >
            {step.name}
          </button>
        )}
        {isSaving && <Spinner />}
        {canEdit && (
          confirmDel ? (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onDelete(step.id)}
                className="text-xs px-2 py-1 rounded-md bg-red-900/50 text-red-400 border border-red-800/50 hover:bg-red-900 transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmDel(false)}
                className="text-xs px-1 py-1 rounded-md border border-gray-700 text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDel(true)}
              disabled={isSaving}
              className="text-gray-600 hover:text-red-400 transition-colors shrink-0 p-1 disabled:opacity-50"
              aria-label="Delete step"
            >
              ✕
            </button>
          )
        )}
      </div>

      {/* Mode selector: two full-width pills */}
      {canEdit && (
        <div className="flex gap-1.5">
          {(["sequential", "first_to_accept"] as const).map((mode) => (
            <button
              key={mode}
              disabled={isSaving}
              onClick={() => assignmentMode !== mode && onUpdate(step.id, { assignmentMode: mode })}
              className={`flex-1 text-xs py-2 rounded-full transition-colors disabled:opacity-50 ${
                assignmentMode === mode
                  ? "bg-[#534AB7] text-white"
                  : "bg-gray-800 text-gray-400"
              }`}
            >
              {mode === "sequential" ? "Sequential" : "First to Accept"}
            </button>
          ))}
        </div>
      )}

      {/* Step type selector */}
      {canEdit && (
        <div className="space-y-1.5">
          <div className="flex gap-1.5">
            {(["normal", "delivery"] as const).map((type) => (
              <button
                key={type}
                disabled={isSaving}
                onClick={() => activityType !== type && onUpdate(step.id, { activityType: type })}
                className={`flex-1 text-xs py-2 rounded-full transition-colors disabled:opacity-50 ${
                  activityType === type
                    ? type === "delivery" ? "bg-emerald-700 text-white" : "bg-[#534AB7] text-white"
                    : "bg-gray-800 text-gray-400"
                }`}
              >
                {type === "normal" ? "Normal work" : "Delivery (GPS)"}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-600">
            {activityType === "delivery"
              ? "Delivery steps assign a courier and share live GPS with the customer."
              : "Normal steps just need a completion tap."}
          </p>
        </div>
      )}

      {/* Partner rows */}
      <AssigneeSection
        step={step}
        availableCollabs={availableCollabs}
        canEdit={canEdit}
        onAdd={(collabId) => onAddAssignee(step.id, collabId)}
        onRemove={(assigneeId) => onRemoveAssignee(step.id, assigneeId)}
        onPricingUpdate={(assigneeId, patch) => onUpdateAssigneePricing(step.id, assigneeId, patch)}
        onReorder={(activeId, overId) => onReorderAssignees(step.id, activeId, overId)}
      />

      {/* Quote required toggle */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-800/60">
        <span className="text-sm text-gray-400">Quote required</span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            role="switch"
            aria-checked={step.quoteRequired}
            disabled={isSaving || !canEdit}
            onClick={() => canEdit && onUpdate(step.id, { quoteRequired: !step.quoteRequired })}
            className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${
              step.quoteRequired ? "bg-[#534AB7]" : "bg-gray-700"
            } disabled:opacity-50`}
          >
            <span
              className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                step.quoteRequired ? "translate-x-[18px]" : "translate-x-0.5"
              }`}
            />
          </button>
          {step.quoteRequired && (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                defaultValue={step.quoteTimeoutHours}
                disabled={isSaving || !canEdit}
                onChange={(e) => handleTimeoutInput(e.target.value)}
                className="w-14 text-xs bg-gray-950 border border-gray-700 rounded-lg px-2 py-1 text-white outline-none disabled:opacity-50"
              />
              <span className="text-xs text-gray-500">hrs</span>
            </div>
          )}
        </div>
      </div>

      {/* Legacy assigneeId notice */}
      {step.assigneeId && (
        <p className="text-xs text-amber-500/80 border border-amber-900/40 rounded-lg px-2 py-1.5 bg-amber-900/10">
          Legacy assignee set — add partners above to use the new system.
        </p>
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
          activityType: s.activityType ?? "normal",
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
          { ...step, assignees: step.assignees ?? [], assignmentMode: step.assignmentMode ?? "sequential", activityType: step.activityType ?? "normal" },
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
          <div className="flex flex-col gap-[10px]">
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
