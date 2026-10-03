'use client';

import { SectorCard } from './SectorCard';

interface RelatedSectorsListProps {
  sectors: string[];
}

export function RelatedSectorsList({ sectors }: RelatedSectorsListProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
      {sectors.map((sector) => (
        <SectorCard key={sector} name={sector} />
      ))}
    </div>
  );
}
