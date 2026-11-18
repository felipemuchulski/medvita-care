export function SessionLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <p
        role="status"
        className="w-full max-w-lg rounded-xl border border-border bg-white p-6 text-center text-text-secondary"
      >
        Recuperando sua sessão...
      </p>
    </div>
  )
}
