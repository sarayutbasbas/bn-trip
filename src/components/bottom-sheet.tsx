"use client";

import type {
  FormEvent,
  FormEventHandler,
  HTMLAttributes,
  ReactNode,
  Ref,
} from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2, X } from "lucide-react";

type BottomSheetCommonProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  closeLabel?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  backdropClassName?: string;
  backdropRef?: Ref<HTMLDivElement>;
  bodyClassName?: string;
  busy?: boolean;
  closeOnBackdrop?: boolean;
  headerActions?: ReactNode;
  submitLabel?: ReactNode;
  submitDisabled?: boolean;
  deleteLabel?: string;
  deleteIcon?: ReactNode;
  onDelete?: () => void;
  deleteDisabled?: boolean;
};

type BottomSheetFormProps = BottomSheetCommonProps & {
  onSubmit: FormEventHandler<HTMLFormElement>;
  formRef?: Ref<HTMLFormElement>;
  onChange?: FormEventHandler<HTMLFormElement>;
};

type BottomSheetSectionProps = BottomSheetCommonProps & {
  onSubmit?: undefined;
  formRef?: never;
  onChange?: never;
};

export type BottomSheetProps = BottomSheetFormProps | BottomSheetSectionProps;

type SaveHandler = (event: FormEvent<HTMLFormElement>) => void | Promise<void>;

export function useBlockingSubmit() {
  const locked = useRef(false);
  const [saving, setSaving] = useState(false);
  const guard = useCallback((event: FormEvent<HTMLFormElement>, submit: SaveHandler) => {
    event.preventDefault();
    if (locked.current) return;
    locked.current = true;
    setSaving(true);
    try {
      void Promise.resolve(submit(event))
        .catch((error) => console.error("Save failed", error))
        .finally(() => {
          locked.current = false;
          setSaving(false);
        });
    } catch (error) {
      locked.current = false;
      setSaving(false);
      console.error("Save failed", error);
    }
  }, []);
  return { saving, guard };
}

export function BlockingSaveOverlay({ visible }: { visible: boolean }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!visible) return;
    dialogRef.current?.focus();
    const blockKeys = (event: KeyboardEvent) => {
      if (event.key !== "Escape" && event.key !== "Enter") return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    document.addEventListener("keydown", blockKeys, true);
    return () => document.removeEventListener("keydown", blockKeys, true);
  }, [visible]);
  if (!visible || typeof document === "undefined") return null;
  return createPortal(
    <div className="save-progress-backdrop" role="presentation">
      <div ref={dialogRef} className="save-progress-dialog" role="alertdialog" aria-modal="true" aria-labelledby="save-progress-title" aria-describedby="save-progress-description" tabIndex={-1}>
        <span className="save-progress-spinner" aria-hidden="true" />
        <strong id="save-progress-title">กำลังบันทึก…</strong>
        <span id="save-progress-description">กรุณารอสักครู่</span>
      </div>
    </div>,
    document.body,
  );
}

export function BottomSheetHeader({
  title,
  subtitle,
  closeLabel = "ปิด",
  onClose,
  busy = false,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  closeLabel?: string;
  onClose: () => void;
  busy?: boolean;
  actions?: ReactNode;
}) {
  return (
    <div className="modal-head bottom-sheet-head">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="bottom-sheet-head-actions">
        {actions}
        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          disabled={busy}
          aria-label={closeLabel}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

export function BottomSheetFooter({
  submitLabel,
  submitDisabled = false,
  deleteLabel = "ลบรายการ",
  deleteIcon,
  onDelete,
  deleteDisabled = false,
}: {
  submitLabel: ReactNode;
  submitDisabled?: boolean;
  deleteLabel?: string;
  deleteIcon?: ReactNode;
  onDelete?: () => void;
  deleteDisabled?: boolean;
}) {
  return (
    <div className="modal-submit-actions bottom-sheet-actions">
      <button className="primary-btn" disabled={submitDisabled}>
        {submitLabel}
      </button>
      {onDelete ? (
        <button
          type="button"
          className="delete-record-btn"
          onClick={onDelete}
          disabled={deleteDisabled}
          aria-label={deleteLabel}
          title={deleteLabel}
        >
          {deleteIcon || <Trash2 size={18} />}
        </button>
      ) : null}
    </div>
  );
}

export function BottomSheet(props: BottomSheetProps) {
  const {
    title,
    subtitle,
    closeLabel,
    onClose,
    children,
    className = "",
    backdropClassName = "",
    backdropRef,
    bodyClassName = "bottom-sheet-body",
    busy = false,
    closeOnBackdrop = true,
    headerActions,
    submitLabel,
    submitDisabled,
    deleteLabel,
    deleteIcon,
    onDelete,
    deleteDisabled,
    onSubmit,
    formRef,
    onChange,
  } = props;
  const { saving: submitting, guard } = useBlockingSubmit();
  const locked = busy || submitting;
  useEffect(() => {
    const root = document.documentElement;
    const wasLocked = root.classList.contains("sheet-open");
    root.classList.add("sheet-open");
    return () => {
      if (!wasLocked) root.classList.remove("sheet-open");
    };
  }, []);
  const backdropProps: HTMLAttributes<HTMLDivElement> = {
    className: `modal-backdrop ${backdropClassName}`.trim(),
    role: "presentation",
    onMouseDown: (event) => {
      if (
        closeOnBackdrop &&
        !locked &&
        event.target === event.currentTarget
      )
        onClose();
    },
  };
  const content = (
    <>
      <BottomSheetHeader
        title={title}
        subtitle={subtitle}
        closeLabel={closeLabel}
        onClose={onClose}
        busy={locked}
        actions={headerActions}
      />
      <div className={bodyClassName}>{children}</div>
      {submitLabel ? (
        <BottomSheetFooter
          submitLabel={submitLabel}
          submitDisabled={submitDisabled || locked}
          deleteLabel={deleteLabel}
          deleteIcon={deleteIcon}
          onDelete={onDelete}
          deleteDisabled={deleteDisabled || locked}
        />
      ) : null}
    </>
  );

  return (
    <div ref={backdropRef} {...backdropProps}>
      {onSubmit ? (
        <form
          ref={formRef}
          className={`modal bottom-sheet ${className}`.trim()}
          onChange={onChange}
          onSubmit={(event) => guard(event, onSubmit)}
          role="dialog"
          aria-modal="true"
        >
          {content}
        </form>
      ) : (
        <section
          className={`modal bottom-sheet ${className}`.trim()}
          role="dialog"
          aria-modal="true"
        >
          {content}
        </section>
      )}
      <BlockingSaveOverlay visible={submitting} />
    </div>
  );
}
