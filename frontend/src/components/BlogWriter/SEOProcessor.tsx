import React from 'react';
import { useCopilotAction } from '@copilotkit/react-core';
import { blogWriterApi, BlogSEOMetadataResponse } from '../../services/blogWriterApi';

interface SEOProcessorProps {
  buildFullMarkdown: () => string;
  seoMetadata: BlogSEOMetadataResponse | null;
  onSEOAnalysis: (analysis: any) => void;
  onSEOMetadata: (metadata: BlogSEOMetadataResponse) => void;
}

const useCopilotActionTyped = useCopilotAction as any;

export const SEOProcessor: React.FC<SEOProcessorProps> = ({
  buildFullMarkdown,
  seoMetadata,
  onSEOAnalysis,
  onSEOMetadata
}) => {
  useCopilotActionTyped({
    name: 'runSEOAnalyze',
    description: 'Analyze SEO for the full draft',
    parameters: [ { name: 'keywords', type: 'string', description: 'Comma-separated keywords', required: false } ],
    handler: async ({ keywords }: { keywords?: string }) => {
      const content = buildFullMarkdown();
      const res = await blogWriterApi.seoAnalyze({ content, keywords: keywords ? keywords.split(',').map(k => k.trim()) : [] });
      onSEOAnalysis(res);
      return { success: true, seo_score: res.seo_score };
    },
    render: ({ status, result }: any) => status === 'complete' ? (
      <div style={{ padding: 12 }}>
        <div>SEO Score: {result?.seo_score ?? '—'}</div>
      </div>
    ) : null
  });

  useCopilotActionTyped({
    name: 'generateSEOMetadata',
    description: 'Generate SEO metadata for the full draft',
    parameters: [ { name: 'title', type: 'string', description: 'Preferred title', required: false } ],
    handler: async ({ title }: { title?: string }) => {
      const content = buildFullMarkdown();
      const res = await blogWriterApi.seoMetadata({ content, title, keywords: [] });
      onSEOMetadata(res);
      return { success: true };
    },
    renderAndWaitForResponse: ({ respond }: any) => (
      <div style={{ padding: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>SEO Metadata Ready</div>
        <div style={{ marginBottom: 8 }}>Review the generated title, meta description, and OG/Twitter tags in the editor.</div>
        <button onClick={() => respond?.('accept')}>Accept Metadata</button>
      </div>
    )
  });

  useCopilotActionTyped({
    name: 'optimizeSection',
    description: 'Optimize a section for readability/EEAT/examples/data with HITL diff',
    parameters: [
      { name: 'sectionId', type: 'string', description: 'Section ID', required: true },
      { name: 'goals', type: 'string', description: 'Comma-separated goals', required: false },
    ],
    handler: async ({ sectionId, goals }: { sectionId: string; goals?: string }) => {
      const current = buildFullMarkdown();
      if (!current) return { success: false, message: 'No content yet for this section' };
      const res = await blogWriterApi.seoAnalyze({ content: current, keywords: [] });
      onSEOAnalysis(res);
      return { success: true, message: 'Analysis ready' };
    },
    renderAndWaitForResponse: ({ respond, args, status }: any) => {
      if (status === 'complete') return <div>Optimization applied.</div>;
      return (
        <div style={{ padding: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Optimization preview</div>
          <div style={{ marginBottom: 8 }}>Goals: {args.goals || 'readability, EEAT'}</div>
          <button onClick={() => respond?.('apply')}>Apply Changes</button>
        </div>
      );
    }
  });

  return null; // This component only provides the copilot actions
};

export default SEOProcessor;
