import { useEffect, useRef, useState } from "react";
import type { Appointment } from "../types/appointment";
import { formatAppointment } from "../lib/appointment";
import { buttonClass, inputClass } from "./Selectors";
export function CancelAppointmentDialog({
  appointment,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  appointment: Appointment;
  pending: boolean;
  error: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    const el = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    el.showModal();
    return () => {
      el.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="cancel-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onClose();
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-xl p-4 backdrop:bg-black/40 sm:p-6"
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (lock.current || pending || reason.trim().length < 3) return;
          lock.current = true;
          try {
            await onConfirm(reason.trim());
          } finally {
            lock.current = false;
          }
        }}
      >
        <h2 id="cancel-title" className="text-xl font-bold">
          Cancelar agendamento?
        </h2>
        <p className="break-words">
          {appointment.patient.name} ·{" "}
          {formatAppointment(appointment.scheduledAt)} (UTC−03:00), com{" "}
          {appointment.professional.user.name}.
        </p>
        <label className="block">
          Motivo obrigatório
          <textarea
            autoFocus
            required
            minLength={3}
            maxLength={500}
            className={inputClass}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={pending}
          />
        </label>
        {error && (
          <p role="alert" className="text-red-800">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className={buttonClass}
            disabled={pending}
            onClick={onClose}
          >
            Voltar
          </button>
          <button
            className={buttonClass}
            disabled={pending || reason.trim().length < 3}
          >
            {pending ? "Cancelando..." : "Confirmar cancelamento"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
