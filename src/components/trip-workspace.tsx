"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { useFormDirty } from "@/src/components/use-form-dirty";
import { BlockingSaveOverlay, useBlockingSubmit } from "@/src/components/bottom-sheet";
import { ChecklistActionPopover } from "@/src/components/checklist-action-popover";
import { FormErrorDialog } from "@/src/components/form-error-dialog";
import { ChecklistCategoryIcon } from "@/src/components/checklist-category-icon";
import { TripSectionHeading } from "@/src/components/trip-section-heading";
import { TripSectionEmpty } from "@/src/components/trip-section-empty";
import { TripSectionSkeleton } from "@/src/components/trip-section-skeleton";
import {
  AttachmentPreviewOverlay,
  type AttachmentMediaPreview,
} from "@/src/components/attachment-preview-overlay";
import {
  MAX_SOURCE_IMAGE_BYTES,
  prepareDocumentFile,
} from "@/src/lib/client-image-compression";
import { uploadPrivateDocument } from "@/src/lib/client-blob-upload";
import { scrollPageToTopAfterOverlay } from "@/src/lib/client-scroll";
import {
  flightResourceKey,
  insuranceResourceKey,
  invalidateClientResource,
  loadClientResource,
  MASTER_CHECKLIST_RESOURCE_KEY,
  peekClientResource,
  workspaceResourceKey,
} from "@/src/lib/client-resource-cache";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Circle,
  Download,
  Eye,
  FileText,
  ListChecks,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  UserPlus,
  X,
} from "lucide-react";

type Member = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: "owner" | "collaborator";
};
type MasterCategory = {
  id: string;
  name: string;
  icon_key: string | null;
  sort_order: number;
};
type MasterItem = {
  id: string;
  category_id: string;
  title: string;
  sort_order: number;
};
type Checklist = {
  id: string;
  title: string;
  master_item_id: string | null;
  category_name: string;
  category_icon_key: string | null;
  assigned_user_id: string | null;
  assigned_name: string | null;
  assigned_avatar_url: string | null;
  completed_at: string | null;
  created_by: string;
  created_by_name: string | null;
};
type DocumentItem = {
  id: string;
  title: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  created_at: string;
  uploaded_by_name: string | null;
};
type Activity = {
  id: string;
  entity_type: string;
  action: string;
  summary: string;
  created_at: string;
  undone_at: string | null;
  actor_name: string | null;
  can_undo: boolean;
};
type Workspace = {
  checklist: Checklist[];
  masterCategories: MasterCategory[];
  masterItems: MasterItem[];
  documents: DocumentItem[];
  activities: Activity[];
  members: Member[];
  currentUserId: string;
  role: "owner" | "admin" | "view";
  documentUploadMode: "client" | "server";
  documentQuotaBytes: number;
  documentUsageBytes: number;
};
type WorkspaceDeleteTarget =
  | { kind: "item"; item: Checklist }
  | { kind: "category"; category: string; items: Checklist[] }
  | { kind: "document"; item: DocumentItem };

const EMPTY: Workspace = {
  checklist: [],
  masterCategories: [],
  masterItems: [],
  documents: [],
  activities: [],
  members: [],
  currentUserId: "",
  role: "view",
  documentUploadMode: "server",
  documentQuotaBytes: 100 * 1024 * 1024,
  documentUsageBytes: 0,
};
const offlineKey = (tripId: string) => `bn-trip-offline-documents:${tripId}`;
const tripCategoryValue = (name: string) => `trip:${name}`;
const checklistCategoryPayload = (value: string) =>
  value.startsWith("trip:")
    ? { categoryName: value.slice(5) }
    : { categoryId: value };
const defaultChecklistCategory = (workspace: Workspace) =>
  workspace.masterCategories[0]?.id ||
  (workspace.checklist[0]?.category_name
    ? tripCategoryValue(workspace.checklist[0].category_name)
    : "");
const ownerLast = (members: Member[]) =>
  [...members].sort(
    (left, right) => Number(left.role === "owner") - Number(right.role === "owner"),
  );

