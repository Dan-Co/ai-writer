import React, { useEffect, useState } from 'react';
import { blogWriterApi } from '../../services/blogWriterApi';

interface Props { sectionId: string; refreshToken?: number }

export const ContinuityBadge: React.FC<Props> = ({ sectionId, refreshToken }) => {
  const [metrics, setMetrics] = useState<Record<string, number> | null>(null);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    let mounted = true;
    blogWriterApi.getContinuity(sectionId)
      .then(res => { if (mounted) setMetrics(res.continuity_metrics || null); })
      .catch(() => { /* ignore */ });
    return () => { mounted = false; };
  }, [sectionId, refreshToken]);

  if (!metrics) return null;
  const flow = Math.round(((metrics.flow || 0) * 100));
  const color = flow >= 80 ? '#2e7d32' : flow >= 60 ? '#f9a825' : '#c62828';

  const consistency = Math.round(((metrics.consistency || 0) * 100));
  const progression = Math.round(((metrics.progression || 0) * 100));

  return (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <span
        title={`Flow ${flow}%`}
        style={{
          display: 'inline-block',
          fontSize: 12,
          color: color,
          border: `1px solid ${color}`,
          padding: '2px 6px',
          borderRadius: 10,
          background: 'transparent'
        }}
      >
        Flow {flow}%
      </span>

      {hover && (
        <div
          style={{
            position: 'absolute',
            top: '150%',
            left: 0,
            zIndex: 10,
            background: '#fff',
            color: '#333',
            border: '1px solid #e0e0e0',
            borderRadius: 8,
            padding: '8px 10px',
            minWidth: 180,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>Continuity</div>
          <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span>Flow</span><span>{flow}%</span>
          </div>
          <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span>Consistency</span><span>{consistency}%</span>
          </div>
          <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span>Progression</span><span>{progression}%</span>
          </div>
        </div>
      )}
    </span>
  );
};

export default ContinuityBadge;


