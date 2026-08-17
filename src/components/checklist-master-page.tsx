"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormDirty } from "@/src/components/use-form-dirty";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowUp,
  Check,
  ChevronRight,
  House,
  ListChecks,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";

type Category = { id: string; name: string; sort_order: number };
type Item = {
  id: string;
  category_id: string;
  title: string;
  sort_order: number;
};
type DeleteTarget = {
  kind: "category" | "item";
  id: string;
  name: string;
} | null;

const NEW_CATEGORY = "__new_category__";

export function ChecklistMasterPage({ demo = false }: { demo?: boolean }) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [editingCategory, setEditingCategory] = useState<{
    id: string;
    value: string;
  } | null>(null);
  const [itemSheetOpen, setItemSheetOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemTitle, setItemTitle] = useState("");
  const [itemCategoryId, setItemCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [showBackTop, setShowBackTop] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    formRef: itemFormRef,
    hasChanges: itemHasChanges,
    checkForChanges: checkItemChanges,
  } = useFormDirty(
    `${itemSheetOpen}:${editingItemId || "new"}`,
  );

  async function api(url: string, options?: RequestInit) {
    const response = await fetch(url, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(options?.headers || {}),
      },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "บันทึกไม่สำเร็จ");
    return body;
  }

  async function load() {
    const data = await api("/api/checklist-master");
    const nextCategories = (data.categories || []) as Category[];
    setCategories(nextCategories);
    setItems(data.items || []);
    const categoryIds = new Set(nextCategories.map(({ id }) => id));
    setOpen((current) => current.filter((id) => categoryIds.has(id)));
  }

  useEffect(() => {
    let active = true;
    void api("/api/checklist-master")
      .then((data) => {
        if (!active) return;
        const nextCategories = (data.categories || []) as Category[];
        setCategories(nextCategories);
        setItems(data.items || []);
        setOpen([]);
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error ? reason.message : "โหลดข้อมูลไม่สำเร็จ",
          );
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!itemSheetOpen && !deleteTarget) return;
    const root = document.documentElement;
    root.classList.add(itemSheetOpen ? "sheet-open" : "confirm-open");
    return () => root.classList.remove("sheet-open", "confirm-open");
  }, [itemSheetOpen, deleteTarget]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  useEffect(() => {
    const onScroll = () => setShowBackTop(window.scrollY > 520);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function notify(value: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(value);
    toastTimer.current = setTimeout(() => {
      setToast("");
      toastTimer.current = null;
    }, 2200);
  }

  function closeItemSheet() {
    setItemSheetOpen(false);
    setEditingItemId(null);
    setItemTitle("");
    setNewCategoryName("");
    setError("");
  }

  function openNewItem() {
    setEditingItemId(null);
    setItemTitle("");
    setItemCategoryId(categories[0]?.id || NEW_CATEGORY);
    setNewCategoryName("");
    setError("");
    setItemSheetOpen(true);
  }

  function openEditItem(item: Item) {
    setEditingItemId(item.id);
    setItemTitle(item.title);
    setItemCategoryId(item.category_id);
    setNewCategoryName("");
    setError("");
    setItemSheetOpen(true);
  }

  async function saveItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = itemTitle.trim();
    if (
      !title ||
      !itemCategoryId ||
      (itemCategoryId === NEW_CATEGORY && !newCategoryName.trim())
    )
      return;
    if (demo) {
      router.push("/?authError=demo_login_required");
      return;
    }
    const busyKey = editingItemId || "master-item";
    setBusy(busyKey);
    setError("");
    try {
      let categoryId = itemCategoryId;
      if (categoryId === NEW_CATEGORY) {
        const category = (await api("/api/checklist-master", {
          method: "POST",
          body: JSON.stringify({
            kind: "category",
            name: newCategoryName.trim(),
          }),
        })) as Category;
        categoryId = category.id;
      }
      await api(
        editingItemId
          ? `/api/checklist-master/items/${editingItemId}`
          : "/api/checklist-master",
        {
          method: editingItemId ? "PATCH" : "POST",
          body: JSON.stringify(
            editingItemId
              ? { title, categoryId }
              : { kind: "item", categoryId, title },
          ),
        },
      );
      const wasEditing = Boolean(editingItemId);
      closeItemSheet();
      setOpen((current) =>
        current.includes(categoryId) ? current : [...current, categoryId],
      );
      await load();
      notify(wasEditing ? "แก้ไข Checklist แล้ว" : "เพิ่ม Checklist แล้ว");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  }

  async function saveCategory() {
    if (!editingCategory?.value.trim()) return;
    setBusy(editingCategory.id);
    setError("");
    try {
      await api(`/api/checklist-master/categories/${editingCategory.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editingCategory.value.trim() }),
      });
      setEditingCategory(null);
      await load();
      notify("แก้ไขหมวดหมู่แล้ว");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setBusy(target.id);
    setError("");
    try {
      await api(
        target.kind === "category"
          ? `/api/checklist-master/categories/${target.id}`
          : `/api/checklist-master/items/${target.id}`,
        { method: "DELETE" },
      );
      setDeleteTarget(null);
      if (target.kind === "item" && editingItemId === target.id)
        closeItemSheet();
      if (target.kind === "category" && editingCategory?.id === target.id)
        setEditingCategory(null);
      await load();
      notify(target.kind === "category" ? "ลบหมวดหมู่แล้ว" : "ลบ Checklist แล้ว");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ลบไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  }

  const deferredSearch = useDeferredValue(search);
  const keyword = deferredSearch.trim().toLocaleLowerCase("th");
  const itemsByCategory = useMemo(() => {
    const grouped = new Map<string, Item[]>();
    for (const item of items) {
      const categoryItems = grouped.get(item.category_id);
      if (categoryItems) categoryItems.push(item);
      else grouped.set(item.category_id, [item]);
    }
    return grouped;
  }, [items]);
  const masterView = useMemo(() => {
    const visibleItems = new Map<string, Item[]>();
    const visibleCategories: Category[] = [];
    for (const category of categories) {
      const categoryItems = itemsByCategory.get(category.id) || [];
      const categoryMatches = category.name
        .toLocaleLowerCase("th")
        .includes(keyword);
      const matches = keyword
        ? categoryMatches
          ? categoryItems
          : categoryItems.filter((item) =>
              item.title.toLocaleLowerCase("th").includes(keyword),
            )
        : categoryItems;
      if (!keyword || categoryMatches || matches.length) {
        visibleCategories.push(category);
        visibleItems.set(category.id, matches);
      }
    }
    return { categories: visibleCategories, items: visibleItems };
  }, [categories, itemsByCategory, keyword]);

  return (
    <div className="app-shell flow-shell master-page-shell">
      {toast && (
        <div className="toast toast-success" role="status" aria-live="polite">
          <Check size={16} />
          {toast}
        </div>
      )}
      <main>
        <header className="mobile-head flow-header">
          <Link
            className="brand master-brand"
            href="/"
            aria-label="Pack & Go+ · หน้าแรก"
          >
            <Image
              src="/pack-and-go-icon-512.png"
              alt="Pack & Go+"
              width={48}
              height={48}
              priority
            />
            <div>
              Pack &amp; Go+<small>travel smarter together</small>
            </div>
          </Link>
          <nav className="mobile-actions">
            <button
              className="icon-btn"
              onClick={() => router.push("/")}
              aria-label="หน้าแรก"
            >
              <House size={18} />
            </button>
            <button
              className="icon-btn active"
              onClick={() => router.push("/settings")}
              aria-label="ตั้งค่า"
            >
              <Settings2 size={18} />
            </button>
          </nav>
        </header>
        <div className="screen master-screen">
          <span className="mini-kicker">PERSONAL PACKING LIBRARY</span>
          <h1 className="page-title">Master Checklist</h1>
          <p className="page-sub">
            รายการส่วนตัวของคุณ สำหรับเลือกใช้ซ้ำในทุกทริป
          </p>
          {error && !itemSheetOpen && (
            <p className="workspace-error">{error}</p>
          )}
          <label className="master-search">
            <Search size={17} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหาหมวดหมู่หรือรายการ"
            />
          </label>
          <div className="checklist-groups master-checklist-groups">
            {masterView.categories.map((category) => {
                const categoryItems = masterView.items.get(category.id) || [];
                const expanded = keyword ? true : open.includes(category.id);
                const isEditingCategory = editingCategory?.id === category.id;
                return (
                  <section
                    className={expanded ? "" : "collapsed"}
                    key={category.id}
                  >
                    <div className="checklist-category-head">
                      {isEditingCategory ? (
                        <input
                          className="master-category-name-input"
                          value={editingCategory.value}
                          onChange={(event) =>
                            setEditingCategory({
                              ...editingCategory,
                              value: event.target.value,
                            })
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void saveCategory();
                            if (event.key === "Escape")
                              setEditingCategory(null);
                          }}
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          className="checklist-category-toggle"
                          onClick={() =>
                            startTransition(() =>
                              setOpen((current) =>
                                current.includes(category.id)
                                  ? current.filter((id) => id !== category.id)
                                  : [...current, category.id],
                              ),
                            )
                          }
                          aria-expanded={expanded}
                        >
                          <span>
                            <ChevronRight size={14} />
                            <strong>{category.name}</strong>
                          </span>
                          <small>
                            {
                              (itemsByCategory.get(category.id) || []).length
                            }{" "}
                            รายการ
                          </small>
                        </button>
                      )}
                      <button
                        type="button"
                        className="checklist-edit master-category-action"
                        onClick={() =>
                          isEditingCategory
                            ? void saveCategory()
                            : setEditingCategory({
                                id: category.id,
                                value: category.name,
                              })
                        }
                        disabled={busy === category.id}
                        aria-label={
                          isEditingCategory ? "บันทึกชื่อหมวด" : "แก้ไขหมวด"
                        }
                      >
                        {isEditingCategory ? (
                          <Check size={15} />
                        ) : (
                          <Pencil size={15} />
                        )}
                      </button>
                      <button
                        type="button"
                        className="checklist-category-delete"
                        onClick={() =>
                          isEditingCategory
                            ? setEditingCategory(null)
                            : setDeleteTarget({
                                kind: "category",
                                id: category.id,
                                name: category.name,
                              })
                        }
                        disabled={busy === category.id}
                        aria-label={isEditingCategory ? "ยกเลิก" : "ลบหมวด"}
                      >
                        {isEditingCategory ? (
                          <X size={15} />
                        ) : (
                          <Trash2 size={15} />
                        )}
                      </button>
                    </div>
                    {expanded && (
                      <div className="checklist-list master-checklist-items">
                        {categoryItems.map((item) => (
                          <article key={item.id}>
                            <strong>{item.title}</strong>
                            <button
                              type="button"
                              className="checklist-edit"
                              onClick={() => openEditItem(item)}
                              aria-label={`แก้ไข ${item.title}`}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              className="workspace-delete"
                              onClick={() =>
                                setDeleteTarget({
                                  kind: "item",
                                  id: item.id,
                                  name: item.title,
                                })
                              }
                              aria-label={`ลบ ${item.title}`}
                            >
                              <Trash2 size={15} />
                            </button>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            {!categories.length && (
              <div className="master-empty">
                <ListChecks size={28} />
                <p>ยังไม่มี Master Checklist</p>
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          className="directory-fab master-checklist-fab"
          onClick={openNewItem}
        >
          <Plus size={22} />
          เพิ่ม Checklist
        </button>
        {showBackTop && (
          <button
            type="button"
            className="expense-back-top workspace-back-top"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            title="กลับด้านบน"
            aria-label="กลับด้านบน"
          >
            <ArrowUp size={20} />
          </button>
        )}
      </main>

      {itemSheetOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) closeItemSheet();
          }}
        >
          <form
            ref={itemFormRef}
            className="modal checklist-add-sheet master-item-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="master-item-sheet-title"
            onChange={checkItemChanges}
            onSubmit={saveItem}
          >
            <div className="modal-head">
              <div>
                <h2 id="master-item-sheet-title">
                  {editingItemId ? "แก้ไข Checklist" : "เพิ่ม Checklist"}
                </h2>
                <p>จัดเก็บรายการไว้เลือกใช้ซ้ำในทุกทริป</p>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={closeItemSheet}
                disabled={Boolean(busy)}
                aria-label="ปิด"
              >
                <X size={18} />
              </button>
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="master-item-title">ชื่อ Checklist</label>
                <input
                  id="master-item-title"
                  name="title"
                  value={itemTitle}
                  onChange={(event) => setItemTitle(event.target.value)}
                  placeholder="พิมพ์ Checklist"
                  maxLength={240}
                  required
                />
              </div>
              <div
                className={
                  itemCategoryId === NEW_CATEGORY
                    ? "form-row master-new-category-row"
                    : ""
                }
              >
                <div className="field">
                  <label htmlFor="master-item-category">หมวดหมู่</label>
                  <select
                    id="master-item-category"
                    name="categoryId"
                    value={itemCategoryId}
                    onChange={(event) => {
                      setItemCategoryId(event.target.value);
                      if (event.target.value !== NEW_CATEGORY)
                        setNewCategoryName("");
                    }}
                    required
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                    <option value={NEW_CATEGORY}>อื่นๆ โปรดระบุ</option>
                  </select>
                </div>
                {itemCategoryId === NEW_CATEGORY && (
                  <div className="field">
                    <label htmlFor="master-new-category">ชื่อหมวดหมู่ใหม่</label>
                    <input
                      id="master-new-category"
                      name="newCategoryName"
                      value={newCategoryName}
                      onChange={(event) => setNewCategoryName(event.target.value)}
                      placeholder="เช่น เอกสารสำคัญ"
                      maxLength={120}
                      required
                    />
                  </div>
                )}
              </div>
            </div>
            {error && <p className="login-error">{error}</p>}
            <div className="modal-submit-actions checklist-sheet-actions">
              <button
                className="primary-btn"
                disabled={
                  Boolean(busy) ||
                  !itemTitle.trim() ||
                  !itemCategoryId ||
                  (itemCategoryId === NEW_CATEGORY &&
                    !newCategoryName.trim()) ||
                  !itemHasChanges
                }
              >
                {busy ? "กำลังบันทึก…" : "บันทึก Checklist"}
              </button>
              {editingItemId && (
                <button
                  type="button"
                  className="delete-record-btn"
                  onClick={() => {
                    const item = items.find(({ id }) => id === editingItemId);
                    if (item)
                      setDeleteTarget({
                        kind: "item",
                        id: item.id,
                        name: item.title,
                      });
                  }}
                  disabled={Boolean(busy)}
                  aria-label="ลบ Checklist นี้"
                  title="ลบ Checklist นี้"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
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
            aria-labelledby="master-delete-title"
          >
            <span className="confirm-icon">
              <AlertTriangle size={22} />
            </span>
            <h2 id="master-delete-title">ยืนยันการลบ</h2>
            <p>
              {deleteTarget.kind === "category"
                ? `ลบหมวด “${deleteTarget.name}” และรายการทั้งหมดในหมวดนี้?`
                : `ลบ “${deleteTarget.name}” ออกจาก Master?`}
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-cancel"
                onClick={() => setDeleteTarget(null)}
                disabled={Boolean(busy)}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="confirm-delete"
                onClick={() => void remove()}
                disabled={Boolean(busy)}
              >
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