export function TripWorkspace({
  tripId,
  label,
  initialTab = "checklist",
  onDocumentsChanged,
}: {
  tripId: string;
  label: (value: string) => string;
  initialTab?: "checklist" | "documents";
  onDocumentsChanged?: () => void | Promise<void>;
}) {
  const { saving: saveInFlight, guard: guardSave } = useBlockingSubmit();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workspaceReturnTo = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`;
  const initialCachedWorkspace = peekClientResource<Partial<Workspace>>(
    workspaceResourceKey(tripId, initialTab),
  );
  const [data, setData] = useState<Workspace>(() => ({
    ...EMPTY,
    ...(initialCachedWorkspace || {}),
  }));
  const orderedMembers = ownerLast(data.members);
  const [tab, setTab] = useState<"checklist" | "documents">(initialTab);
  const [loading, setLoading] = useState(!initialCachedWorkspace);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [assignee, setAssignee] = useState("");
  const [busy, setBusy] = useState("");
  const [offlineIds, setOfflineIds] = useState<string[]>([]);
  const [masterOpen, setMasterOpen] = useState(false);
  const [checklistSheetOpen, setChecklistSheetOpen] = useState(false);
  const [documentSheetOpen, setDocumentSheetOpen] = useState(false);
  const [checklistSearch, setChecklistSearch] = useState("");
  const [documentSearch, setDocumentSearch] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentFileName, setDocumentFileName] = useState("");
  const [editingDocument, setEditingDocument] = useState<DocumentItem | null>(
    null,
  );
  const [editingDocumentTitle, setEditingDocumentTitle] = useState("");
  const [editingDocumentFileName, setEditingDocumentFileName] = useState("");
  const [documentPreview, setDocumentPreview] =
    useState<AttachmentMediaPreview | null>(null);
  const [assigningItemId, setAssigningItemId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [openChecklistActionMenu, setOpenChecklistActionMenu] = useState<
    string | null
  >(null);
  const [checklistActionAnchor, setChecklistActionAnchor] =
    useState<HTMLElement | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<WorkspaceDeleteTarget | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    () => new Set(),
  );
  const [collapsedMasterCategories, setCollapsedMasterCategories] = useState<
    Set<string>
  >(() => new Set());
  const [selectedMaster, setSelectedMaster] = useState<string[]>([]);
  const assignmentTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const editDocumentFileRef = useRef<HTMLInputElement>(null);
  const {
    formRef: checklistFormRef,
    checkForChanges: checkChecklistChanges,
  } = useFormDirty(
    `${checklistSheetOpen}:${editingItemId || "new"}`,
  );
  const {
    formRef: documentEditFormRef,
    checkForChanges: checkDocumentEditChanges,
  } = useFormDirty(
    `document-edit:${editingDocument?.id || "closed"}`,
  );
  const {
    formRef: documentCreateFormRef,
    checkForChanges: checkDocumentCreateChanges,
  } = useFormDirty(
    `document-create:${documentSheetOpen}`,
  );
  function notify(value: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(value);
    toastTimer.current = setTimeout(() => {
      setToast("");
      toastTimer.current = null;
    }, 2200);
  }
  function signalCompletionChanged() {
    window.dispatchEvent(
      new CustomEvent("trip-completion-changed", { detail: { tripId } }),
    );
  }
  async function syncDocumentConsumers() {
    signalCompletionChanged();
    try {
      await onDocumentsChanged?.();
    } catch {
      // The document is already saved. A later trip refresh will retry the
      // supplemental Timeline sync without showing a false save error.
    }
  }
  function invalidateWorkspaceTabs(
    ...tabs: Array<"checklist" | "documents" | "history">
  ) {
    invalidateClientResource(
      ...tabs.map((targetTab) => workspaceResourceKey(tripId, targetTab)),
    );
  }
  function syncCollapsedChecklistCategories(workspace: Workspace) {
    const totals = new Map<string, number>();
    const completed = new Map<string, number>();
    workspace.checklist.forEach((item) => {
      const category = item.category_name || "อื่น ๆ";
      totals.set(category, (totals.get(category) || 0) + 1);
      if (item.completed_at)
        completed.set(category, (completed.get(category) || 0) + 1);
    });
    setCollapsedCategories(
      new Set(
        [...totals.keys()].filter(
          (category) => completed.get(category) === totals.get(category),
        ),
      ),
    );
  }
  async function load(
    targetTab: "checklist" | "documents" | "history" = tab,
    force = true,
  ) {
    const resourceKey = workspaceResourceKey(tripId, targetTab);
    const cached = peekClientResource<Partial<Workspace>>(resourceKey);
    if (!cached) setLoading(true);
    setError("");
    try {
      const body = await loadClientResource<Partial<Workspace>>(
        resourceKey,
        async () => {
          const response = await fetch(
            `/api/trips/${tripId}/workspace?tab=${targetTab}`,
          );
          const result = await response.json();
          if (!response.ok) throw new Error(result.error);
          return result as Partial<Workspace>;
        },
        force,
      );
      if (targetTab === "checklist") {
        syncCollapsedChecklistCategories({ ...EMPTY, ...body } as Workspace);
        setCategoryId(
          (current) =>
            current || defaultChecklistCategory({ ...EMPTY, ...body } as Workspace),
        );
      }
      setData((current) => ({ ...current, ...body }) as Workspace);
      if (targetTab === "documents")
        setOfflineIds(
          JSON.parse(localStorage.getItem(offlineKey(tripId)) || "[]"),
        );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "โหลดข้อมูลไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setTab(initialTab);
      const cached = peekClientResource<Partial<Workspace>>(
        workspaceResourceKey(tripId, initialTab),
      );
      setData({ ...EMPTY, ...(cached || {}) });
      setLoading(!cached);
      void load(initialTab, false);
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, initialTab]);
  async function json(url: string, options: RequestInit) {
    const response = await fetch(url, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(options.headers || {}),
      },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "บันทึกไม่สำเร็จ");
    return body;
  }
  async function addChecklist(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !categoryId) {
      setError(!title.trim() ? "กรุณากรอกชื่อ Checklist" : "กรุณาเลือกหมวดหมู่ Checklist");
      return;
    }
    const editingItem = data.checklist.find(
      (item) => item.id === editingItemId,
    );
    const busyKey = editingItem?.id || "checklist";
    setBusy(busyKey);
    setError("");
    try {
      await json(
        editingItem
          ? `/api/trips/${tripId}/checklist/${editingItem.id}`
          : `/api/trips/${tripId}/checklist`,
        {
          method: editingItem ? "PATCH" : "POST",
          body: JSON.stringify({
            title: title.trim(),
            ...checklistCategoryPayload(categoryId),
            assignedUserId: assignee || null,
          }),
        },
      );
      setTitle("");
      setAssignee("");
      setEditingItemId(null);
      setChecklistSheetOpen(false);
      scrollPageToTopAfterOverlay();
      invalidateWorkspaceTabs("history");
      invalidateClientResource(MASTER_CHECKLIST_RESOURCE_KEY);
      await load("checklist");
      signalCompletionChanged();
      if (editingItem) notify("แก้ไข Checklist แล้ว");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  }
  async function importMaster() {
    if (!selectedMaster.length) return;
    setBusy("master");
    setError("");
    try {
      await json(`/api/trips/${tripId}/checklist`, {
        method: "POST",
        body: JSON.stringify({ masterItemIds: selectedMaster }),
      });
      setSelectedMaster([]);
      setMasterOpen(false);
      scrollPageToTopAfterOverlay();
      invalidateWorkspaceTabs("history");
      await load("checklist");
      signalCompletionChanged();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "นำเข้ารายการไม่สำเร็จ",
      );
    } finally {
      setBusy("");
    }
  }
  async function patchChecklist(
    item: Checklist,
    input: Record<string, unknown>,
  ) {
    setBusy(item.id);
    setError("");
    const optimisticCompleted =
      typeof input.completed === "boolean"
        ? input.completed
          ? new Date().toISOString()
          : null
        : item.completed_at;
    startTransition(() =>
      setData((current) => ({
        ...current,
        checklist: current.checklist.map((entry) =>
          entry.id === item.id
            ? { ...entry, completed_at: optimisticCompleted }
            : entry,
        ),
      })),
    );
    try {
      await json(`/api/trips/${tripId}/checklist/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      invalidateWorkspaceTabs("checklist", "history");
      if ("title" in input || "categoryId" in input || "categoryName" in input)
        invalidateClientResource(MASTER_CHECKLIST_RESOURCE_KEY);
      if ("completed" in input) signalCompletionChanged();
    } catch (reason) {
      setData((current) => ({
        ...current,
        checklist: current.checklist.map((entry) =>
          entry.id === item.id ? item : entry,
        ),
      }));
      setError(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  }
  function assignChecklist(item: Checklist, member: Member | null) {
    const previous = item;
    const assignedUserId = member?.id || null;
    startTransition(() =>
      setData((current) => ({
        ...current,
        checklist: current.checklist.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                assigned_user_id: assignedUserId,
                assigned_name: member?.display_name || member?.email || null,
                assigned_avatar_url: member?.avatar_url || null,
              }
            : entry,
        ),
      })),
    );
    setAssigningItemId(null);
    const existingTimer = assignmentTimers.current.get(item.id);
    if (existingTimer) clearTimeout(existingTimer);
    const timer = setTimeout(async () => {
      assignmentTimers.current.delete(item.id);
      try {
        await json(`/api/trips/${tripId}/checklist/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ assignedUserId }),
        });
        invalidateWorkspaceTabs("checklist", "history");
      } catch (reason) {
        setData((current) => ({
          ...current,
          checklist: current.checklist.map((entry) =>
            entry.id === item.id ? previous : entry,
          ),
        }));
        setError(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ");
      }
    }, 450);
    assignmentTimers.current.set(item.id, timer);
  }
  async function deleteChecklist(item: Checklist) {
    setBusy(item.id);
    setError("");
    const originalIndex = data.checklist.findIndex(
      (entry) => entry.id === item.id,
    );
    setData((current) => ({
      ...current,
      checklist: current.checklist.filter((entry) => entry.id !== item.id),
    }));
    try {
      await json(`/api/trips/${tripId}/checklist/${item.id}`, {
        method: "DELETE",
      });
      setDeleteTarget(null);
      setEditingItemId(null);
      setChecklistSheetOpen(false);
      setTitle("");
      setAssignee("");
      invalidateWorkspaceTabs("checklist", "history");
      signalCompletionChanged();
      notify("ลบ Checklist แล้ว");
    } catch (reason) {
      setData((current) => {
        if (current.checklist.some((entry) => entry.id === item.id))
          return current;
        const checklist = [...current.checklist];
        checklist.splice(
          Math.max(0, Math.min(originalIndex, checklist.length)),
          0,
          item,
        );
        return { ...current, checklist };
      });
      setError(reason instanceof Error ? reason.message : "ลบไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  }
  async function deleteChecklistCategory(
    category: string,
    categoryItems: Checklist[],
  ) {
    if (!categoryItems.length) return;
    setBusy(`category:${category}`);
    setError("");
    const removedIds = new Set(categoryItems.map((item) => item.id));
    setData((current) => ({
      ...current,
      checklist: current.checklist.filter((item) => !removedIds.has(item.id)),
    }));
    try {
      await json(`/api/trips/${tripId}/checklist`, {
        method: "DELETE",
        body: JSON.stringify({ categoryName: category }),
      });
      setDeleteTarget(null);
      invalidateWorkspaceTabs("checklist", "history");
      signalCompletionChanged();
      notify("ลบหมวด Checklist แล้ว");
    } catch (reason) {
      setData((current) => ({
        ...current,
        checklist: [...current.checklist, ...categoryItems].sort(
          (a, b) =>
            data.checklist.findIndex((item) => item.id === a.id) -
            data.checklist.findIndex((item) => item.id === b.id),
        ),
      }));
      setError(reason instanceof Error ? reason.message : "ลบไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  }
  async function uploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const sourceFile = fileRef.current?.files?.[0];
    const documentTitle = String(form.get("title") || "").trim();
    if (!sourceFile) {
      setError("กรุณาเลือกรูปหรือไฟล์ที่ต้องการอัปโหลด");
      return;
    }
    const sourceLimit =
      sourceFile.type === "application/pdf"
        ? 10 * 1024 * 1024
        : MAX_SOURCE_IMAGE_BYTES;
    if (sourceFile.size > sourceLimit) {
      setError(
        sourceFile.type === "application/pdf"
          ? "PDF ต้องมีขนาดไม่เกิน 10 MB"
          : "รูปต้นฉบับต้องมีขนาดไม่เกิน 20 MB",
      );
      return;
    }
    setBusy("document");
    setError("");
    try {
      const file = await prepareDocumentFile(sourceFile);
      const limit =
        file.type === "application/pdf" ? 10 * 1024 * 1024 : 3 * 1024 * 1024;
      if (file.size > limit)
        throw new Error(
          file.type === "application/pdf"
            ? "PDF ต้องมีขนาดไม่เกิน 10 MB"
            : "ไม่สามารถลดรูปให้ต่ำกว่า 3 MB ได้ กรุณาเลือกรูปอื่น",
        );
      if (data.documentUsageBytes + file.size > data.documentQuotaBytes)
        throw new Error("พื้นที่เอกสารของทริปเต็มแล้ว (สูงสุด 100 MB)");
      form.set("file", file);
      if (data.documentUploadMode === "client") {
        const extension =
          file.name
            .split(".")
            .pop()
            ?.toLowerCase()
            .replace(/[^a-z0-9]/g, "") || "bin";
        const pathname = `documents/${tripId}/doc-${crypto.randomUUID()}.${extension}`;
        const blob = await uploadPrivateDocument({tripId,pathname,file});
        await json(`/api/trips/${tripId}/documents`, {
          method: "POST",
          body: JSON.stringify({
            title: documentTitle,
            originalFilename: file.name,
            mimeType: file.type,
            size: file.size,
            blobUrl: blob.url,
            pathname: blob.pathname,
          }),
        });
      } else {
        const response = await fetch(`/api/trips/${tripId}/documents`, {
          method: "POST",
          body: form,
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
      }
      formElement.reset();
      setDocumentTitle("");
      setDocumentFileName("");
      setDocumentSheetOpen(false);
      scrollPageToTopAfterOverlay();
      invalidateWorkspaceTabs("history");
      invalidateClientResource(
        flightResourceKey(tripId),
        insuranceResourceKey(tripId),
      );
      await load("documents");
      await syncDocumentConsumers();
      notify("อัปโหลดไฟล์แล้ว");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  }
  async function deleteDocument(item: DocumentItem) {
    setBusy(item.id);
    setError("");
    setData((current) => ({
      ...current,
      documents: current.documents.filter((entry) => entry.id !== item.id),
      documentUsageBytes: Math.max(
        0,
        current.documentUsageBytes - Number(item.file_size),
      ),
    }));
    try {
      await json(`/api/trips/${tripId}/documents/${item.id}`, {
        method: "DELETE",
      });
      await removeOffline(item);
      setDeleteTarget(null);
      setEditingDocument(null);
      invalidateWorkspaceTabs("documents", "history");
      invalidateClientResource(
        flightResourceKey(tripId),
        insuranceResourceKey(tripId),
      );
      await syncDocumentConsumers();
      notify("ลบไฟล์แล้ว");
    } catch (reason) {
      await load("documents");
      setError(reason instanceof Error ? reason.message : "ลบไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  }
  async function saveDocumentEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingDocument) return;
    if (!editingDocumentTitle.trim()) {
      setError("กรุณากรอกชื่อไฟล์");
      return;
    }
    const sourceFile = editDocumentFileRef.current?.files?.[0];
    if (sourceFile) {
      const sourceLimit =
        sourceFile.type === "application/pdf"
          ? 10 * 1024 * 1024
          : MAX_SOURCE_IMAGE_BYTES;
      if (sourceFile.size > sourceLimit) {
        setError(
          sourceFile.type === "application/pdf"
            ? "PDF ต้องมีขนาดไม่เกิน 10 MB"
            : "รูปต้นฉบับต้องมีขนาดไม่เกิน 20 MB",
        );
        return;
      }
    }
    setBusy(`document:${editingDocument.id}`);
    setError("");
    try {
      const file = sourceFile
        ? await prepareDocumentFile(sourceFile)
        : undefined;
      if (file) {
        const limit =
          file.type === "application/pdf" ? 10 * 1024 * 1024 : 3 * 1024 * 1024;
        if (file.size > limit)
          throw new Error(
            file.type === "application/pdf"
              ? "PDF ต้องมีขนาดไม่เกิน 10 MB"
              : "ไม่สามารถลดรูปให้ต่ำกว่า 3 MB ได้ กรุณาเลือกรูปอื่น",
          );
        if (
          data.documentUsageBytes - Number(editingDocument.file_size) + file.size >
          data.documentQuotaBytes
        )
          throw new Error("พื้นที่เอกสารของทริปเต็มแล้ว (สูงสุด 100 MB)");
      }
      if (file && data.documentUploadMode === "client") {
        const extension =
          file.name
            .split(".")
            .pop()
            ?.toLowerCase()
            .replace(/[^a-z0-9]/g, "") || "bin";
        const pathname = `documents/${tripId}/doc-${crypto.randomUUID()}.${extension}`;
        const blob = await uploadPrivateDocument({tripId,pathname,file,replaceDocumentId:editingDocument.id});
        await json(
          `/api/trips/${tripId}/documents/${editingDocument.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              title: editingDocumentTitle.trim(),
              originalFilename: file.name,
              mimeType: file.type,
              size: file.size,
              blobUrl: blob.url,
              pathname: blob.pathname,
            }),
          },
        );
      } else if (data.documentUploadMode === "server") {
        const form = new FormData();
        form.set("title", editingDocumentTitle.trim());
        if (file) form.set("file", file);
        const response = await fetch(
          `/api/trips/${tripId}/documents/${editingDocument.id}`,
          { method: "PATCH", body: form },
        );
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
      } else {
        await json(
          `/api/trips/${tripId}/documents/${editingDocument.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({ title: editingDocumentTitle.trim() }),
          },
        );
      }
      if (file) await removeOffline(editingDocument);
      setEditingDocument(null);
      setEditingDocumentFileName("");
      scrollPageToTopAfterOverlay();
      invalidateWorkspaceTabs("history");
      invalidateClientResource(
        flightResourceKey(tripId),
        insuranceResourceKey(tripId),
      );
      await load("documents");
      await syncDocumentConsumers();
      notify("แก้ไขไฟล์แล้ว");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "แก้ไขเอกสารไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  }
  function fileUrl(item: DocumentItem) {
    return `/api/trips/${tripId}/documents/${item.id}/file`;
  }
  async function saveOffline(item: DocumentItem) {
    setBusy(item.id);
    try {
      const response = await fetch(fileUrl(item), { credentials: "include" });
      if (!response.ok) throw new Error("ดาวน์โหลดเอกสารไม่สำเร็จ");
      const cache = await caches.open("bn-trip-private-documents-v1");
      await cache.put(fileUrl(item), response.clone());
      const next = [...new Set([...offlineIds, item.id])];
      setOfflineIds(next);
      localStorage.setItem(offlineKey(tripId), JSON.stringify(next));
      notify("ดาวน์โหลดเอกสารออฟไลน์สำเร็จแล้ว");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ดาวน์โหลดไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  }
  async function removeOffline(item: DocumentItem) {
    const cache = await caches.open("bn-trip-private-documents-v1");
    await cache.delete(fileUrl(item));
    const next = offlineIds.filter((id) => id !== item.id);
    setOfflineIds(next);
    localStorage.setItem(offlineKey(tripId), JSON.stringify(next));
  }
  useEffect(() => {
    if (
      !checklistSheetOpen &&
      !documentSheetOpen &&
      !editingDocument &&
      !masterOpen &&
      !assigningItemId &&
      !editingItemId
    )
      return;
    const root = document.documentElement;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setChecklistSheetOpen(false);
        setDocumentSheetOpen(false);
        setEditingDocument(null);
        setMasterOpen(false);
        setAssigningItemId(null);
        setEditingItemId(null);
      }
    };
    root.classList.add("sheet-open");
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      root.classList.remove("sheet-open");
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [
    checklistSheetOpen,
    documentSheetOpen,
    editingDocument,
    masterOpen,
    assigningItemId,
    editingItemId,
  ]);
  useEffect(() => {
    if (!deleteTarget) return;
    const root = document.documentElement;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDeleteTarget(null);
    };
    root.classList.add("confirm-open");
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      root.classList.remove("confirm-open");
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [deleteTarget]);
  useEffect(
    () => () => {
      assignmentTimers.current.forEach((timer) => clearTimeout(timer));
      assignmentTimers.current.clear();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (!openChecklistActionMenu) return;
    const close = (event: PointerEvent) => {
      if (
        !(event.target as HTMLElement).closest(
          ".checklist-action-menu-wrap, .checklist-action-popover",
        )
      ) {
        setOpenChecklistActionMenu(null);
        setChecklistActionAnchor(null);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [openChecklistActionMenu]);
  const deferredChecklistSearch = useDeferredValue(checklistSearch);
  const checklistKeyword = deferredChecklistSearch
    .trim()
    .toLocaleLowerCase("th");
  const checklistView = useMemo(() => {
    const groups = new Map<string, Checklist[]>();
    const visibleGroups = new Map<string, Checklist[]>();
    const completed = new Map<string, number>();
    for (const item of data.checklist) {
      const category = item.category_name || "อื่น ๆ";
      const categoryItems = groups.get(category);
      if (categoryItems) categoryItems.push(item);
      else groups.set(category, [item]);
      if (item.completed_at)
        completed.set(category, (completed.get(category) || 0) + 1);
      if (
        !checklistKeyword ||
        `${item.title} ${category}`
          .toLocaleLowerCase("th")
          .includes(checklistKeyword)
      ) {
        const visibleItems = visibleGroups.get(category);
        if (visibleItems) visibleItems.push(item);
        else visibleGroups.set(category, [item]);
      }
    }
    return {
      groups,
      visibleGroups,
      completed,
      categories: [...visibleGroups.keys()],
      allCategories: [...groups.keys()],
    };
  }, [checklistKeyword, data.checklist]);
  const personalCategoryNames = useMemo(
    () =>
      new Set(
        data.masterCategories.map((category) =>
          category.name.toLocaleLowerCase(),
        ),
      ),
    [data.masterCategories],
  );
  const sharedOnlyCategories = useMemo(
    () =>
      checklistView.allCategories.filter(
        (category) => !personalCategoryNames.has(category.toLocaleLowerCase()),
      ),
    [checklistView.allCategories, personalCategoryNames],
  );
  const masterCategoryIconByName = useMemo(
    () =>
      new Map(
        data.masterCategories.map((category) => [
          category.name.toLocaleLowerCase("th"),
          category.icon_key,
        ]),
      ),
    [data.masterCategories],
  );
  const usagePercent = Math.min(
    100,
    data.documentQuotaBytes
      ? (data.documentUsageBytes / data.documentQuotaBytes) * 100
      : 0,
  );
  const quotaLevel =
    usagePercent >= 95
      ? "critical"
      : usagePercent >= 85
        ? "danger"
        : usagePercent >= 70
          ? "warning"
          : "normal";
  const importedIds = useMemo(
    () =>
      new Set(
        data.checklist.map((item) => item.master_item_id).filter(Boolean),
      ),
    [data.checklist],
  );
  const checklistById = useMemo(
    () => new Map(data.checklist.map((item) => [item.id, item])),
    [data.checklist],
  );
  const assigningItem = assigningItemId
    ? checklistById.get(assigningItemId)
    : undefined;
  const editingItem = editingItemId
    ? checklistById.get(editingItemId)
    : undefined;
  const deferredDocumentSearch = useDeferredValue(documentSearch);
  const filteredDocuments = useMemo(() => {
    const keyword = deferredDocumentSearch.trim().toLocaleLowerCase();
    if (!keyword) return data.documents;
    return data.documents.filter((item) =>
      `${item.title} ${item.original_filename}`
        .toLocaleLowerCase()
        .includes(keyword),
    );
  }, [data.documents, deferredDocumentSearch]);
  const masterItemsByCategory = useMemo(() => {
    const grouped = new Map<string, MasterItem[]>();
    for (const item of data.masterItems) {
      const categoryItems = grouped.get(item.category_id);
      if (categoryItems) categoryItems.push(item);
      else grouped.set(item.category_id, [item]);
    }
    return grouped;
  }, [data.masterItems]);
  const availableMasterItemsByCategory = useMemo(() => {
    const available = new Map<string, MasterItem[]>();
    for (const [categoryId, categoryItems] of masterItemsByCategory) {
      const remaining = categoryItems.filter((item) => !importedIds.has(item.id));
      if (remaining.length) available.set(categoryId, remaining);
    }
    return available;
  }, [importedIds, masterItemsByCategory]);
  function toggleCategory(category: string) {
    startTransition(() =>
      setCollapsedCategories((current) => {
        const next = new Set(current);
        if (next.has(category)) next.delete(category);
        else next.add(category);
        return next;
      }),
    );
  }
  function toggleMasterCategory(categoryId: string) {
    startTransition(() =>
      setCollapsedMasterCategories((current) => {
        const next = new Set(current);
        if (next.has(categoryId)) next.delete(categoryId);
        else next.add(categoryId);
        return next;
      }),
    );
  }
  function openDocument(item: DocumentItem) {
    setDocumentPreview({
      url: fileUrl(item),
      title: item.title,
      mimeType: item.mime_type,
    });
  }
  function openMasterChecklist() {
    setError("");
    setChecklistSheetOpen(false);
    setCollapsedMasterCategories(
      new Set(data.masterCategories.map((category) => category.id)),
    );
    setMasterOpen(true);
  }

  return (
    <section className="trip-workspace">
      <BlockingSaveOverlay visible={saveInFlight} />
      {toast &&
        createPortal(
          <div className="toast toast-success" role="status" aria-live="polite">
            <Check size={16} />
            {label(toast)}
          </div>,
          document.body,
        )}
      <TripSectionHeading
        title={label(tab === "checklist" ? "Checklist" : "เอกสารของทริป")}
        subtitle={label(
          tab === "checklist"
            ? "เตรียมสิ่งที่ต้องทำและของที่ต้องใช้ให้พร้อมก่อนเดินทาง"
            : "รวมเอกสารสำคัญของทริปไว้ในที่เดียว",
        )}
        actions={tab === "checklist" ? (
          <>
            <button
              type="button"
              className="trip-section-add"
              disabled={loading}
              onClick={openMasterChecklist}
              aria-label={label("เลือกจาก Master Checklist")}
              title={label("เลือกจาก Master Checklist")}
            >
              <ListChecks size={20} />
              <span>{label("เลือกจาก Master Checklist")}</span>
            </button>
            <button
              type="button"
              className="trip-section-add"
              disabled={loading}
              onClick={() => {
                setError("");
                setMasterOpen(false);
                setEditingItemId(null);
                setTitle("");
                setAssignee("");
                setChecklistSheetOpen(true);
              }}
              aria-label={label("เพิ่ม Checklist")}
              title={label("เพิ่ม Checklist")}
            >
              <Plus size={21} />
              <span>{label("เพิ่ม Checklist")}</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            className="trip-section-add"
            onClick={() => {
              setError("");
              setDocumentSheetOpen(true);
            }}
            disabled={loading || usagePercent >= 100}
            aria-label={label("เพิ่มไฟล์")}
            title={label("เพิ่มไฟล์")}
          >
            <Plus size={21} />
            <span>{label("เพิ่มไฟล์")}</span>
          </button>
        )}
      />
      {error && <p className="workspace-error">{label(error)}</p>}
      {loading ? (
        <TripSectionSkeleton variant={tab === "checklist" ? "checklist" : "documents"} />
      ) : tab === "checklist" ? (
        !data.checklist.length ? (
          <TripSectionEmpty
            icon={<ListChecks size={25} />}
            title={label("Checklist ยังว่างอยู่")}
            description={label("เพิ่มรายการแรกเพื่อเตรียมสิ่งที่ต้องทำและของที่ต้องใช้ก่อนเดินทาง")}
            action={label("เพิ่ม Checklist")}
            onClick={() => {
              setError("");
              setMasterOpen(false);
              setEditingItemId(null);
              setTitle("");
              setAssignee("");
              setChecklistSheetOpen(true);
            }}
          />
        ) : (
        <div className="workspace-panel">
          <div className="checklist-master-actions">
            <label className="document-search checklist-search">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                value={checklistSearch}
                onChange={(event) => setChecklistSearch(event.target.value)}
                placeholder={label("ค้นหา Checklist")}
                aria-label={label("ค้นหา Checklist")}
              />
              {checklistSearch && (
                <button
                  type="button"
                  onClick={() => setChecklistSearch("")}
                  aria-label={label("ล้างการค้นหา")}
                >
                  <X size={16} />
                </button>
              )}
            </label>
          </div>
          <div className="checklist-groups">
            {checklistView.categories.map((category, categoryIndex) => {
              const categoryItems =
                checklistView.groups.get(category) || [];
              const visibleCategoryItems =
                checklistView.visibleGroups.get(category) || [];
              const collapsed = checklistKeyword
                ? false
                : collapsedCategories.has(category);
              const completedCount = checklistView.completed.get(category) || 0;
              const progress = Math.round(
                (completedCount / categoryItems.length) * 100,
              );
              const categoryIcon =
                masterCategoryIconByName.get(
                  category.toLocaleLowerCase("th"),
                ) || categoryItems[0]?.category_icon_key;
              return (
                <section
                  className={`checklist-category-card checklist-tone-${categoryIndex % 4} ${collapsed ? "collapsed" : ""}`}
                  key={category}
                >
                  <div className="checklist-category-head">
                    <button
                      type="button"
                      className="checklist-category-toggle"
                      onClick={() => toggleCategory(category)}
                      aria-expanded={!collapsed}
                    >
                      <i className="checklist-category-icon" aria-hidden="true">
                        <ChecklistCategoryIcon
                          iconKey={categoryIcon}
                          categoryName={category}
                          size={23}
                        />
                      </i>
                      <div className="checklist-category-copy">
                        <strong>{category}</strong>
                        <small>
                          {label(
                            `${completedCount} จาก ${categoryItems.length} รายการ`,
                          )}
                        </small>
                      </div>
                      <div
                        className="checklist-progress-track"
                        aria-label={`${label("Progress")} ${progress}%`}
                      >
                        <span style={{ width: `${progress}%` }} />
                      </div>
                      <b className="checklist-progress-value">{progress}%</b>
                      <ChevronRight className="checklist-category-chevron" size={18} />
                    </button>
                  </div>
                  {!collapsed && (
                    <div className="checklist-list">
                      {visibleCategoryItems.map((item) => (
                        <article
                          className={item.completed_at ? "done" : ""}
                          key={item.id}
                        >
                          <button
                            type="button"
                            className="check-toggle"
                            onClick={() =>
                              void patchChecklist(item, {
                                completed: !item.completed_at,
                              })
                            }
                            disabled={busy === item.id}
                          >
                            {item.completed_at ? (
                              <Check size={15} />
                            ) : (
                              <Circle size={15} />
                            )}
                          </button>
                          <button
                            type="button"
                            className="checklist-title-toggle"
                            disabled={busy === item.id}
                            onClick={() =>
                              void patchChecklist(item, {
                                completed: !item.completed_at,
                              })
                            }
                            aria-pressed={Boolean(item.completed_at)}
                            aria-label={label(
                              item.completed_at
                                ? `ทำเครื่องหมาย ${item.title} ว่ายังไม่เสร็จ`
                                : `ทำเครื่องหมาย ${item.title} ว่าเสร็จแล้ว`,
                            )}
                          >
                            <strong>{item.title}</strong>
                            <small>
                              {label("เพิ่มโดย")}{" "}
                              {item.created_by_name || label("สมาชิกทริป")}
                            </small>
                          </button>
                          <button
                            type="button"
                            className={`checklist-assignee ${item.assigned_user_id ? "assigned" : ""}`}
                            onClick={() => setAssigningItemId(item.id)}
                            aria-label={label(
                              item.assigned_name
                                ? `มอบหมายให้ ${item.assigned_name}`
                                : "เลือกผู้รับผิดชอบ",
                            )}
                            title={
                              item.assigned_name || label("เลือกผู้รับผิดชอบ")
                            }
                          >
                            {item.assigned_avatar_url ? (
                              <span
                                className="member-avatar-image"
                                style={{
                                  backgroundImage: `url("${item.assigned_avatar_url}")`,
                                }}
                              />
                            ) : item.assigned_name ? (
                              <span>{item.assigned_name.slice(0, 1)}</span>
                            ) : (
                              <UserPlus size={15} />
                            )}
                          </button>
                          <div className="checklist-action-menu-wrap">
                            <button
                              type="button"
                              className="checklist-more"
                              onClick={(event) => {
                                const isClosing =
                                  openChecklistActionMenu === item.id;
                                setOpenChecklistActionMenu(
                                  isClosing ? null : item.id,
                                );
                                setChecklistActionAnchor(
                                  isClosing ? null : event.currentTarget,
                                );
                              }}
                              aria-label={label(`เมนู ${item.title}`)}
                              aria-expanded={openChecklistActionMenu === item.id}
                            >
                              <MoreHorizontal size={19} />
                            </button>
                            {openChecklistActionMenu === item.id && (
                              <ChecklistActionPopover
                                anchor={checklistActionAnchor}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    const itemCategory =
                                      data.masterCategories.find(
                                        (masterCategory) =>
                                          masterCategory.name.toLocaleLowerCase() ===
                                          item.category_name.toLocaleLowerCase(),
                                      );
                                    setError("");
                                    setTitle(item.title);
                                    setCategoryId(
                                      itemCategory?.id ||
                                        tripCategoryValue(item.category_name),
                                    );
                                    setAssignee(item.assigned_user_id || "");
                                    setEditingItemId(item.id);
                                    setChecklistSheetOpen(true);
                                    setOpenChecklistActionMenu(null);
                                    setChecklistActionAnchor(null);
                                  }}
                                >
                                  <Pencil size={15} />
                                  {label("แก้ไข")}
                                </button>
                                <button
                                  type="button"
                                  className="danger"
                                  onClick={() => {
                                    setDeleteTarget({ kind: "item", item });
                                    setOpenChecklistActionMenu(null);
                                    setChecklistActionAnchor(null);
                                  }}
                                >
                                  <Trash2 size={15} />
                                  {label("ลบ")}
                                </button>
                              </ChecklistActionPopover>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
            {!checklistView.categories.length && (
              <p className="workspace-empty">
                {label(
                  checklistKeyword
                    ? "ไม่พบ Checklist ที่ค้นหา"
                    : "ยังไม่มี Checklist",
                )}
              </p>
            )}
          </div>
        </div>
        )
      ) : (
        !data.documents.length ? (
          <TripSectionEmpty
            icon={<FileText size={25} />}
            title={label("เอกสารยังว่างอยู่")}
            description={label("เพิ่มตั๋ว ใบจอง หรือเอกสารสำคัญ เพื่อเปิดเครื่องมือจัดการเอกสาร")}
            action={label("เพิ่มเอกสาร")}
            onClick={() => {
              setError("");
              setDocumentSheetOpen(true);
            }}
          />
        ) : (
        <div className="workspace-panel">
          <div className={`document-quota ${quotaLevel}`}>
            <div>
              <strong>{label("พื้นที่เอกสาร")}</strong>
              <span>
                {(data.documentUsageBytes / 1024 / 1024).toFixed(1)} / 100 MB ·{" "}
                {usagePercent.toFixed(0)}%
              </span>
            </div>
            <progress max="100" value={usagePercent} />
            {usagePercent >= 70 && (
              <small>
                {label(
                  usagePercent >= 95
                    ? "พื้นที่ใกล้เต็มมาก กรุณาลบไฟล์ที่ไม่ใช้"
                    : usagePercent >= 85
                      ? "พื้นที่เหลือน้อย กรุณาตรวจสอบไฟล์"
                      : "เริ่มใช้พื้นที่เกิน 70% แล้ว",
                )}
              </small>
            )}
          </div>
          <label className="document-search">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={documentSearch}
              onChange={(event) => setDocumentSearch(event.target.value)}
              placeholder={label("ค้นหาเอกสารหรือชื่อไฟล์")}
              aria-label={label("ค้นหาเอกสารหรือชื่อไฟล์")}
            />
            {documentSearch && (
              <button
                type="button"
                onClick={() => setDocumentSearch("")}
                aria-label={label("ล้างการค้นหา")}
              >
                <X size={16} />
              </button>
            )}
          </label>
          <div className="document-list">
            {filteredDocuments.map((item) => (
              <article key={item.id}>
                <span className="document-type-icon">
                  <FileText size={20} />
                </span>
                <div className="document-list-copy">
                  <strong>{item.title}</strong>
                  <small>
                    {(Number(item.file_size) / 1024 / 1024).toFixed(1)} MB ·{" "}
                    {item.original_filename}
                  </small>
                  <small className="document-meta">
                    {label("เพิ่มโดย")} {item.uploaded_by_name || label("สมาชิกทริป")}
                  </small>
                  <small className="document-meta document-created-at">
                    {new Date(item.created_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </small>
                </div>
                <button
                  type="button"
                  className="document-view-button"
                  onClick={() => openDocument(item)}
                  aria-label={label(`ดูไฟล์ ${item.title}`)}
                  title={label("ดูไฟล์")}
                >
                  <Eye size={16} />
                </button>
                <button
                  type="button"
                  className={
                    offlineIds.includes(item.id) ? "offline-saved" : ""
                  }
                  onClick={() =>
                    void (offlineIds.includes(item.id)
                      ? removeOffline(item)
                      : saveOffline(item))
                  }
                  title={label(
                    offlineIds.includes(item.id)
                      ? "ลบออกจากออฟไลน์"
                      : "เก็บไว้ออฟไลน์",
                  )}
                >
                  <Download size={16} />
                </button>
                {(data.role === "owner" || data.role === "admin") && (
                  <button
                    type="button"
                    className="document-edit-button"
                    onClick={() => {
                      setError("");
                      setEditingDocument(item);
                      setEditingDocumentTitle(item.title);
                      setEditingDocumentFileName("");
                    }}
                    aria-label={label(`แก้ไข ${item.title}`)}
                  >
                    <Pencil size={16} />
                  </button>
                )}
              </article>
            ))}
            {!filteredDocuments.length && (
              <p className="workspace-empty">
                {label(
                  documentSearch
                    ? "ไม่พบเอกสารที่ค้นหา"
                    : "ยังไม่มีเอกสาร",
                )}
              </p>
            )}
          </div>
        </div>
        )
      )}
      {documentPreview && (
        <AttachmentPreviewOverlay
          preview={documentPreview}
          onClose={() => setDocumentPreview(null)}
          closeLabel={label("ปิดตัวอย่างเอกสาร")}
        />
      )}
      {assigningItem && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAssigningItemId(null);
          }}
        >
          <section
            className="modal checklist-assignee-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assignee-sheet-title"
          >
            <div className="modal-head">
              <div>
                <h2 id="assignee-sheet-title">{label("เลือกผู้รับผิดชอบ")}</h2>
                <p>{assigningItem.title}</p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setAssigningItemId(null)}
                aria-label={label("ยกเลิก")}
              >
                <X size={18} />
              </button>
            </div>
            <div className="assignee-member-list">
              <button
                type="button"
                className={!assigningItem.assigned_user_id ? "active" : ""}
                onClick={() => assignChecklist(assigningItem, null)}
              >
                <span className="assignee-empty-avatar">
                  <UserPlus size={17} />
                </span>
                <span>
                  <strong>{label("ยังไม่มอบหมาย")}</strong>
                  <small>{label("นำผู้รับผิดชอบออกจากรายการนี้")}</small>
                </span>
                {!assigningItem.assigned_user_id && <Check size={17} />}
              </button>
              {orderedMembers.map((member) => {
                const selected = assigningItem.assigned_user_id === member.id;
                const memberName =
                  member.display_name || member.email || "Member";
                return (
                  <button
                    type="button"
                    className={selected ? "active" : ""}
                    key={member.id}
                    onClick={() => assignChecklist(assigningItem, member)}
                  >
                    <span
                      className="assignee-member-avatar"
                      style={
                        member.avatar_url
                          ? { backgroundImage: `url("${member.avatar_url}")` }
                          : undefined
                      }
                    >
                      {!member.avatar_url && memberName.slice(0, 1)}
                    </span>
                    <span>
                      <strong>{memberName}</strong>
                      <small>
                        {label(
                          member.role === "owner"
                            ? "เจ้าของทริป"
                            : "ผู้ร่วมทริป",
                        )}
                      </small>
                    </span>
                    {selected && <Check size={17} />}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
      {masterOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMasterOpen(false);
          }}
        >
          <section
            className="modal checklist-master-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="master-sheet-title"
          >
            <div className="modal-head">
              <div>
                <h2 id="master-sheet-title">{label("เลือกจาก Master")}</h2>
                <p>{label("เลือกรายการที่ต้องการเพิ่มเข้าทริปนี้")}</p>
              </div>
              <div className="modal-head-actions">
                <a
                  className="icon-btn"
                  href={`/settings/checklists?returnTo=${encodeURIComponent(workspaceReturnTo)}`}
                  aria-label={label("จัดการ Master")}
                  title={label("จัดการ Master")}
                >
                  <Pencil size={17} />
                </a>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setMasterOpen(false)}
                  aria-label={label("ยกเลิก")}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="master-picker">
              {data.masterCategories.map((category, categoryIndex) => {
                const available =
                  availableMasterItemsByCategory.get(category.id) || [];
                if (!available.length) return null;
                const collapsed = collapsedMasterCategories.has(category.id);
                const availableIds = available.map((item) => item.id);
                const selectedCount = availableIds.filter((id) =>
                  selectedMaster.includes(id),
                ).length;
                const allSelected = selectedCount === availableIds.length;
                return (
                  <section className={`master-picker-category checklist-tone-${categoryIndex % 4}`} key={category.id}>
                    <button
                      type="button"
                      className="master-picker-toggle"
                      onClick={() => toggleMasterCategory(category.id)}
                      aria-expanded={!collapsed}
                    >
                      <i className="checklist-category-icon" aria-hidden="true">
                        <ChecklistCategoryIcon
                          iconKey={category.icon_key}
                          categoryName={category.name}
                          size={18}
                        />
                      </i>
                      <span>
                        <ChevronRight size={15} />
                        <strong>{category.name}</strong>
                      </span>
                      <small>{label(`${available.length} รายการ`)}</small>
                    </button>
                    {!collapsed && (
                      <div className="master-category-items">
                        <label className="master-select-all">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={() =>
                              setSelectedMaster((current) => {
                                const next = new Set(current);
                                if (allSelected)
                                  availableIds.forEach((id) => next.delete(id));
                                else availableIds.forEach((id) => next.add(id));
                                return [...next];
                              })
                            }
                          />
                          <strong>{label("เลือกทั้งหมด")}</strong>
                          <small>
                            {selectedCount}/{available.length}
                          </small>
                        </label>
                        {available.map((item) => (
                          <label key={item.id}>
                            <input
                              type="checkbox"
                              checked={selectedMaster.includes(item.id)}
                              onChange={() =>
                                setSelectedMaster((current) =>
                                  current.includes(item.id)
                                    ? current.filter((id) => id !== item.id)
                                    : [...current, item.id],
                                )
                              }
                            />
                            <span>{item.title}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
              {!availableMasterItemsByCategory.size && (
                <p className="workspace-empty">
                  {label("เพิ่มรายการจาก Master ครบแล้ว")}
                </p>
              )}
            </div>
            {error && <p className="login-error">{label(error)}</p>}
            <div className="modal-submit-actions">
              <button
                type="button"
                className="primary-btn master-import-btn"
                disabled={!selectedMaster.length || busy === "master"}
                onClick={() => void importMaster()}
              >
                <Plus size={15} />
                {label(`เพิ่ม ${selectedMaster.length} รายการเข้าทริป`)}
              </button>
            </div>
          </section>
        </div>
      )}
      {checklistSheetOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setChecklistSheetOpen(false);
              setEditingItemId(null);
            }
          }}
        >
          <form
            ref={checklistFormRef}
            className="modal checklist-add-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="checklist-sheet-title"
            onChange={checkChecklistChanges}
            onSubmit={(event) => guardSave(event, addChecklist)}
          >
            <div className="modal-head">
              <div>
                <h2 id="checklist-sheet-title">
                  {label(editingItem ? "แก้ไข Checklist" : "เพิ่ม Checklist")}
                </h2>
                <p>
                  {label(
                    editingItem
                      ? "แก้ไขชื่อ หมวดหมู่ และผู้รับผิดชอบ"
                      : "รายการที่เพิ่มเองจะบันทึกเข้า Master ของคุณด้วย",
                  )}
                </p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  setChecklistSheetOpen(false);
                  setEditingItemId(null);
                }}
                aria-label={label("ยกเลิก")}
              >
                <X size={18} />
              </button>
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="trip-checklist-title">
                  {label("ชื่อ Checklist")}
                </label>
                <input
                  id="trip-checklist-title"
                  name="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={label(
                    "พิมพ์ Checklist เอง (จะบันทึกเข้า Master ด้วย)",
                  )}
                  required
                  maxLength={240}
                />
              </div>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="trip-checklist-category">
                    {label("หมวดหมู่")}
                  </label>
                  <select
                    id="trip-checklist-category"
                    name="categoryId"
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                    required
                  >
                    <option value="">{label("เลือกหมวดหมู่")}</option>
                    {data.masterCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                    {sharedOnlyCategories.map((category) => (
                      <option
                        key={tripCategoryValue(category)}
                        value={tripCategoryValue(category)}
                      >
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>{label("มอบหมายให้")}</label>
                  <div className="new-checklist-assignees">
                    <input type="hidden" name="assignee" value={assignee} />
                    <button
                      type="button"
                      className={!assignee ? "active" : ""}
                      onClick={() => {
                        setAssignee("");
                        checkChecklistChanges();
                      }}
                      aria-label={label("ยังไม่มอบหมาย")}
                      title={label("ยังไม่มอบหมาย")}
                    >
                      <UserPlus size={16} />
                    </button>
                    {orderedMembers.map((member) => {
                      const memberName =
                        member.display_name || member.email || "Member";
                      return (
                        <button
                          type="button"
                          className={assignee === member.id ? "active" : ""}
                          key={member.id}
                          onClick={() => {
                            setAssignee(member.id);
                            checkChecklistChanges();
                          }}
                          aria-label={`${label("มอบหมายให้")} ${memberName}`}
                          title={memberName}
                          style={
                            member.avatar_url
                              ? {
                                  backgroundImage: `url("${member.avatar_url}")`,
                                }
                              : undefined
                          }
                        >
                          {!member.avatar_url && memberName.slice(0, 1)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            {error && <p className="login-error">{label(error)}</p>}
            <div className="modal-submit-actions checklist-sheet-actions">
              <button
                className="primary-btn"
                disabled={busy === (editingItem?.id || "checklist")}
              >
                {label(
                  busy === (editingItem?.id || "checklist")
                    ? "กำลังบันทึก…"
                    : "บันทึก Checklist",
                )}
              </button>
              {editingItem && (
                <button
                  type="button"
                  className="delete-record-btn"
                  onClick={() =>
                    setDeleteTarget({ kind: "item", item: editingItem })
                  }
                  disabled={busy === editingItem.id}
                  aria-label={label("ลบ Checklist นี้")}
                  title={label("ลบ Checklist นี้")}
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </form>
        </div>
      )}
      {editingDocument && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              busy !== `document:${editingDocument.id}`
            )
              setEditingDocument(null);
          }}
        >
          <form
            ref={documentEditFormRef}
            className="modal document-upload-sheet document-edit-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="document-edit-title"
            onChange={checkDocumentEditChanges}
            onSubmit={(event) => guardSave(event, saveDocumentEdit)}
          >
            <div className="modal-head">
              <div>
                <h2 id="document-edit-title">{label("แก้ไขไฟล์")}</h2>
                <p>{label("แก้ชื่อหรือเลือกไฟล์ใหม่เพื่อแทนไฟล์เดิม")}</p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setEditingDocument(null)}
                disabled={busy === `document:${editingDocument.id}`}
                aria-label={label("ยกเลิก")}
              >
                <X size={18} />
              </button>
            </div>
            <label
              className={`document-file-picker ${editingDocumentFileName ? "selected" : ""}`}
            >
              <input
                ref={editDocumentFileRef}
                name="file"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  setEditingDocumentFileName(
                    event.target.files?.[0]?.name || "",
                  )
                }
              />
              <span className="document-file-picker-icon">
                {editingDocumentFileName ? (
                  <Check size={22} />
                ) : (
                  <Upload size={22} />
                )}
              </span>
              <span>
                <strong>
                  {editingDocumentFileName || label("เลือกไฟล์ใหม่")}
                </strong>
                <small>
                  {editingDocumentFileName
                    ? label("เลือกไฟล์ใหม่แล้ว")
                    : `${label("ไฟล์ปัจจุบัน")}: ${editingDocument.original_filename}`}
                </small>
              </span>
            </label>
            <div className="field">
              <label htmlFor="document-edit-name">{label("ชื่อไฟล์")}</label>
              <input
                id="document-edit-name"
                name="title"
                value={editingDocumentTitle}
                onChange={(event) =>
                  setEditingDocumentTitle(event.target.value)
                }
                required
                maxLength={180}
              />
            </div>
            <small className="document-upload-note">
              {label(
                "รูปจะถูกลดขนาดอัตโนมัติก่อนอัปโหลด · PDF สูงสุด 10 MB",
              )}
            </small>
            {error && <p className="login-error">{label(error)}</p>}
            <div className="modal-submit-actions">
              <button
                className="primary-btn"
                disabled={busy === `document:${editingDocument.id}`}
              >
                {label(
                  busy === `document:${editingDocument.id}`
                    ? "กำลังบันทึก…"
                    : "บันทึก",
                )}
              </button>
              <button
                type="button"
                className="delete-record-btn"
                onClick={() =>
                  setDeleteTarget({ kind: "document", item: editingDocument })
                }
                disabled={busy === `document:${editingDocument.id}`}
                aria-label={label("ลบไฟล์นี้")}
                title={label("ลบไฟล์นี้")}
              >
                <Trash2 size={18} />
              </button>
            </div>
          </form>
        </div>
      )}
      {documentSheetOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && busy !== "document")
              setDocumentSheetOpen(false);
          }}
        >
          <form
            ref={documentCreateFormRef}
            className="modal document-upload-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="document-upload-title"
            onChange={checkDocumentCreateChanges}
            onSubmit={(event) => guardSave(event, uploadDocument)}
          >
            <div className="modal-head">
              <div>
                <h2 id="document-upload-title">{label("เพิ่มไฟล์")}</h2>
                <p>{label("เก็บเอกสารสำคัญไว้ดูระหว่างทริป")}</p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setDocumentSheetOpen(false)}
                disabled={busy === "document"}
                aria-label={label("ยกเลิก")}
              >
                <X size={18} />
              </button>
            </div>
            <label
              className={`document-file-picker ${documentFileName ? "selected" : ""}`}
            >
              <input
                ref={fileRef}
                name="file"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  setDocumentFileName(event.target.files?.[0]?.name || "")
                }
                required
              />
              <span className="document-file-picker-icon">
                {documentFileName ? <Check size={22} /> : <Upload size={22} />}
              </span>
              <span>
                <strong>
                  {documentFileName || label("เลือกรูปหรือไฟล์")}
                </strong>
                <small>
                  {label("รองรับ JPG, PNG, WebP และ PDF")}
                </small>
              </span>
            </label>
            <div className="field">
              <label htmlFor="document-title-input">{label("ชื่อไฟล์")}</label>
              <input
                id="document-title-input"
                name="title"
                value={documentTitle}
                onChange={(event) => setDocumentTitle(event.target.value)}
                placeholder={label("เช่น ใบจองโรงแรม")}
                required
                maxLength={160}
              />
            </div>
            <small className="document-upload-note">
              {label(
                "รูปจะถูกลดขนาดอัตโนมัติก่อนอัปโหลด · PDF สูงสุด 10 MB · เลือกเก็บออฟไลน์ภายหลังได้",
              )}
            </small>
            {error && <p className="login-error">{label(error)}</p>}
            <div className="modal-submit-actions">
              <button
                className="primary-btn document-upload-submit"
                disabled={busy === "document" || usagePercent >= 100}
              >
                <Upload size={16} />
                {label(
                  busy === "document" ? "กำลังอัปโหลด…" : "อัปโหลดไฟล์",
                )}
              </button>
            </div>
          </form>
        </div>
      )}
      {error && (checklistSheetOpen || documentSheetOpen || Boolean(editingDocument)) && (
        <FormErrorDialog
          title={documentSheetOpen || editingDocument ? label("ตรวจสอบข้อมูลเอกสาร") : label("ตรวจสอบข้อมูล Checklist")}
          description={label(error)}
          onClose={() => setError("")}
        />
      )}
      {deleteTarget && typeof document !== "undefined" && createPortal(
        <div
          className="confirm-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy)
              setDeleteTarget(null);
          }}
        >
          <div
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="workspace-delete-title"
          >
            <span className="confirm-icon">
              <AlertTriangle size={22} />
            </span>
            <h2 id="workspace-delete-title">{label("ยืนยันการลบ")}</h2>
            <p>
              {label(
                deleteTarget.kind === "item"
                  ? `ลบ “${deleteTarget.item.title}” ออกจาก Checklist?`
                  : deleteTarget.kind === "document"
                    ? `ลบไฟล์ “${deleteTarget.item.title}” ออกจากทริปนี้?`
                    : `ลบหมวด “${deleteTarget.category}” และ ${deleteTarget.items.length} รายการออกจากทริปนี้?`,
              )}
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-cancel"
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(busy)}
              >
                {label("ยกเลิก")}
              </button>
              <button
                type="button"
                className="confirm-delete"
                onClick={() =>
                  deleteTarget.kind === "item"
                    ? void deleteChecklist(deleteTarget.item)
                    : deleteTarget.kind === "document"
                      ? void deleteDocument(deleteTarget.item)
                      : void deleteChecklistCategory(
                          deleteTarget.category,
                          deleteTarget.items,
                        )
                }
                disabled={Boolean(busy)}
              >
                {label(busy ? "กำลังลบ…" : "ลบ")}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}
