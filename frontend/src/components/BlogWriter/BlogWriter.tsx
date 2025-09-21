import React, { useState, useEffect } from 'react';
import { CopilotSidebar } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';
import { blogWriterApi } from '../../services/blogWriterApi';
import { useOutlinePolling, useMediumGenerationPolling, useResearchPolling } from '../../hooks/usePolling';
import { useClaimFixer } from '../../hooks/useClaimFixer';
import { useMarkdownProcessor } from '../../hooks/useMarkdownProcessor';
import { useBlogWriterState } from '../../hooks/useBlogWriterState';
import { useSuggestions } from './SuggestionsGenerator';
import EnhancedOutlineEditor from './EnhancedOutlineEditor';
import ContinuityBadge from './ContinuityBadge';
import EnhancedTitleSelector from './EnhancedTitleSelector';
import SEOMiniPanel from './SEOMiniPanel';
import ResearchResults from './ResearchResults';
import KeywordInputForm from './KeywordInputForm';
import ResearchAction from './ResearchAction';
import { CustomOutlineForm } from './CustomOutlineForm';
import { ResearchDataActions } from './ResearchDataActions';
import { EnhancedOutlineActions } from './EnhancedOutlineActions';
import HallucinationChecker from './HallucinationChecker';
import Publisher from './Publisher';
import OutlineGenerator from './OutlineGenerator';
import OutlineRefiner from './OutlineRefiner';
import SEOProcessor from './SEOProcessor';
import BlogWriterLanding from './BlogWriterLanding';
import { OutlineProgressModal } from './OutlineProgressModal';
import OutlineFeedbackForm from './OutlineFeedbackForm';
import { BlogEditor } from './WYSIWYG';

