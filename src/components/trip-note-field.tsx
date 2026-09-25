import type { ChangeEventHandler } from "react";

export function TripNoteField({
  value,
  defaultValue,
  onChange,
  name = "note",
}: {
  value?: string;
  defaultValue?: string;
  onChange?: ChangeEventHandler<HTMLTextAreaElement>;
  name?: string;
}) {
  return (
    <label className="trip-idea-field trip-note-field">
      <span>โน้ต <small>(ไม่บังคับ)</small></span>
      <textarea
        name={name}
        maxLength={500}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        placeholder="สิ่งที่อยากทำ เหตุผลที่อยากไป หรือไอเดียคร่าว ๆ"
      />
    </label>
  );
}
