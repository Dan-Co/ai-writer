import React, { useMemo, useState } from 'react';
import { CopilotSidebar } from '@copilotkit/react-ui';
import { useCopilotAction } from '@copilotkit/react-core';
import '@copilotkit/react-ui/styles.css';
import { blogWriterApi, BlogOutlineSection, BlogResearchResponse, BlogSEOMetadataResponse, BlogSEOAnalyzeResponse } from '../../services/blogWriterApi';
import EnhancedOutlineEditor from './EnhancedOutlineEditor';
import ContinuityBadge from './ContinuityBadge';
import TitleSelector from './TitleSelector';
import DiffPreview from './DiffPreview';
import SEOMiniPanel from './SEOMiniPanel';
import ResearchResults from './ResearchResults';
import KeywordInputForm from './KeywordInputForm';
import ResearchAction from './ResearchAction';
import { CustomOutlineForm } from './CustomOutlineForm';
import { ResearchDataActions } from './ResearchDataActions';
import { EnhancedOutlineActions } from './EnhancedOutlineActions';

const useCopilotActionTyped = useCopilotAction as any;

export const BlogWriter: React.FC = () => {
  const [research, setResearch] = useState<BlogResearchResponse | null>(null);
  const [outline, setOutline] = useState<BlogOutlineSection[]>([]);
  const [titleOptions, setTitleOptions] = useState<string[]>([]);
  const [selectedTitle, setSelectedTitle] = useState<string>('');
  const [sections, setSections] = useState<Record<string, string>>({});
  const [seoAnalysis, setSeoAnalysis] = useState<BlogSEOAnalyzeResponse | null>(null);
  const [genMode, setGenMode] = useState<'draft' | 'polished'>('polished');
  const [seoMetadata, setSeoMetadata] = useState<BlogSEOMetadataResponse | null>(null);
  const [hallucinationResult, setHallucinationResult] = useState<any>(null);
  const [continuityRefresh, setContinuityRefresh] = useState<number>(0);

  const buildFullMarkdown = () => {
    if (!outline.length) return '';
    return outline.map(s => `## ${s.heading}\n\n${sections[s.id] || ''}`).join('\n\n');
  };

  // Sentence-level claim mapping and patching helpers
  const normalized = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

  const fuzzyScore = (a: string, b: string) => {
    // Dice's coefficient over word bigrams for robustness (no deps)
    const bigrams = (s: string) => {
      const t = s.split(/\W+/).filter(Boolean);
      const grams: string[] = [];
      for (let i = 0; i < t.length - 1; i++) grams.push(`${t[i]} ${t[i+1]}`);
      return grams;
    };
    const A = new Set(bigrams(a));
    const B = new Set(bigrams(b));
    if (!A.size || !B.size) return 0;
    let overlap = 0;
    A.forEach(g => { if (B.has(g)) overlap++; });
    return (2 * overlap) / (A.size + B.size);
  };

  const findSentenceForClaim = (md: string, claimText: string) => {
    const text = md || '';
    // Split by sentence enders; keep delimiters
    const sentences = text.split(/(?<=[.!?])\s+/);
    const normalizedClaim = claimText.trim().toLowerCase();
    // Direct includes first
    let bestIndex = sentences.findIndex(s => s.toLowerCase().includes(normalizedClaim));
    if (bestIndex >= 0) return { sentence: sentences[bestIndex], index: bestIndex, sentences };
    // Fallback: overlap ratio by words
    const claimWords = normalizedClaim.split(/\W+/).filter(Boolean);
    let bestScore = 0; bestIndex = -1;
    sentences.forEach((s, i) => {
      const sw = s.toLowerCase().split(/\W+/).filter(Boolean);
      const overlap = claimWords.filter(w => sw.includes(w)).length;
      const score = overlap / Math.max(claimWords.length, 1);
      if (score > bestScore) { bestScore = score; bestIndex = i; }
    });
    // Second fallback: Dice coefficient on normalized strings
    if (bestIndex < 0) {
      let diceBest = 0; let diceIdx = -1;
      sentences.forEach((s, i) => {
        const sc = fuzzyScore(normalized(s), normalized(claimText));
        if (sc > diceBest) { diceBest = sc; diceIdx = i; }
      });
      if (diceIdx >= 0) return { sentence: sentences[diceIdx], index: diceIdx, sentences };
    }
    if (bestIndex >= 0) return { sentence: sentences[bestIndex], index: bestIndex, sentences };
    return { sentence: '', index: -1, sentences };
  };

  const buildUpdatedMarkdownForClaim = (claimText: string, supportingUrl?: string) => {
    const md = buildFullMarkdown();
    const { sentence, index, sentences } = findSentenceForClaim(md, claimText);
    if (!sentence || index < 0) return { original: '', updated: '', updatedMarkdown: md };
    const alreadyHasLink = /\[[^\]]+\]\(([^)]+)\)/.test(sentence);
    const fix = supportingUrl && !alreadyHasLink ? `${sentence} [source](${supportingUrl})` : sentence;
    const updatedSentences = [...sentences];
    updatedSentences[index] = fix;
    const updatedMarkdown = updatedSentences.join(' ');
    return { original: sentence, updated: fix, updatedMarkdown };
  };

  const applyClaimFix = (claimText: string, supportingUrl?: string) => {
    // Naive fix: append citation footnote to the first occurrence of claim text
    const { updatedMarkdown } = buildUpdatedMarkdownForClaim(claimText, supportingUrl);
    const updated = updatedMarkdown;
    // Re-split content back to per-section, by headings
    const parts = updated.split(/^## /gm).filter(Boolean);
    const newSections: Record<string, string> = {};
    outline.forEach((s, idx) => {
      const body = parts[idx] ? parts[idx].replace(new RegExp(`^${s.heading}\n\n?`), '') : (sections[s.id] || '');
      newSections[s.id] = body;
    });
    setSections(newSections);
  };

  // Handle research completion
  const handleResearchComplete = (researchData: BlogResearchResponse) => {
    setResearch(researchData);
  };

  useCopilotActionTyped({
    name: 'generateOutline',
    description: 'Generate outline from research results using AI analysis',
    parameters: [],
    handler: async () => {
      if (!research) return { success: false, message: 'No research yet. Please research a topic first.' };
      
      try {
        const res = await blogWriterApi.generateOutline({ research });
        if (res?.outline) {
          setOutline(res.outline);
          setTitleOptions(res.title_options || []);
          if (res.title_options && res.title_options.length > 0) {
            setSelectedTitle(res.title_options[0]); // Auto-select first title
          }
          
          const outlineCount = res.outline.length;
          const primaryKeywords = research.keyword_analysis?.primary || [];
          
          return { 
            success: true, 
            message: `🧩 Outline generated successfully! Created ${outlineCount} sections based on your research. The outline incorporates your primary keywords (${primaryKeywords.join(', ')}) and follows the content angles we discovered. You can now review the outline structure, choose a title, and generate content for individual sections.`,
            outline_summary: {
              sections: outlineCount,
              primary_keywords: primaryKeywords,
              research_sources: research.sources?.length || 0,
              title_options: res.title_options?.length || 0
            }
          };
        }
      } catch (error) {
        console.error('Outline generation failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Provide more specific error messages based on the error type
        let userMessage = '❌ Outline generation failed. ';
        if (errorMessage.includes('503') || errorMessage.includes('overloaded')) {
          userMessage += 'The AI service is temporarily overloaded. Please try again in a few minutes.';
        } else if (errorMessage.includes('timeout')) {
          userMessage += 'The request timed out. Please try again.';
        } else if (errorMessage.includes('Invalid outline structure')) {
          userMessage += 'The AI generated an invalid response. Please try again with different research data.';
        } else {
          userMessage += `${errorMessage}. Please try again or contact support if the problem persists.`;
        }
        
        return { 
          success: false, 
          message: userMessage
        };
      }
      return { 
        success: false, 
        message: 'Failed to generate outline. The AI outline generation system encountered an issue. Please try again or contact support if the problem persists.' 
      };
    },
    render: ({ status }: any) => {
      console.log('generateOutline render called with status:', status);
      if (status === 'inProgress' || status === 'executing') {
        return (
          <div style={{ 
            padding: '16px', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
            margin: '8px 0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ 
                width: '20px', 
                height: '20px', 
                border: '2px solid #388e3c',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <h4 style={{ margin: 0, color: '#388e3c' }}>🧩 Generating Outline</h4>
            </div>
            <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.5' }}>
              <p style={{ margin: '0 0 8px 0' }}>• Analyzing research results and content angles...</p>
              <p style={{ margin: '0 0 8px 0' }}>• Structuring content based on keyword analysis...</p>
              <p style={{ margin: '0 0 8px 0' }}>• Creating logical flow and section hierarchy...</p>
              <p style={{ margin: '0' }}>• Optimizing for SEO and reader engagement...</p>
            </div>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        );
      }
      return null;
    }
  });

  useCopilotActionTyped({
    name: 'generateSection',
    description: 'Generate content for a specific section using research and outline',
    parameters: [ { name: 'sectionId', type: 'string', description: 'Section ID', required: true } ],
    handler: async ({ sectionId }: { sectionId: string }) => {
      const section = outline.find(s => s.id === sectionId);
      if (!section) return { success: false, message: 'Section not found. Please generate an outline first.' };
      
      try {
        const res = await blogWriterApi.generateSection({ section, mode: genMode });
        if (res?.markdown) {
          setSections(prev => ({ ...prev, [sectionId]: res.markdown }));
          setContinuityRefresh(Date.now());
          
          return { 
            success: true, 
            message: `✍️ Content generated for "${section.heading}"! The section incorporates your research findings and primary keywords. You can now review the content, run SEO analysis, or generate more sections.`,
            section_summary: {
              heading: section.heading,
              content_length: res.markdown.length,
              primary_keywords: research?.keyword_analysis?.primary || []
            }
          };
        }
      } catch (error) {
        console.error('Section generation failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { 
          success: false, 
          message: `❌ Content generation failed for "${section.heading}": ${errorMessage}. Please try again or contact support if the problem persists.` 
        };
      }
      return { success: false, message: 'Failed to generate section content. Please try again.' };
    },
    render: ({ status }: any) => {
      if (status === 'inProgress' || status === 'executing') {
        return (
          <div style={{ 
            padding: '16px', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
            margin: '8px 0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ 
                width: '20px', 
                height: '20px', 
                border: '2px solid #f57c00',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <h4 style={{ margin: 0, color: '#f57c00' }}>✍️ Generating Section Content</h4>
            </div>
            <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.5' }}>
              <p style={{ margin: '0 0 8px 0' }}>• Analyzing section requirements and research data...</p>
              <p style={{ margin: '0 0 8px 0' }}>• Incorporating primary keywords and SEO best practices...</p>
              <p style={{ margin: '0 0 8px 0' }}>• Writing engaging content with proper structure...</p>
              <p style={{ margin: '0' }}>• Ensuring factual accuracy and readability...</p>
            </div>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        );
      }
      return null;
    }
  });

  useCopilotActionTyped({
    name: 'generateAllSections',
    description: 'Generate content for every section in the outline',
    parameters: [],
    handler: async () => {
      for (const s of outline) {
        const res = await blogWriterApi.generateSection({ section: s, mode: genMode });
        setSections(prev => ({ ...prev, [s.id]: res.markdown }));
        setContinuityRefresh(Date.now());
      }
      return { success: true };
    },
    render: ({ status }: any) => (status === 'inProgress' || status === 'executing') ? <div>Generating all sections…</div> : null
  });

  // Outline refinement (basic op pass-through)
  useCopilotActionTyped({
    name: 'refineOutline',
    description: 'Refine the outline (add/remove/move/merge)',
    parameters: [
      { name: 'operation', type: 'string', description: 'add|remove|move|merge|rename', required: true },
      { name: 'sectionId', type: 'string', description: 'Target section ID', required: false },
      { name: 'payload', type: 'string', description: 'JSON payload for operation', required: false },
    ],
    handler: async ({ operation, sectionId, payload }: { operation: string; sectionId?: string; payload?: string }) => {
      const payloadObj = payload ? (() => { try { return JSON.parse(payload); } catch { return {}; } })() : undefined;
      const res = await blogWriterApi.refineOutline({ outline, operation, section_id: sectionId, payload: payloadObj });
      if (res?.outline) setOutline(res.outline);
      return { success: true };
    }
  });

  // Optimize section with HITL diff preview
  useCopilotActionTyped({
    name: 'optimizeSection',
    description: 'Optimize a section for readability/EEAT/examples/data with HITL diff',
    parameters: [
      { name: 'sectionId', type: 'string', description: 'Section ID', required: true },
      { name: 'goals', type: 'string', description: 'Comma-separated goals', required: false },
    ],
    handler: async ({ sectionId, goals }: { sectionId: string; goals?: string }) => {
      const current = sections[sectionId] || '';
      if (!current) return { success: false, message: 'No content yet for this section' };
      const res = await blogWriterApi.seoAnalyze({ content: current, keywords: [] });
      setSeoAnalysis(res);
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

  // SEO analyze full draft
  useCopilotActionTyped({
    name: 'runSEOAnalyze',
    description: 'Analyze SEO for the full draft',
    parameters: [ { name: 'keywords', type: 'string', description: 'Comma-separated keywords', required: false } ],
    handler: async ({ keywords }: { keywords?: string }) => {
      const content = buildFullMarkdown();
      const res = await blogWriterApi.seoAnalyze({ content, keywords: keywords ? keywords.split(',').map(k => k.trim()) : [] });
      setSeoAnalysis(res);
      return { success: true, seo_score: res.seo_score };
    },
    render: ({ status, result }: any) => status === 'complete' ? (
      <div style={{ padding: 12 }}>
        <div>SEO Score: {result?.seo_score ?? '—'}</div>
      </div>
    ) : null
  });

  // SEO metadata generate + HITL accept
  useCopilotActionTyped({
    name: 'generateSEOMetadata',
    description: 'Generate SEO metadata for the full draft',
    parameters: [ { name: 'title', type: 'string', description: 'Preferred title', required: false } ],
    handler: async ({ title }: { title?: string }) => {
      const content = buildFullMarkdown();
      const res = await blogWriterApi.seoMetadata({ content, title, keywords: [] });
      setSeoMetadata(res);
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

  // Hallucination check with HITL apply-fix
  useCopilotActionTyped({
    name: 'runHallucinationCheck',
    description: 'Run hallucination detector on full draft and view claims',
    parameters: [],
    handler: async () => {
      const content = buildFullMarkdown();
      const res = await fetch('/api/blog/quality/hallucination-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content })
      });
      const data = await res.json();
      setHallucinationResult(data);
      return { success: true, total_claims: data?.total_claims };
    },
    renderAndWaitForResponse: ({ respond, result }: any) => {
      if (!result) return null;
      const claims = hallucinationResult?.claims || [];
      return (
        <div style={{ padding: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Hallucination Check</div>
          <div>Total claims: {hallucinationResult?.total_claims ?? 0}</div>
          <ul>
            {claims.slice(0, 5).map((c: any, i: number) => {
              const supporting = (c.supporting_sources && c.supporting_sources[0]?.url) || undefined;
              const { original, updated } = buildUpdatedMarkdownForClaim(c.text, supporting);
              return (
                <li key={i} style={{ marginBottom: 10 }}>
                  <div style={{ marginBottom: 4 }}>[{c.assessment}] {c.text} (conf: {Math.round((c.confidence || 0)*100)/100})</div>
                  {original && updated ? (
                    <DiffPreview
                      original={original}
                      updated={updated}
                      onApply={() => { applyClaimFix(c.text, supporting); respond?.('applied'); }}
                      onDiscard={() => { respond?.('discarded'); }}
                    />
                  ) : (
                    <div style={{ fontStyle: 'italic', color: '#666' }}>No matching sentence found for preview.</div>
                  )}
                </li>
              );
            })}
          </ul>
          <button onClick={() => respond?.('ack')}>Close</button>
        </div>
      );
    }
  });




  // Publish (convert markdown -> HTML rudimentary; TODO: replace with proper converter like marked)
  useCopilotActionTyped({
    name: 'publishToPlatform',
    description: 'Publish the blog to Wix or WordPress',
    parameters: [
      { name: 'platform', type: 'string', description: 'wix|wordpress', required: true },
      { name: 'schedule_time', type: 'string', description: 'Optional ISO datetime', required: false }
    ],
    handler: async ({ platform, schedule_time }: { platform: 'wix' | 'wordpress'; schedule_time?: string }) => {
      const md = buildFullMarkdown();
      const html = md
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*)\*/gim, '<em>$1</em>')
        .replace(/\n\n/g, '<br/><br/>');
      if (!seoMetadata) return { success: false, message: 'Generate SEO metadata first' };
      const res = await blogWriterApi.publish({ platform, html, metadata: seoMetadata, schedule_time });
      return { success: true, url: res.url };
    },
    render: ({ status, result }: any) => status === 'complete' ? (
      <div style={{ padding: 12 }}>Published: {result?.url || 'Success'}</div>
    ) : null
  });

  const suggestions = useMemo(() => {
    const items = [] as { title: string; message: string }[];
    
    if (!research) {
      items.push({ title: '🔎 Start research', message: "I want to research a topic for my blog" });
    } else if (research && outline.length === 0) {
      // Research completed, guide user to outline creation
      items.push({ 
        title: '🧩 Create Outline', 
        message: 'Let\'s proceed to create an outline based on the research results'
      });
      items.push({ 
        title: '💬 Chat with Research Data', 
        message: 'I want to explore the research data and ask questions about the findings'
      });
      items.push({ 
        title: '🎨 Create Custom Outline', 
        message: 'I want to create an outline with my own specific instructions and requirements'
      });
    } else if (outline.length > 0) {
      // Outline created, focus on content generation
      items.push({ title: '📝 Generate all sections', message: 'Generate all sections of my blog post' });
      outline.forEach(s => items.push({ title: `✍️ Generate ${s.heading}`, message: `Generate the section: ${s.heading}` }));
      items.push({ title: '🔧 Refine outline', message: 'Help me refine the outline structure' });
      items.push({ title: '✨ Enhance outline', message: 'Optimize the entire outline for better flow and engagement' });
      items.push({ title: '⚖️ Rebalance word counts', message: 'Rebalance word count distribution across sections' });
      items.push({ title: '📈 Run SEO analysis', message: 'Analyze SEO for my blog post' });
      items.push({ title: '🧾 Generate SEO metadata', message: 'Generate SEO metadata and title' });
      items.push({ title: '🧪 Hallucination check', message: 'Check for any false claims in my content' });
      items.push({ title: '🚀 Publish to WordPress', message: 'Publish my blog to WordPress' });
    }
    
    return items;
  }, [research, outline]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Extracted Components */}
      <KeywordInputForm onResearchComplete={handleResearchComplete} />
      <CustomOutlineForm onOutlineCreated={setOutline} />
      <ResearchAction onResearchComplete={handleResearchComplete} />
      <ResearchDataActions 
        research={research} 
        onOutlineCreated={setOutline} 
        onTitleOptionsSet={setTitleOptions} 
      />
      <EnhancedOutlineActions 
        outline={outline} 
        onOutlineUpdated={setOutline} 
      />
      
      <div style={{ padding: 16, borderBottom: '1px solid #eee' }}>
        <h2 style={{ margin: 0 }}>AI Blog Writer</h2>
      </div>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, padding: 16, overflow: 'auto' }}>
          {!research && (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px 20px',
              color: '#666',
              fontSize: '16px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
              <h3 style={{ margin: '0 0 8px 0', color: '#333' }}>Ready to Research Your Blog Topic</h3>
              <p style={{ margin: 0 }}>Start by asking the copilot to research your topic.</p>
            </div>
          )}
          {research && outline.length === 0 && <ResearchResults research={research} />}
          {outline.length > 0 && (
            <div>
              {/* Title Selection */}
              {titleOptions.length > 0 && (
                <TitleSelector
                  titleOptions={titleOptions}
                  selectedTitle={selectedTitle}
                  onTitleSelect={setSelectedTitle}
                  onCustomTitle={(title) => {
                    setTitleOptions(prev => [...prev, title]);
                    setSelectedTitle(title);
                  }}
                />
              )}
              
              {/* Enhanced Outline Editor */}
              <EnhancedOutlineEditor 
                outline={outline} 
                research={research}
                onRefine={(op, id, payload) => blogWriterApi.refineOutline({ outline, operation: op, section_id: id, payload }).then(res => setOutline(res.outline))} 
              />

              {/* Draft/Polished Mode Toggle */}
              <div style={{ margin: '12px 0' }}>
                <label style={{ marginRight: 8 }}>Generation mode:</label>
                <select value={genMode} onChange={(e) => setGenMode(e.target.value as 'draft' | 'polished')}>
                  <option value="draft">Draft (faster, lower cost)</option>
                  <option value="polished">Polished (higher quality)</option>
                </select>
              </div>

              {outline.map(s => (
                <div key={s.id} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h4 style={{ margin: 0 }}>{s.heading}</h4>
                    {/* Continuity badge */}
                    {sections[s.id] && (
                      <ContinuityBadge sectionId={s.id} refreshToken={continuityRefresh} />
                    )}
                  </div>
                  {sections[s.id] ? (
                    <>
                      <pre style={{ whiteSpace: 'pre-wrap' }}>{sections[s.id]}</pre>
                      <SEOMiniPanel analysis={seoAnalysis} />
                    </>
                  ) : (
                    <div style={{ fontStyle: 'italic', color: '#666' }}>Ask the copilot to generate this section.</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CopilotSidebar
        labels={{ title: 'ALwrity Co-Pilot', initial: 'Hi! I can help you research, outline, and draft your blog. Just tell me what topic you want to write about and I\'ll get started!' }}
        suggestions={suggestions}
        makeSystemMessage={(context: string, additional?: string) => {
          // Get current state information
          const hasResearch = research !== null;
          const hasOutline = outline.length > 0;
          const researchInfo = hasResearch ? {
            sources: research.sources?.length || 0,
            queries: research.search_queries?.length || 0,
            angles: research.suggested_angles?.length || 0,
            primaryKeywords: research.keyword_analysis?.primary || [],
            searchIntent: research.keyword_analysis?.search_intent || 'informational'
          } : null;

          const toolGuide = `
You are the ALwrity Blog Writing Assistant. You MUST call the appropriate frontend actions (tools) to fulfill user requests.

CURRENT STATE:
${hasResearch && researchInfo ? `
✅ RESEARCH COMPLETED:
- Found ${researchInfo.sources} sources with Google Search grounding
- Generated ${researchInfo.queries} search queries
- Created ${researchInfo.angles} content angles
- Primary keywords: ${researchInfo.primaryKeywords.join(', ')}
- Search intent: ${researchInfo.searchIntent}
` : '❌ No research completed yet'}

${hasOutline ? `✅ OUTLINE GENERATED: ${outline.length} sections created` : '❌ No outline generated yet'}

Available tools:
- getResearchKeywords(prompt?: string) - Get keywords from user for research
- performResearch(formData: string) - Perform research with collected keywords (formData is JSON string with keywords and blogLength)
- researchTopic(keywords: string, industry?: string, target_audience?: string)
- chatWithResearchData(question: string) - Chat with research data to explore insights and get recommendations
- generateOutline()
- createOutlineWithCustomInputs(customInstructions: string) - Create outline with user's custom instructions
- generateSection(sectionId: string)
- generateAllSections()
- refineOutline(operation: add|remove|move|merge|rename, sectionId?: string, payload?: object)
- enhanceSection(sectionId: string, focus?: string) - Enhance a specific section with AI improvements
- optimizeOutline(focus?: string) - Optimize entire outline for better flow, SEO, and engagement
- rebalanceOutline(targetWords?: number) - Rebalance word count distribution across sections
- runSEOAnalyze(keywords?: string)
- generateSEOMetadata(title?: string)
- runHallucinationCheck()
- publishToPlatform(platform: 'wix'|'wordpress', schedule_time?: string)

       CRITICAL BEHAVIOR & USER GUIDANCE:
       - When user wants to research ANY topic, IMMEDIATELY call getResearchKeywords() to get their input
       - When user asks to research something, call getResearchKeywords() first to collect their keywords
       - After getResearchKeywords() completes, IMMEDIATELY call performResearch() with the collected data
       
       USER GUIDANCE STRATEGY:
       - After research completion, ALWAYS guide user toward outline creation as the next step
       - If user wants to explore research data, use chatWithResearchData() but then guide them to outline creation
       - If user has specific outline requirements, use createOutlineWithCustomInputs() with their instructions
       - When user asks for outline, call generateOutline() or createOutlineWithCustomInputs() based on their needs
       - When user asks to generate content, call generateSection or generateAllSections
       
       ENGAGEMENT TACTICS:
       - DO NOT ask for clarification - take action immediately with the information provided
       - Always call the appropriate tool instead of just talking about what you could do
       - Be aware of the current state and reference research results when relevant
       - Guide users through the process: Research → Outline → Content → SEO → Publish
       - Use encouraging language and highlight progress made
       - If user seems lost, remind them of the current stage and suggest the next step
       - When research is complete, emphasize the value of the data found and guide to outline creation
`;
          return [toolGuide, additional].filter(Boolean).join('\n\n');
        }}
      />
    </div>
  );
};

export default BlogWriter;