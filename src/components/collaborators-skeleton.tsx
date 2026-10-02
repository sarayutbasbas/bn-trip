/** Reserve member rows, not full trip cards, while refreshing the directory. */
export function CollaboratorsSkeleton({ count, label }: { count: number; label: string }) {
  if (!count) return <p className="collaborator-empty" role="status" aria-busy="true">{label}</p>;
  return <div role="status" aria-label={label} aria-busy="true">
    {Array.from({ length: count }, (_, index) => <div className="collaborator-row collaborator-skeleton-row" key={index} aria-hidden="true">
      <span className="route-skeleton-block collaborator-skeleton-avatar" />
      <span className="route-skeleton-block collaborator-skeleton-line" />
    </div>)}
  </div>;
}
