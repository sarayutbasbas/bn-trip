"use client";

import { AlertTriangle } from "lucide-react";
import { LiquiGlass } from "@liqui-design/glass";
import { useCallback, useEffect, useRef, useState } from "react";

const FORM_ERROR_SELECTOR =
  ".form-error, .login-error, .trip-idea-error, .workspace-error, [data-form-error]";

function isBottomSheetForm(form: HTMLFormElement | null) {
  return Boolean(form?.closest(".modal-backdrop"));
}

function fieldName(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  const label = field.labels?.[0]?.textContent?.replace(/\s+/g, " ").trim();
  return label ? `“${label}”` : "ช่องนี้";
}

function nativeValidationMessage(
  field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
) {
  const name = fieldName(field);
  if (field.validity.valueMissing) return `กรุณากรอกหรือเลือกข้อมูลใน ${name}`;
  if (field.validity.typeMismatch) return `รูปแบบข้อมูลใน ${name} ไม่ถูกต้อง`;
  if (field.validity.patternMismatch) return `รูปแบบข้อมูลใน ${name} ไม่ถูกต้อง`;
  if (field.validity.tooShort) return `${name} สั้นกว่าที่กำหนด`;
  if (field.validity.tooLong) return `${name} ยาวเกินกว่าที่กำหนด`;
  if (field.validity.rangeUnderflow || field.validity.rangeOverflow) {
    return `ค่าของ ${name} อยู่นอกช่วงที่กำหนด`;
  }
  return field.validationMessage || `กรุณาตรวจสอบข้อมูลใน ${name}`;
}

/**
 * Presents submit validation errors above every bottom sheet. Native constraint
 * errors are captured before the browser can show its small, easy-to-miss bubble;
 * custom errors are picked up from the form's existing error region.
 */
export function FormValidationAlert() {
  const [message, setMessage] = useState("");
  const submittedFormRef = useRef<HTMLFormElement | null>(null);
  const invalidFieldRef = useRef<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null
  >(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const lastShownMessageRef = useRef("");
  const nativeValidationHandledRef = useRef(false);

  const show = useCallback(
    (
      nextMessage: string,
      invalidField?: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
    ) => {
      const normalized = nextMessage.replace(/\s+/g, " ").trim();
      if (!normalized) return;
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      invalidFieldRef.current = invalidField || null;
      lastShownMessageRef.current = normalized;
      setMessage(normalized);
    },
    [],
  );

  const inspectSubmittedForm = useCallback(() => {
    const form = submittedFormRef.current;
    if (!form?.isConnected || !isBottomSheetForm(form)) return;

    const regions = Array.from(
      form.querySelectorAll<HTMLElement>(FORM_ERROR_SELECTOR),
    );
    const region = regions.find((candidate) => {
      const text = candidate.textContent?.replace(/\s+/g, " ").trim();
      return text && candidate.getClientRects().length > 0;
    });
    const nextMessage = region?.textContent?.replace(/\s+/g, " ").trim() || "";
    if (nextMessage && nextMessage !== lastShownMessageRef.current) show(nextMessage);
  }, [show]);

  useEffect(() => {
    const handleSubmit = (event: SubmitEvent) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (!isBottomSheetForm(form)) return;
      submittedFormRef.current = form;
      lastShownMessageRef.current = "";
      window.setTimeout(inspectSubmittedForm, 0);
      window.setTimeout(inspectSubmittedForm, 150);
    };

    const handleInvalid = (event: Event) => {
      const field = event.target;
      if (
        !(field instanceof HTMLInputElement) &&
        !(field instanceof HTMLSelectElement) &&
        !(field instanceof HTMLTextAreaElement)
      ) {
        return;
      }
      if (!isBottomSheetForm(field.form)) return;

      event.preventDefault();
      if (nativeValidationHandledRef.current) return;
      // A constraint failure prevents the submit event. Drop any previous form
      // so an older inline error cannot replace this field-specific message.
      submittedFormRef.current = null;
      nativeValidationHandledRef.current = true;
      window.setTimeout(() => {
        nativeValidationHandledRef.current = false;
      }, 0);
      show(nativeValidationMessage(field), field);
    };

    const observer = new MutationObserver(inspectSubmittedForm);
    document.addEventListener("submit", handleSubmit, true);
    document.addEventListener("invalid", handleInvalid, true);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    return () => {
      document.removeEventListener("submit", handleSubmit, true);
      document.removeEventListener("invalid", handleInvalid, true);
      observer.disconnect();
    };
  }, [inspectSubmittedForm, show]);

  const close = () => {
    const field = invalidFieldRef.current;
    const previous = previouslyFocusedRef.current;
    setMessage("");
    invalidFieldRef.current = null;
    window.requestAnimationFrame(() => {
      if (field?.isConnected) {
        field.focus({ preventScroll: true });
        field.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (previous?.isConnected) {
        previous.focus({ preventScroll: true });
      }
    });
  };

  if (!message) return null;

  return (
    <div className="validation-alert-backdrop">
      <LiquiGlass
        className="validation-alert-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="validation-alert-title"
        aria-describedby="validation-alert-message"
        radius={24}
        blur={1.5}
        frost={0.58}
        refraction={96}
        bezel={24}
        specular={0.8}
        elevated
        contentClassName="validation-alert-dialog-content"
      >
        <span className="validation-alert-icon" aria-hidden="true">
          <AlertTriangle size={25} strokeWidth={2.2} />
        </span>
        <h2 id="validation-alert-title">ไม่สามารถบันทึกได้</h2>
        <p id="validation-alert-message">{message}</p>
        <button type="button" onClick={close} autoFocus>
          ตกลง
        </button>
      </LiquiGlass>
    </div>
  );
}
