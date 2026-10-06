/** Marks numbers that come from the demo fixture instead of the API. */
export function DemoBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="demo-badge" role="status">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" />
      </svg>
      Dados de demonstração — a API não respondeu
    </div>
  );
}
