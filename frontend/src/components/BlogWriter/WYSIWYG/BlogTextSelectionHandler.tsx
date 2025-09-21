import React, { useState, useRef, useEffect } from 'react';
import { hallucinationDetectorService, HallucinationDetectionResponse } from '../../../services/hallucinationDetectorService';
import FactCheckResults from '../../LinkedInWriter/components/FactCheckResults';

interface BlogTextSelectionHandlerProps {
  contentRef: React.RefObject<HTMLDivElement | HTMLTextAreaElement>;
  onTextReplace?: (originalText: string, newText: string, editType: string) => void;
}

const useBlogTextSelectionHandler = (
  contentRef: React.RefObject<HTMLDivElement | HTMLTextAreaElement>,
  onTextReplace?: (originalText: string, newText: string, editType: string) => void
) => {
  const [selectionMenu, setSelectionMenu] = useState<{ x: number; y: number; text: string } | null>(null);
  const [factCheckResults, setFactCheckResults] = useState<HallucinationDetectionResponse | null>(null);
  const [isFactChecking, setIsFactChecking] = useState(false);
  const [factCheckProgress, setFactCheckProgress] = useState<{ step: string; progress: number } | null>(null);
  const selectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Smart typing assist states
  const [smartSuggestion, setSmartSuggestion] = useState<{ text: string; position: { x: number; y: number } } | null>(null);
  const [isGeneratingSuggestion, setIsGeneratingSuggestion] = useState(false);
  const [hasShownFirstSuggestion, setHasShownFirstSuggestion] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fact-checking functionality
  const handleCheckFacts = async (text: string) => {
    console.log('🔍 [BlogTextSelectionHandler] handleCheckFacts called with text:', text);
    if (!text.trim()) {
      console.log('🔍 [BlogTextSelectionHandler] No text to check, returning');
      return;
    }
    
    console.log('🔍 [BlogTextSelectionHandler] Starting fact check for:', text.trim());
    setIsFactChecking(true);
    setSelectionMenu(null);
    
    // Progress tracking
    const progressSteps = [
      { step: "Extracting verifiable claims...", progress: 20 },
      { step: "Searching for evidence...", progress: 40 },
      { step: "Analyzing claims against sources...", progress: 70 },
      { step: "Generating final assessment...", progress: 90 },
      { step: "Completing fact-check...", progress: 100 }
    ];
    
    let currentStepIndex = 0;
    
    // Start progress updates
    const progressInterval = setInterval(() => {
      if (currentStepIndex < progressSteps.length) {
        setFactCheckProgress(progressSteps[currentStepIndex]);
        currentStepIndex++;
      }
    }, 2000); // Update every 2 seconds
    
    // Set a timeout for the fact check (30 seconds)
    const timeoutId = setTimeout(() => {
      console.log('🔍 [BlogTextSelectionHandler] Fact check timeout reached');
      clearInterval(progressInterval);
      setFactCheckProgress(null);
      setIsFactChecking(false);
      setFactCheckResults({
        success: false,
        claims: [],
        overall_confidence: 0,
        total_claims: 0,
        supported_claims: 0,
        refuted_claims: 0,
        insufficient_claims: 0,
        timestamp: new Date().toISOString(),
        error: 'Fact check timed out after 30 seconds. Please try again with shorter text.'
      });
    }, 30000); // 30 second timeout
    
    try {
      console.log('🔍 [BlogTextSelectionHandler] Calling hallucinationDetectorService.detectHallucinations...');
      const results = await hallucinationDetectorService.detectHallucinations({
        text: text.trim(),
        include_sources: true,
        max_claims: 10
      });
      
      console.log('🔍 [BlogTextSelectionHandler] Fact check results received:', results);
      setFactCheckResults(results);
    } catch (error) {
      console.error('🔍 [BlogTextSelectionHandler] Error checking facts:', error);
      setFactCheckResults({
        success: false,
        claims: [],
        overall_confidence: 0,
        total_claims: 0,
        supported_claims: 0,
        refuted_claims: 0,
        insufficient_claims: 0,
        timestamp: new Date().toISOString(),
        error: `Failed to check facts: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      console.log('🔍 [BlogTextSelectionHandler] Fact check completed, setting isFactChecking to false');
      clearInterval(progressInterval);
      clearTimeout(timeoutId);
      setFactCheckProgress(null);
      setIsFactChecking(false);
    }
  };

  const handleCloseFactCheckResults = () => {
    setFactCheckResults(null);
  };

  // Blog-specific quick edit functionality for selected text
  const handleQuickEdit = (editType: string, selectedText: string) => {
    console.log('🔍 [BlogTextSelectionHandler] handleQuickEdit called:', editType, selectedText);
    
    let editedText = selectedText;
    
    switch (editType) {
      case 'improve':
        // Enhance readability and engagement
        editedText = selectedText.replace(/\./g, '. ').replace(/\s+/g, ' ').trim();
        if (!editedText.endsWith('.') && !editedText.endsWith('!') && !editedText.endsWith('?')) {
          editedText += '.';
        }
        break;
      case 'add-transition':
        // Add transitional phrases
        const transitions = ['Furthermore,', 'Additionally,', 'Moreover,', 'In essence,', 'As a result,'];
        const randomTransition = transitions[Math.floor(Math.random() * transitions.length)];
        editedText = `${randomTransition} ${selectedText.toLowerCase()}`;
        break;
      case 'shorten':
        // Condense while maintaining meaning
        editedText = selectedText
          .replace(/\b(very|really|extremely|quite|rather|fairly)\s+/gi, '')
          .replace(/\b(that|which) (is|are|was|were)\s+/gi, '')
          .replace(/\bin order to\b/gi, 'to')
          .replace(/\bdue to the fact that\b/gi, 'because')
          .trim();
        break;
      case 'expand':
        // Add explanatory content
        editedText = selectedText + ' This approach provides significant value by offering concrete benefits and actionable insights that readers can immediately implement.';
        break;
      case 'professionalize':
        // Make more formal and professional
        editedText = selectedText
          .replace(/\bcan't\b/gi, 'cannot')
          .replace(/\bwon't\b/gi, 'will not')
          .replace(/\bdon't\b/gi, 'do not')
          .replace(/\bisn't\b/gi, 'is not')
          .replace(/\baren't\b/gi, 'are not')
          .replace(/\bI think\b/gi, 'It is evident that')
          .replace(/\bI believe\b/gi, 'Research indicates that');
        break;
      case 'add-data':
        // Add statistical backing
        editedText = selectedText + ' According to recent industry studies, this approach has shown measurable improvements in key performance metrics.';
        break;
      default:
        return;
    }
    
    // Call the callback with the edited text
    if (onTextReplace) {
      onTextReplace(selectedText, editedText, editType);
    }
    
    // Also dispatch custom event for broader compatibility
    window.dispatchEvent(new CustomEvent('blogwriter:replaceSelectedText', { 
      detail: { 
        originalText: selectedText,
        editedText: editedText,
        editType: editType
      } 
    }));
    
    // Close the selection menu
    setSelectionMenu(null);
  };

  // Smart typing assist functionality
  const generateSmartSuggestion = async (currentText: string) => {
    if (currentText.length < 20) return; // Only suggest after some meaningful content
    
    setIsGeneratingSuggestion(true);
    
    try {
      // Simulate AI generation with contextual suggestions
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const suggestions = [
        "This approach provides significant value to readers by offering actionable insights they can implement immediately.",
        "Research indicates that this strategy has proven effective across multiple industries and use cases.",
        "Furthermore, this method demonstrates measurable improvements in key performance indicators.",
        "Additionally, industry experts recommend this technique for sustainable long-term growth.",
        "Moreover, this framework addresses common challenges while providing practical solutions."
      ];
      
      const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
      
      // Get cursor position for suggestion placement
      if (contentRef.current) {
        const element = contentRef.current;
        const rect = element.getBoundingClientRect();
        const x = rect.left + 20;
        const y = rect.bottom + 5;
        
        setSmartSuggestion({
          text: randomSuggestion,
          position: { x, y }
        });
      }
    } catch (error) {
      console.error('Failed to generate smart suggestion:', error);
    } finally {
      setIsGeneratingSuggestion(false);
    }
  };

  const handleTypingChange = (newText: string) => {
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Clear any existing suggestion when user types
    setSmartSuggestion(null);
    
    // Set new timeout for suggestion generation
    typingTimeoutRef.current = setTimeout(() => {
      // First time suggestion appears automatically
      if (!hasShownFirstSuggestion && newText.length > 20) {
        generateSmartSuggestion(newText);
        setHasShownFirstSuggestion(true);
      } 
      // After first time, only suggest after longer pauses or more content
      else if (hasShownFirstSuggestion && newText.length > 50 && Math.random() > 0.7) {
        generateSmartSuggestion(newText);
      }
    }, 3000); // 3 second pause before suggesting
  };

  const handleAcceptSuggestion = () => {
    if (smartSuggestion && onTextReplace && contentRef.current) {
      const element = contentRef.current;
      const currentContent = (element as HTMLTextAreaElement).value || (element as HTMLDivElement).textContent || '';
      const newContent = currentContent + ' ' + smartSuggestion.text;
      
      // Use the text replacement callback
      onTextReplace(currentContent, newContent, 'smart-suggestion');
      
      setSmartSuggestion(null);
    }
  };

  const handleRejectSuggestion = () => {
    setSmartSuggestion(null);
  };

  // Cleanup progress and timeouts on unmount
  useEffect(() => {
    return () => {
      setFactCheckProgress(null);
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Text selection handler with debouncing
  const handleTextSelection = () => {
    console.log('🔍 [BlogTextSelectionHandler] handleTextSelection called');
    
    // Clear any existing timeout
    if (selectionTimeoutRef.current) {
      clearTimeout(selectionTimeoutRef.current);
    }
    
    // Debounce the selection handling
    selectionTimeoutRef.current = setTimeout(() => {
      try {
        const sel = window.getSelection();
        console.log('🔍 [BlogTextSelectionHandler] Selection object (debounced):', sel);
        
        if (!sel || sel.rangeCount === 0) { 
          console.log('🔍 [BlogTextSelectionHandler] No selection or range count is 0');
          setSelectionMenu(null); 
          return; 
        }
        
        const text = (sel.toString() || '').trim();
        console.log('🔍 [BlogTextSelectionHandler] Selected text (debounced):', text, 'Length:', text.length);
        
        if (!text || text.length < 10) { 
          console.log('🔍 [BlogTextSelectionHandler] Text too short or empty, hiding menu');
          setSelectionMenu(null); 
          return; 
        }
        
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        console.log('🔍 [BlogTextSelectionHandler] Range rect:', rect);
        
        // Use viewport coordinates for absolute positioning
        const x = Math.max(8, Math.min(rect.left + (rect.width / 2), window.innerWidth - 280)); // Account for menu width
        const y = Math.max(8, rect.top + window.scrollY);
        
        const menuPosition = { x, y, text };
        console.log('🔍 [BlogTextSelectionHandler] Setting selection menu at position (debounced):', menuPosition);
        setSelectionMenu(menuPosition);
        
      } catch (error) {
        console.error('🔍 [BlogTextSelectionHandler] Error handling text selection:', error);
        setSelectionMenu(null);
      }
    }, 150); // 150ms debounce
  };

  return {
    selectionMenu,
    setSelectionMenu,
    factCheckResults,
    isFactChecking,
    factCheckProgress,
    smartSuggestion,
    isGeneratingSuggestion,
    handleTextSelection,
    handleCheckFacts,
    handleCloseFactCheckResults,
    handleQuickEdit,
    handleTypingChange,
    handleAcceptSuggestion,
    handleRejectSuggestion,
    // Render the selection menu and fact-check components
    renderSelectionMenu: () => (
      <>
        {/* Text Selection Menu */}
        {selectionMenu && (
          <div
            onClick={(e) => {
              console.log('🔍 [BlogTextSelectionHandler] Selection menu clicked!', e.target);
              e.stopPropagation();
            }}
            style={{
              position: 'fixed',
              top: selectionMenu.y - 60,
              left: Math.max(8, selectionMenu.x - 140),
              background: 'rgba(79, 70, 229, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              padding: '12px 16px',
              boxShadow: '0 12px 28px rgba(0, 0, 0, 0.35)',
              backdropFilter: 'blur(12px)',
              zIndex: 10000,
              minWidth: '240px',
              maxWidth: '280px'
            }}
          >
            {/* Fact Check Button */}
            <button
              onClick={(e) => {
                console.log('🔍 [BlogTextSelectionHandler] Check Facts button clicked!', selectionMenu.text);
                e.preventDefault();
                e.stopPropagation();
                handleCheckFacts(selectionMenu.text);
              }}
              disabled={isFactChecking}
              style={{
                background: isFactChecking ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '8px',
                padding: '8px 16px',
                color: 'white',
                fontSize: '13px',
                fontWeight: '600',
                cursor: isFactChecking ? 'not-allowed' : 'pointer',
                opacity: isFactChecking ? 0.6 : 1,
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                width: '100%',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                if (!isFactChecking) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isFactChecking) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                }
              }}
            >
              {isFactChecking ? (
                <>
                  <div style={{
                    width: '14px',
                    height: '14px',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Fact-checking...
                </>
              ) : (
                <>
                  🔍 Fact Check
                </>
              )}
            </button>

            {/* Quick Edit Options */}
            <div style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.2)',
              paddingTop: '10px',
              marginTop: '6px'
            }}>
              <div style={{
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '11px',
                fontWeight: '600',
                marginBottom: '8px',
                textAlign: 'center',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                ✨ Assistive Writing
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '6px'
              }}>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleQuickEdit('improve', selectionMenu.text);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  }}
                >
                  ✏️ Improve
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleQuickEdit('add-transition', selectionMenu.text);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  }}
                >
                  🔗 Transition
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleQuickEdit('shorten', selectionMenu.text);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  }}
                >
                  ✂️ Shorten
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleQuickEdit('expand', selectionMenu.text);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  }}
                >
                  📝 Expand
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleQuickEdit('professionalize', selectionMenu.text);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  }}
                >
                  🎓 Professional
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleQuickEdit('add-data', selectionMenu.text);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  }}
                >
                  📊 Add Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Fact Check Progress */}
        {factCheckProgress && (
          <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: 'rgba(79, 70, 229, 0.95)',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
            backdropFilter: 'blur(10px)',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            minWidth: '280px'
          }}>
            <div style={{
              width: '20px',
              height: '20px',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderTop: '2px solid white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600' }}>
                Fact-checking content...
              </div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>
                {factCheckProgress.step}
              </div>
            </div>
          </div>
        )}

        {/* Fact Check Results */}
        {factCheckResults && (
          <FactCheckResults
            results={factCheckResults}
            onClose={handleCloseFactCheckResults}
          />
        )}

        {/* Smart Typing Suggestion */}
        {smartSuggestion && (
          <div
            style={{
              position: 'fixed',
              top: smartSuggestion.position.y,
              left: smartSuggestion.position.x,
              background: 'rgba(34, 197, 94, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '12px',
              padding: '16px 20px',
              boxShadow: '0 12px 28px rgba(0, 0, 0, 0.25)',
              backdropFilter: 'blur(12px)',
              zIndex: 10002,
              maxWidth: '400px',
              minWidth: '320px',
              color: 'white'
            }}
          >
            <div style={{
              fontSize: '12px',
              fontWeight: '600',
              marginBottom: '8px',
              opacity: 0.9,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              ✨ Smart Writing Suggestion
            </div>
            
            <div style={{
              fontSize: '14px',
              lineHeight: '1.4',
              marginBottom: '16px',
              fontStyle: 'italic'
            }}>
              "{smartSuggestion.text}"
            </div>
            
            <div style={{
              display: 'flex',
              gap: '8px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={handleRejectSuggestion}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                }}
              >
                ✕ Dismiss
              </button>
              <button
                onClick={handleAcceptSuggestion}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                }}
              >
                ✓ Accept
              </button>
            </div>
          </div>
        )}

        {/* Smart Suggestion Loading Indicator */}
        {isGeneratingSuggestion && (
          <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: 'rgba(34, 197, 94, 0.95)',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
            backdropFilter: 'blur(10px)',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            minWidth: '240px'
          }}>
            <div style={{
              width: '20px',
              height: '20px',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderTop: '2px solid white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600' }}>
                Generating suggestion...
              </div>
              <div style={{ fontSize: '11px', opacity: 0.8 }}>
                AI is crafting helpful content
              </div>
            </div>
          </div>
        )}

        {/* CSS for spinner animation */}
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </>
    )
  };
};

export default useBlogTextSelectionHandler;
export type { BlogTextSelectionHandlerProps };
