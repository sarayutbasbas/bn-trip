"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Circle,
  Download,
  Eye,
  FileText,
  History,
  ListChecks,
  Paperclip,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  Undo2,
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
type MasterCategory = { id: string; name: string; sort_order: number };
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
  role: "owner" | "collaborator";
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
  role: "collaborator",
  documentUploadMode: "server",
  documentQuotaBytes: 100 * 1024 * 1024,
  documentUsageBytes: 0,
};
const offlineKey = (tripId: string) => `bn-trip-offline-documents:${tripId}`;

export function TripWorkspace({
  tripId,
  onUndo,
  label,
  initialTab = "checklist",
}: {
  tripId: string;
  onUndo: () => void;
  label: (value: string) => string;
  initialTab?: "checklist" | "documents" | "history";
}) {
  const router = useRouter();
  const [data, setData] = useState<Workspace>(EMPTY);
  const [tab, setTab] = useState<"checklist" | "documents" | "history">(
    initialTab,
  );
  const [loading, setLoading] = useState(true);
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
  const [documentSearch, setDocumentSearch] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentFileName, setDocumentFileName] = useState("");
  const [editingDocument, setEditingDocument] = useState<DocumentItem | null>(
    null,
  );
  const [editingDocumentTitle, setEditingDocumentTitle] = useState("");
  const [editingDocumentFileName, setEditingDocumentFileName] = useState("");
  const [assigningItemId, setAssigningItemId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
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
  const completedCategoriesRef = useRef<Set<string>>(new Set());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const editDocumentFileRef = useRef<HTMLInputElement>(null);
  function notify(value: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(value);
    toastTimer.current = setTimeout(() => {
      setToast("");
      toastTimer.current = null;
    }, 2200);
  }
  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/trips/${tripId}/workspace`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setData(body);
      setCategoryId(
        (current) => current || body.masterCategories?.[0]?.id || "",
      );
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
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/trips/${tripId}/workspace`);
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (active) {
          setData(body);
          setCategoryId(body.masterCategories?.[0]?.id || "");
          setOfflineIds(
            JSON.parse(localStorage.getItem(offlineKey(tripId)) || "[]"),
          );
        }
      } catch (reason) {
        if (active)
          setError(
            reason instanceof Error ? reason.message : "โหลดข้อมูลไม่สำเร็จ",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [tripId]);
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
    if (!title.trim() || !categoryId) return;
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
            categoryId,
            assignedUserId: assignee || null,
          }),
        },
      );
      setTitle("");
      setAssignee("");
      setEditingItemId(null);
      setChecklistSheetOpen(false);
      await load();
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
      await load();
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
    setData((current) => ({
      ...current,
      checklist: current.checklist.map((entry) =>
        entry.id === item.id
          ? { ...entry, completed_at: optimisticCompleted }
          : entry,
      ),
    }));
    try {
      await json(`/api/trips/${tripId}/checklist/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
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
    }));
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
    const ownedItems = categoryItems.filter(
      (item) => item.created_by === data.currentUserId,
    );
    if (!ownedItems.length) return;
    setBusy(`category:${category}`);
    setError("");
    const removedIds = new Set(ownedItems.map((item) => item.id));
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
      notify("ลบหมวด Checklist แล้ว");
    } catch (reason) {
      setData((current) => ({
        ...current,
        checklist: [...current.checklist, ...ownedItems].sort(
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
    const file = fileRef.current?.files?.[0];
    const documentTitle = String(form.get("title") || "").trim();
    if (!file) return;
    const limit =
      file.type === "application/pdf" ? 10 * 1024 * 1024 : 3 * 1024 * 1024;
    if (file.size > limit) {
      setError(
        file.type === "application/pdf"
          ? "PDF ต้องมีขนาดไม่เกิน 10 MB"
          : "รูปภาพต้องมีขนาดไม่เกิน 3 MB",
      );
      return;
    }
    if (data.documentUsageBytes + file.size > data.documentQuotaBytes) {
      setError("พื้นที่เอกสารของทริปเต็มแล้ว (สูงสุด 100 MB)");
      return;
    }
    form.set("file", file);
    setBusy("document");
    setError("");
    try {
      if (data.documentUploadMode === "client") {
        const extension =
          file.name
            .split(".")
            .pop()
            ?.toLowerCase()
            .replace(/[^a-z0-9]/g, "") || "bin";
        const pathname = `documents/${tripId}/doc-${crypto.randomUUID()}.${extension}`;
        const blob = await upload(pathname, file, {
          access: "private",
          handleUploadUrl: `/api/trips/${tripId}/documents/client-upload`,
          clientPayload: JSON.stringify({ size: file.size }),
        });
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
      await load();
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
      notify("ลบไฟล์แล้ว");
    } catch (reason) {
      await load();
      setError(reason instanceof Error ? reason.message : "ลบไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  }
  async function saveDocumentEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingDocument || !editingDocumentTitle.trim()) return;
    const file = editDocumentFileRef.current?.files?.[0];
    if (file) {
      const limit =
        file.type === "application/pdf" ? 10 * 1024 * 1024 : 3 * 1024 * 1024;
      if (file.size > limit) {
        setError(
          file.type === "application/pdf"
            ? "PDF ต้องมีขนาดไม่เกิน 10 MB"
            : "รูปภาพต้องมีขนาดไม่เกิน 3 MB",
        );
        return;
      }
      if (
        data.documentUsageBytes - Number(editingDocument.file_size) + file.size >
        data.documentQuotaBytes
      ) {
        setError("พื้นที่เอกสารของทริปเต็มแล้ว (สูงสุด 100 MB)");
        return;
      }
    }
    setBusy(`document:${editingDocument.id}`);
    setError("");
    try {
      if (file && data.documentUploadMode === "client") {
        const extension =
          file.name
            .split(".")
            .pop()
            ?.toLowerCase()
            .replace(/[^a-z0-9]/g, "") || "bin";
        const pathname = `documents/${tripId}/doc-${crypto.randomUUID()}.${extension}`;
        const blob = await upload(pathname, file, {
          access: "private",
          handleUploadUrl: `/api/trips/${tripId}/documents/client-upload`,
          clientPayload: JSON.stringify({
            size: file.size,
            replaceDocumentId: editingDocument.id,
          }),
        });
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
      await load();
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
  async function undo(activity: Activity) {
    setBusy(activity.id);
    try {
      await json(`/api/trips/${tripId}/activities/${activity.id}/undo`, {
        method: "POST",
      });
      await load();
      onUndo();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ย้อนคืนไม่สำเร็จ");
    } finally {
      setBusy("");
    }
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
    const body = document.body;
    const scrollY = window.scrollY;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyWidth = body.style.width;
    const previousScrollBehavior = root.style.scrollBehavior;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDeleteTarget(null);
    };
    root.classList.add("confirm-open");
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      root.classList.remove("confirm-open");
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.width = previousBodyWidth;
      root.style.scrollBehavior = "auto";
      window.scrollTo(0, scrollY);
      window.requestAnimationFrame(() => {
        root.style.scrollBehavior = previousScrollBehavior;
      });
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [deleteTarget]);
  useEffect(() => {
    const totals = new Map<string, { total: number; completed: number }>();
    data.checklist.forEach((item) => {
      const category = item.category_name || "อื่น ๆ";
      const count = totals.get(category) || { total: 0, completed: 0 };
      count.total += 1;
      if (item.completed_at) count.completed += 1;
      totals.set(category, count);
    });
    const completedCategories = new Set(
      [...totals.entries()]
        .filter(([, count]) => count.total === count.completed)
        .map(([category]) => category),
    );
    const newlyCompleted = [...completedCategories].filter(
      (category) => !completedCategoriesRef.current.has(category),
    );
    completedCategoriesRef.current = completedCategories;
    if (!newlyCompleted.length) return;
    setCollapsedCategories((current) => {
      const next = new Set(current);
      newlyCompleted.forEach((category) => next.add(category));
      return next;
    });
  }, [data.checklist]);
  useEffect(
    () => () => {
      assignmentTimers.current.forEach((timer) => clearTimeout(timer));
      assignmentTimers.current.clear();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  const canUndo = (activity: Activity) =>
    data.role === "owner" &&
    activity.can_undo &&
    !activity.undone_at &&
    (activity.entity_type === "itinerary" ||
      activity.entity_type === "checklist" ||
      (activity.entity_type === "document" && activity.action === "create") ||
      (activity.entity_type === "trip" && activity.action === "update"));
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
  const importedIds = new Set(
    data.checklist.map((item) => item.master_item_id).filter(Boolean),
  );
  const assigningItem = data.checklist.find(
    (item) => item.id === assigningItemId,
  );
  const editingItem = data.checklist.find((item) => item.id === editingItemId);
  const normalizedDocumentSearch = documentSearch.trim().toLocaleLowerCase();
  const filteredDocuments = data.documents.filter((item) => {
    if (!normalizedDocumentSearch) return true;
    return `${item.title} ${item.original_filename}`
      .toLocaleLowerCase()
      .includes(normalizedDocumentSearch);
  });
  function toggleCategory(category: string) {
    setCollapsedCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }
  function toggleMasterCategory(categoryId: string) {
    setCollapsedMasterCategories((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }
  function selectTab(nextTab: "checklist" | "documents" | "history") {
    setTab(nextTab);
    const url = new URL(window.location.href);
    url.searchParams.set("workspace", nextTab);
    router.replace(`${url.pathname}${url.search}${url.hash}`, {
      scroll: false,
    });
  }
  function openDocument(documentId: string) {
    const sourceUrl = new URL(window.location.href);
    sourceUrl.searchParams.set("workspace", "documents");
    window.history.replaceState(
      window.history.state,
      "",
      `${sourceUrl.pathname}${sourceUrl.search}${sourceUrl.hash}`,
    );
    window.location.assign(`/trips/${tripId}/documents/${documentId}`);
  }

  return (
    <section className="trip-workspace">
      {toast &&
        createPortal(
          <div className="toast toast-success" role="status" aria-live="polite">
            <Check size={16} />
            {label(toast)}
          </div>,
          document.body,
        )}
      <header className="workspace-tabs">
        <button
          className={tab === "checklist" ? "active" : ""}
          onClick={() => selectTab("checklist")}
        >
          <ListChecks size={16} />
          {label("Checklist")}
        </button>
        <button
          className={tab === "documents" ? "active" : ""}
          onClick={() => selectTab("documents")}
        >
          <Paperclip size={16} />
          {label("เอกสาร")}
        </button>
        <button
          className={tab === "history" ? "active" : ""}
          onClick={() => selectTab("history")}
        >
          <History size={16} />
          {label("ประวัติ")}
        </button>
      </header>
      {error && <p className="workspace-error">{label(error)}</p>}
      {loading ? (
        <p className="workspace-loading">{label("กำลังโหลด…")}</p>
      ) : tab === "checklist" ? (
        <div className="workspace-panel workspace-fab-panel">
          <div className="checklist-master-actions">
            <button
              type="button"
              className="checklist-master-trigger"
              onClick={() => {
                setError("");
                setChecklistSheetOpen(false);
                setMasterOpen(true);
              }}
            >
              <ListChecks size={15} />
              {label("เลือกจาก Master")}
            </button>
          </div>
          <div className="checklist-groups">
            {[
              ...new Set(
                data.checklist.map((item) => item.category_name || "อื่น ๆ"),
              ),
            ].map((category) => {
              const categoryItems = data.checklist.filter(
                (item) => (item.category_name || "อื่น ๆ") === category,
              );
              const collapsed = collapsedCategories.has(category);
              const completedCount = categoryItems.filter(
                (item) => item.completed_at,
              ).length;
              const progress = Math.round(
                (completedCount / categoryItems.length) * 100,
              );
              const canDeleteCategory = categoryItems.some(
                (item) => item.created_by === data.currentUserId,
              );
              const assignedMembers = data.members.filter((member) =>
                categoryItems.some(
                  (item) => item.assigned_user_id === member.id,
                ),
              );
              return (
                <section
                  className={collapsed ? "collapsed" : ""}
                  key={category}
                >
                  <div className="checklist-category-head">
                    <button
                      type="button"
                      className="checklist-category-toggle"
                      onClick={() => toggleCategory(category)}
                      aria-expanded={!collapsed}
                    >
                      <span>
                        <ChevronRight size={14} />
                        <strong>{category}</strong>
                      </span>
                      <div className="checklist-category-summary">
                        {assignedMembers.length > 0 && (
                          <span
                            className="checklist-category-avatars"
                            aria-label={label("ผู้รับผิดชอบในหมวดนี้")}
                          >
                            {assignedMembers.slice(0, 3).map((member) => {
                              const memberName =
                                member.display_name || member.email || "Member";
                              return (
                                <span
                                  className="checklist-category-avatar"
                                  key={member.id}
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
                                </span>
                              );
                            })}
                            {assignedMembers.length > 3 && (
                              <span className="checklist-category-avatar">
                                +{assignedMembers.length - 3}
                              </span>
                            )}
                          </span>
                        )}
                        <small>
                          {label(`${categoryItems.length} รายการ`)}
                          <span
                            className={`checklist-progress ${progress === 100 ? "complete" : progress > 0 ? "partial" : "empty"}`}
                            aria-label={`${label("Progress")} ${progress}%`}
                          >
                            {progress}%
                          </span>
                        </small>
                      </div>
                    </button>
                    {canDeleteCategory && (
                      <button
                        type="button"
                        className="checklist-category-delete"
                        onClick={() =>
                          setDeleteTarget({
                            kind: "category",
                            category,
                            items: categoryItems,
                          })
                        }
                        disabled={busy === `category:${category}`}
                        aria-label={label(`ลบหมวด ${category}`)}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  {!collapsed && (
                    <div className="checklist-list">
                      {categoryItems.map((item) => (
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
                          {item.created_by === data.currentUserId && (
                            <>
                              <button
                                type="button"
                                className="checklist-edit"
                                onClick={() => {
                                  const itemCategory = data.masterCategories.find(
                                    (category) =>
                                      category.name === item.category_name,
                                  );
                                  setError("");
                                  setTitle(item.title);
                                  setCategoryId(itemCategory?.id || "");
                                  setAssignee(item.assigned_user_id || "");
                                  setEditingItemId(item.id);
                                  setChecklistSheetOpen(true);
                                }}
                                aria-label={label(`แก้ไข ${item.title}`)}
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                className="workspace-delete"
                                onClick={() =>
                                  setDeleteTarget({ kind: "item", item })
                                }
                                aria-label={label("ลบ")}
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
            {!data.checklist.length && (
              <p className="workspace-empty">{label("ยังไม่มี Checklist")}</p>
            )}
          </div>
          <button
            type="button"
            className="directory-fab checklist-floating-add"
            onClick={() => {
              setError("");
              setMasterOpen(false);
              setEditingItemId(null);
              setTitle("");
              setAssignee("");
              setChecklistSheetOpen(true);
            }}
            aria-label={label("เพิ่ม Checklist")}
          >
            <Plus size={22} />
            <span>{label("เพิ่ม Checklist")}</span>
          </button>
        </div>
      ) : tab === "documents" ? (
        <div className="workspace-panel workspace-fab-panel">
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
                    {item.original_filename} ·{" "}
                    {(Number(item.file_size) / 1024 / 1024).toFixed(1)} MB
                  </small>
                </div>
                <button
                  type="button"
                  className="document-view-button"
                  onClick={() => openDocument(item.id)}
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
                {data.role === "owner" && (
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
          <button
            type="button"
            className="directory-fab document-upload-fab"
            onClick={() => {
              setError("");
              setDocumentSheetOpen(true);
            }}
            disabled={usagePercent >= 100}
          >
            <Plus size={18} />
            <span>{label("เพิ่มไฟล์")}</span>
          </button>
        </div>
      ) : (
        <div className="workspace-panel activity-list">
          {data.activities.map((item) => (
            <article className={item.undone_at ? "undone" : ""} key={item.id}>
              <span className="activity-icon">
                <History size={15} />
              </span>
              <div>
                <strong>{label(item.summary)}</strong>
                <small>
                  {item.actor_name || label("สมาชิกทริป")} ·{" "}
                  {new Date(item.created_at).toLocaleString()}
                </small>
                {item.undone_at && <em>{label("ย้อนคืนแล้ว")}</em>}
              </div>
              {canUndo(item) && (
                <button
                  onClick={() => void undo(item)}
                  disabled={busy === item.id}
                >
                  <Undo2 size={15} />
                  {label("Undo")}
                </button>
              )}
            </article>
          ))}
          {!data.activities.length && (
            <p className="workspace-empty">
              {label("ยังไม่มีประวัติการแก้ไข")}
            </p>
          )}
          <button className="workspace-refresh" onClick={() => void load()}>
            <RefreshCcw size={14} />
            {label("รีเฟรช")}
          </button>
        </div>
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
              {data.members.map((member) => {
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
                  href="/settings/checklists"
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
              {data.masterCategories.map((category) => {
                const available = data.masterItems.filter(
                  (item) =>
                    item.category_id === category.id &&
                    !importedIds.has(item.id),
                );
                if (!available.length) return null;
                const collapsed = collapsedMasterCategories.has(category.id);
                const availableIds = available.map((item) => item.id);
                const selectedCount = availableIds.filter((id) =>
                  selectedMaster.includes(id),
                ).length;
                const allSelected = selectedCount === availableIds.length;
                return (
                  <section className="master-picker-category" key={category.id}>
                    <button
                      type="button"
                      className="master-picker-toggle"
                      onClick={() => toggleMasterCategory(category.id)}
                      aria-expanded={!collapsed}
                    >
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
              {!data.masterItems.some((item) => !importedIds.has(item.id)) && (
                <p className="workspace-empty">
                  {label("เพิ่มรายการจาก Master ครบแล้ว")}
                </p>
              )}
            </div>
            {error && <p className="login-error">{label(error)}</p>}
            <button
              type="button"
              className="primary-btn master-import-btn"
              disabled={!selectedMaster.length || busy === "master"}
              onClick={() => void importMaster()}
            >
              <Plus size={15} />
              {label(`เพิ่ม ${selectedMaster.length} รายการเข้าทริป`)}
            </button>
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
            className="modal checklist-add-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="checklist-sheet-title"
            onSubmit={addChecklist}
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
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={label(
                    "พิมพ์ Checklist เอง (จะบันทึกเข้า Master ด้วย)",
                  )}
                  autoFocus
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
                  </select>
                </div>
                <div className="field">
                  <label>{label("มอบหมายให้")}</label>
                  <div className="new-checklist-assignees">
                    <button
                      type="button"
                      className={!assignee ? "active" : ""}
                      onClick={() => setAssignee("")}
                      aria-label={label("ยังไม่มอบหมาย")}
                      title={label("ยังไม่มอบหมาย")}
                    >
                      <UserPlus size={16} />
                    </button>
                    {data.members.map((member) => {
                      const memberName =
                        member.display_name || member.email || "Member";
                      return (
                        <button
                          type="button"
                          className={assignee === member.id ? "active" : ""}
                          key={member.id}
                          onClick={() => setAssignee(member.id)}
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
                disabled={
                  busy === (editingItem?.id || "checklist") ||
                  !title.trim() ||
                  !categoryId
                }
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
            className="modal document-upload-sheet document-edit-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="document-edit-title"
            onSubmit={saveDocumentEdit}
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
                "ไม่เลือกไฟล์ใหม่ ระบบจะแก้เฉพาะชื่อ · รูปสูงสุด 3 MB · PDF สูงสุด 10 MB",
              )}
            </small>
            {error && <p className="login-error">{label(error)}</p>}
            <div className="modal-submit-actions">
              <button
                className="primary-btn"
                disabled={
                  busy === `document:${editingDocument.id}` ||
                  !editingDocumentTitle.trim()
                }
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
            className="modal document-upload-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="document-upload-title"
            onSubmit={uploadDocument}
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
                "รูปภาพสูงสุด 3 MB · PDF สูงสุด 10 MB · เลือกเก็บออฟไลน์ภายหลังได้",
              )}
            </small>
            {error && <p className="login-error">{label(error)}</p>}
            <button
              className="primary-btn document-upload-submit"
              disabled={
                busy === "document" ||
                !documentTitle.trim() ||
                !documentFileName ||
                usagePercent >= 100
              }
            >
              <Upload size={16} />
              {label(
                busy === "document" ? "กำลังอัปโหลด…" : "อัปโหลดไฟล์",
              )}
            </button>
          </form>
        </div>
      )}
      {deleteTarget && (
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
                    : `ลบหมวด “${deleteTarget.category}” และ ${deleteTarget.items.filter((item) => item.created_by === data.currentUserId).length} รายการที่คุณเพิ่มออกจากทริปนี้?`,
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
        </div>
      )}
    </section>
  );
}
