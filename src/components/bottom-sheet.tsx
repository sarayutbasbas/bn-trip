"use client";

import type {
  FormEventHandler,
  HTMLAttributes,
  ReactNode,
  Ref,
} from "react";
import { useEffect } from "react";
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
  onDelete,
  deleteDisabled = false,
}: {
  submitLabel: ReactNode;
  submitDisabled?: boolean;
  deleteLabel?: string;
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
          <Trash2 size={18} />
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
    onDelete,
    deleteDisabled,
    onSubmit,
    formRef,
    onChange,
  } = props;
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
        !busy &&
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
        busy={busy}
        actions={headerActions}
      />
      <div className={bodyClassName}>{children}</div>
      {submitLabel ? (
        <BottomSheetFooter
          submitLabel={submitLabel}
          submitDisabled={submitDisabled}
          deleteLabel={deleteLabel}
          onDelete={onDelete}
          deleteDisabled={deleteDisabled}
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
          onSubmit={onSubmit}
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
    </div>
  );
}