export const BlogWriter: React.FC = () => {
  // Use custom hook for all state management
  const {
    research,
    outline,
    titleOptions,
    selectedTitle,
    sections,
    seoAnalysis,
    genMode,
    seoMetadata,
    continuityRefresh,
    outlineTaskId,
    sourceMappingStats,
    groundingInsights,
    optimizationResults,
    researchCoverage,
    researchTitles,
    aiGeneratedTitles,
    outlineConfirmed,
    setOutline,
    setTitleOptions,
    setSections,
    setSeoAnalysis,
    setGenMode,
    setSeoMetadata,
    setOutlineTaskId,
    handleResearchComplete,
    handleOutlineComplete,
    handleOutlineError,
    handleTitleSelect,
    handleCustomTitle,
    handleOutlineConfirmed,
    handleOutlineRefined,
    handleContentUpdate,
    handleContentSave
  } = useBlogWriterState();

  // Custom hooks for complex functionality
  const { buildFullMarkdown, buildUpdatedMarkdownForClaim, applyClaimFix } = useClaimFixer(
    outline,
    sections,
    setSections
  );
  
  const { convertMarkdownToHTML } = useMarkdownProcessor(
    outline,
    sections
  );

  // Research polling hook (for context awareness)
  const researchPolling = useResearchPolling({
    onComplete: handleResearchComplete,
    onError: (error) => console.error('Research polling error:', error)
  });

  // Outline polling hook
  const outlinePolling = useOutlinePolling({
    onComplete: handleOutlineComplete,
    onError: handleOutlineError
  });

  // Medium generation polling (used after confirm if short blog)
  const mediumPolling = useMediumGenerationPolling({
    onComplete: (result: any) => {
      try {
        if (result && result.sections) {
          const newSections: Record<string, string> = {};
          result.sections.forEach((s: any) => {
            newSections[String(s.id)] = s.content || '';
          });
          setSections(newSections);
        }
      } catch (e) {
        console.error('Failed to apply medium generation result:', e);
      }
    },
    onError: (err) => console.error('Medium generation failed:', err)
  });

  // Get context-aware suggestions based on current task status
  const suggestions = useSuggestions(
    research, 
    outline, 
    outlineConfirmed,
    { isPolling: researchPolling.isPolling, currentStatus: researchPolling.currentStatus },
    { isPolling: outlinePolling.isPolling, currentStatus: outlinePolling.currentStatus },
    { isPolling: mediumPolling.isPolling, currentStatus: mediumPolling.currentStatus }
  );

  // Add minimum display time for modal
  const [showModal, setShowModal] = useState(false);
  const [modalStartTime, setModalStartTime] = useState<number | null>(null);
  const [isMediumGenerationStarting, setIsMediumGenerationStarting] = useState(false);

  useEffect(() => {
    if ((mediumPolling.isPolling || isMediumGenerationStarting) && !showModal) {
      setShowModal(true);
      setModalStartTime(Date.now());
    } else if (!mediumPolling.isPolling && !isMediumGenerationStarting && showModal) {
      const elapsed = Date.now() - (modalStartTime || 0);
      const minDisplayTime = 2000; // 2 seconds minimum
      
      if (elapsed < minDisplayTime) {
        setTimeout(() => {
          setShowModal(false);
          setModalStartTime(null);
        }, minDisplayTime - elapsed);
      } else {
        setShowModal(false);
        setModalStartTime(null);
      }
    }
  }, [mediumPolling.isPolling, isMediumGenerationStarting, showModal, modalStartTime]);

  // Handle medium generation start from OutlineFeedbackForm
  const handleMediumGenerationStarted = (taskId: string) => {
    console.log('Starting medium generation polling for task:', taskId);
    setIsMediumGenerationStarting(false); // Clear the starting state
    mediumPolling.startPolling(taskId);
  };

  // Show modal immediately when copilot action is triggered
  const handleMediumGenerationTriggered = () => {
    console.log('Medium generation triggered - showing modal immediately');
    setIsMediumGenerationStarting(true);
  };

  // Debug medium polling state
  console.log('Medium polling state:', {
    isPolling: mediumPolling.isPolling,
    status: mediumPolling.currentStatus,
    progressCount: mediumPolling.progressMessages.length
  });





  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Extracted Components */}
      <KeywordInputForm 
        onResearchComplete={handleResearchComplete}
        onTaskStart={(taskId) => researchPolling.startPolling(taskId)}
      />
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
      <OutlineFeedbackForm 
        outline={outline} 
        research={research!} 
        onOutlineConfirmed={handleOutlineConfirmed}
        onOutlineRefined={handleOutlineRefined}
        onMediumGenerationStarted={handleMediumGenerationStarted}
        onMediumGenerationTriggered={handleMediumGenerationTriggered}
      />
      
      {/* New extracted functionality components */}
      <OutlineGenerator
        research={research}
        onTaskStart={(taskId) => setOutlineTaskId(taskId)}
        onPollingStart={(taskId) => outlinePolling.startPolling(taskId)}
      />
      <OutlineRefiner
        outline={outline}
        onOutlineUpdated={setOutline}
      />
      <SEOProcessor
        buildFullMarkdown={buildFullMarkdown}
        seoMetadata={seoMetadata}
        onSEOAnalysis={setSeoAnalysis}
        onSEOMetadata={setSeoMetadata}
      />
      <HallucinationChecker
        buildFullMarkdown={buildFullMarkdown}
        buildUpdatedMarkdownForClaim={buildUpdatedMarkdownForClaim}
        applyClaimFix={applyClaimFix}
      />
      <Publisher
        buildFullMarkdown={buildFullMarkdown}
        convertMarkdownToHTML={convertMarkdownToHTML}
        seoMetadata={seoMetadata}
      />
      
      {!research ? (
        <BlogWriterLanding 
          onStartWriting={() => {
            // This will trigger the copilot to start the research process
            // The user can then interact with the copilot to begin research
          }}
        />
      ) : (
        <>
      <div style={{ padding: 16, borderBottom: '1px solid #eee' }}>
        <h2 style={{ margin: 0 }}>AI Blog Writer</h2>
      </div>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <div style={{ flex: 1, overflow: 'auto' }}>
          {research && outline.length === 0 && <ResearchResults research={research} />}
          {outline.length > 0 && (
            <div>
              {outlineConfirmed ? (
                /* WYSIWYG Editor - Show when outline is confirmed */
                <BlogEditor 
                  outline={outline}
                  research={research}
                  initialTitle={selectedTitle}
                  titleOptions={titleOptions}
                  researchTitles={researchTitles}
                  aiGeneratedTitles={aiGeneratedTitles}
                  sections={sections}
                  onContentUpdate={handleContentUpdate}
                  onSave={handleContentSave}
                />
              ) : (
                /* Outline Editor - Show when outline is not confirmed */
                <>
                  {/* Enhanced Title Selection */}
                  <EnhancedTitleSelector
                      titleOptions={titleOptions}
                      selectedTitle={selectedTitle}
                    sections={outline}
                    researchTitles={researchTitles}
                    aiGeneratedTitles={aiGeneratedTitles}
                    onTitleSelect={handleTitleSelect}
                    onCustomTitle={handleCustomTitle}
                    />
                  

                  {/* Enhanced Outline Editor */}
                  <EnhancedOutlineEditor 
                    outline={outline} 
                    research={research}
                    sourceMappingStats={sourceMappingStats}
                    groundingInsights={groundingInsights}
                    optimizationResults={optimizationResults}
                    researchCoverage={researchCoverage}
                    onRefine={(op, id, payload) => blogWriterApi.refineOutline({ outline, operation: op, section_id: id, payload }).then((res: any) => setOutline(res.outline))} 
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
                </>
              )}
            </div>
          )}
        </div>
      </div>
        </>
      )}

      <CopilotSidebar
        labels={{ 
          title: 'ALwrity Co-Pilot', 
          initial: !research 
            ? 'Hi! I can help you research, outline, and draft your blog. Just tell me what topic you want to write about and I\'ll get started!' 
            : 'Great! I can see you have research data. Let me help you create an outline and generate content for your blog.'
        }}
        suggestions={suggestions}
        makeSystemMessage={(context: string, additional?: string) => {
          // Get current state information
          const hasResearch = research !== null;
          const hasOutline = outline.length > 0;
          const isOutlineConfirmed = outlineConfirmed;
          const researchInfo = hasResearch ? {
            sources: research.sources?.length || 0,
            queries: research.search_queries?.length || 0,
            angles: research.suggested_angles?.length || 0,
            primaryKeywords: research.keyword_analysis?.primary || [],
            searchIntent: research.keyword_analysis?.search_intent || 'informational'
          } : null;

          const outlineContext = hasOutline ? `
OUTLINE DETAILS:
- Total sections: ${outline.length}
- Section headings: ${outline.map(s => s.heading).join(', ')}
- Total target words: ${outline.reduce((sum, s) => sum + (s.target_words || 0), 0)}
- Section breakdown: ${outline.map(s => `${s.heading} (${s.target_words || 0} words, ${s.subheadings?.length || 0} subheadings, ${s.key_points?.length || 0} key points)`).join('; ')}
` : '';

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

${hasOutline ? `✅ OUTLINE GENERATED: ${outline.length} sections created${isOutlineConfirmed ? ' (CONFIRMED)' : ' (PENDING CONFIRMATION)'}` : '❌ No outline generated yet'}
${outlineContext}

Available tools:
- getResearchKeywords(prompt?: string) - Get keywords from user for research
- performResearch(formData: string) - Perform research with collected keywords (formData is JSON string with keywords and blogLength)
- researchTopic(keywords: string, industry?: string, target_audience?: string)
- chatWithResearchData(question: string) - Chat with research data to explore insights and get recommendations
- generateOutline()
- createOutlineWithCustomInputs(customInstructions: string) - Create outline with user's custom instructions
- refineOutline(prompt?: string) - Refine outline based on user feedback
- chatWithOutline(question?: string) - Chat with outline to get insights and ask questions about content structure
- confirmOutlineAndGenerateContent() - Confirm outline and mark as ready for content generation (does NOT auto-generate content)
- generateSection(sectionId: string)
- generateAllSections()
- refineOutlineStructure(operation: add|remove|move|merge|rename, sectionId?: string, payload?: object)
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
       - After outline generation, ALWAYS guide user to review and confirm the outline
       - If user wants to discuss the outline, use chatWithOutline() to provide insights and answer questions
       - If user wants to refine the outline, use refineOutline() to collect their feedback and refine
       - When user clicks "Confirm & Generate Content", ONLY call confirmOutlineAndGenerateContent() - DO NOT automatically generate content
       - Only after outline confirmation, show content generation suggestions and wait for user to explicitly request content generation
       - When user asks to generate content before outline confirmation, remind them to confirm the outline first
       - Content generation should ONLY happen when user explicitly clicks "Generate all sections" or "Generate [specific section]"
       
       ENGAGEMENT TACTICS:
       - DO NOT ask for clarification - take action immediately with the information provided
       - Always call the appropriate tool instead of just talking about what you could do
       - Be aware of the current state and reference research results when relevant
       - Guide users through the process: Research → Outline → Outline Review & Confirmation → Content → SEO → Publish
       - Use encouraging language and highlight progress made
       - If user seems lost, remind them of the current stage and suggest the next step
       - When research is complete, emphasize the value of the data found and guide to outline creation
       - When outline is generated, emphasize the importance of reviewing and confirming before content generation
       - Encourage users to make small manual edits to the outline UI before using AI for major changes
`;
          return [toolGuide, additional].filter(Boolean).join('\n\n');
        }}
      />
      
      {/* Outline Progress Modal */}
      {/* Outline modal */}
      <OutlineProgressModal
        isVisible={outlinePolling.isPolling}
        status={outlinePolling.currentStatus}
        progressMessages={outlinePolling.progressMessages.map(m => m.message)}
        latestMessage={outlinePolling.progressMessages.length > 0 ? outlinePolling.progressMessages[outlinePolling.progressMessages.length - 1].message : ''}
        error={outlinePolling.error}
      />

      {/* Medium generation modal */}
      <OutlineProgressModal
        isVisible={showModal}
        status={mediumPolling.currentStatus}
        progressMessages={mediumPolling.progressMessages.map(m => m.message)}
        latestMessage={mediumPolling.progressMessages.length > 0 ? mediumPolling.progressMessages[mediumPolling.progressMessages.length - 1].message : ''}
        error={mediumPolling.error}
        titleOverride={'📝 Generating Your Blog Content'}
      />
    </div>
  );
};

export default BlogWriter;