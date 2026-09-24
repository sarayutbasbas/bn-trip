"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";

function fieldLabel(field: HTMLElement) {
  const labelledBy = field.getAttribute("aria-labelledby");
  const labelled = labelledBy ? document.getElementById(labelledBy)?.textContent : "";
  const wrapped = field.closest("label")?.querySelector("span")?.textContent;
  const nearby = field.closest(".field")?.querySelector("label")?.textContent;
  return (labelled || nearby || wrapped || field.getAttribute("aria-label") || "ข้อมูลที่จำเป็น")
    .replace(/\s+/g, " ")
    .trim();
}

function validationMessage(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  const label = fieldLabel(field);
  if (field.validity.valueMissing) return `กรุณากรอกหรือเลือก “${label}”`;
  if (field.validity.typeMismatch) return `รูปแบบ “${label}” ไม่ถูกต้อง`;
  if (field.validity.rangeUnderflow) return `“${label}” ต้องไม่น้อยกว่า ${field.getAttribute("min") || "ค่าที่กำหนด"}`;
  if (field.validity.rangeOverflow) return `“${label}” ต้องไม่เกิน ${field.getAttribute("max") || "ค่าที่กำหนด"}`;
  if (field.validity.tooShort) return `“${label}” สั้นกว่าที่กำหนด`;
  if (field.validity.tooLong) return `“${label}” ยาวเกินกว่าที่กำหนด`;
  if (field.validity.patternMismatch) return `รูปแบบ “${label}” ไม่ถูกต้อง`;
  return field.validationMessage || `กรุณาตรวจสอบ “${label}”`;
}

export function FormErrorDialog({
  title = "กรุณาตรวจสอบข้อมูล",
  description,
  onClose,
}: {
  title?: string;
  description: string;
  onClose: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => buttonRef.current?.focus(), []);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="confirm-backdrop error-dialog-backdrop" role="presentation">
      <div className="confirm-dialog error-dialog" role="alertdialog" aria-modal="true" aria-labelledby="form-error-title" aria-describedby="form-error-description">
        <span className="confirm-icon error-dialog-icon"><AlertTriangle size={22}/></span>
        <h2 id="form-error-title">{title}</h2>
        <p id="form-error-description">{description}</p>
        <div className="confirm-actions error-dialog-actions">
          <button ref={buttonRef} type="button" className="confirm-delete" onClick={onClose}>ตกลง</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function GlobalFormValidationDialog() {
  const [error, setError] = useState<{ message: string; field: HTMLElement } | null>(null);
  const openRef = useRef(false);
  useEffect(() => {
    const handleInvalid = (event: Event) => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) return;
      event.preventDefault();
      if (openRef.current) return;
      openRef.current = true;
      setError({ message: validationMessage(field), field });
    };
    document.addEventListener("invalid", handleInvalid, true);
    return () => document.removeEventListener("invalid", handleInvalid, true);
  }, []);
  if (!error) return null;
  return <FormErrorDialog description={error.message} onClose={() => {
    const field = error.field;
    openRef.current = false;
    setError(null);
    window.requestAnimationFrame(() => field.focus({ preventScroll: false }));
  }}/>;
}
