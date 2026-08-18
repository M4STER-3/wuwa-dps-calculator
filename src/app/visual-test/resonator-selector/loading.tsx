import { V4Page, V4Panel, V4Skeleton } from "@/components/ui/v4-ui";

export default function V4ResonatorSelectorLoading() {
  return (
    <V4Page>
      <V4Panel aria-label="Chargement du sélecteur de Resonators">
        <V4Skeleton width="18%" height={10} />
        <div style={{ height: 12 }} />
        <V4Skeleton width="48%" height={28} />
        <div style={{ height: 10 }} />
        <V4Skeleton width="76%" height={12} />
        <div style={{ height: 28 }} />
        <V4Skeleton height={112} />
        <div style={{ height: 14 }} />
        <V4Skeleton height={52} />
      </V4Panel>
    </V4Page>
  );
}
