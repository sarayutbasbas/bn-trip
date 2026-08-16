"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function formSignature(form: HTMLFormElement | null) {
  if (!form) return "";
  const values: Array<[string, string]> = [];
  for (const [name, value] of new FormData(form).entries()) {
    if (value instanceof File) {
      if (!value.name && value.size === 0) continue;
      values.push([
        name,
        `${value.name}:${value.type}:${value.size}:${value.lastModified}`,
      ]);
    } else {
      values.push([name, value]);
    }
  }
  return JSON.stringify(values);
}

export function useFormDirty(resetKey: string, initiallyDirty = false) {
  const formRef = useRef<HTMLFormElement>(null);
  const baselineRef = useRef("");
  const frameRef = useRef<number | null>(null);
  const [hasChanges, setHasChanges] = useState(initiallyDirty);

  const checkForChanges = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      setHasChanges(formSignature(formRef.current) !== baselineRef.current);
    });
  }, []);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      baselineRef.current = formSignature(formRef.current);
      setHasChanges(initiallyDirty);
    });
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [initiallyDirty, resetKey]);

  return { formRef, hasChanges, checkForChanges };
}
