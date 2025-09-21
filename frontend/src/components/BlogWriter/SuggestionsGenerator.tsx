import React, { useMemo } from 'react';
import { BlogOutlineSection, BlogResearchResponse } from '../../services/blogWriterApi';

interface SuggestionsGeneratorProps {
  research: BlogResearchResponse | null;
  outline: BlogOutlineSection[];
  outlineConfirmed?: boolean;
  researchPolling?: { isPolling: boolean; currentStatus: string };
  outlinePolling?: { isPolling: boolean; currentStatus: string };
  mediumPolling?: { isPolling: boolean; currentStatus: string };
}

export const useSuggestions = (
  research: BlogResearchResponse | null, 
  outline: BlogOutlineSection[], 
  outlineConfirmed: boolean = false,
  researchPolling?: { isPolling: boolean; currentStatus: string },
  outlinePolling?: { isPolling: boolean; currentStatus: string },
  mediumPolling?: { isPolling: boolean; currentStatus: string }
) => {
  return useMemo(() => {
    const items = [] as { title: string; message: string; priority?: 'high' | 'normal' }[];
    
    // Check if any background tasks are currently running
    const isResearchRunning = researchPolling?.isPolling && researchPolling?.currentStatus !== 'completed';
    const isOutlineRunning = outlinePolling?.isPolling && outlinePolling?.currentStatus !== 'completed';
    const isMediumGenerationRunning = mediumPolling?.isPolling && mediumPolling?.currentStatus !== 'completed';
    
    // If research is running, show status instead of other suggestions
    if (isResearchRunning) {
      items.push({ 
        title: '⏳ Research in Progress...', 
        message: `Research is currently running (${researchPolling?.currentStatus}). Please wait for completion.`,
        priority: 'high'
      });
      return items;
    }
    
    // If outline generation is running, show status
    if (isOutlineRunning) {
      items.push({ 
        title: '⏳ Outline Generation in Progress...', 
        message: `Outline is being generated (${outlinePolling?.currentStatus}). Please wait for completion.`,
        priority: 'high'
      });
      return items;
    }
    
    // If medium generation is running, show status
    if (isMediumGenerationRunning) {
      items.push({ 
        title: '⏳ Content Generation in Progress...', 
        message: `Blog content is being generated (${mediumPolling?.currentStatus}). Please wait for completion.`,
        priority: 'high'
      });
      return items;
    }
    
    // Normal workflow suggestions based on current state
    if (!research) {
      items.push({ 
        title: '🔎 Start Research', 
        message: "I want to research a topic for my blog",
        priority: 'high'
      });
    } else if (research && outline.length === 0) {
      // Research completed, guide user to outline creation
      items.push({ 
        title: 'Next: Create Outline', 
        message: 'Let\'s proceed to create an outline based on the research results',
        priority: 'high'
      });
      items.push({ 
        title: '💬 Chat with Research Data', 
        message: 'I want to explore the research data and ask questions about the findings'
      });
      items.push({ 
        title: '🎨 Create Custom Outline', 
        message: 'I want to create an outline with my own specific instructions and requirements'
      });
    } else if (outline.length > 0 && !outlineConfirmed) {
      // Outline created but not confirmed - focus on outline review and confirmation
      items.push({ 
        title: 'Next: Confirm & Generate Content', 
        message: 'I\'m happy with the outline, let\'s generate content for all sections',
        priority: 'high'
      });
      items.push({ 
        title: '💬 Chat with Outline', 
        message: 'I want to discuss the outline and get insights about the content structure'
      });
      items.push({ 
        title: '🔧 Refine Outline', 
        message: 'I want to refine the outline structure based on my feedback'
      });
      items.push({ 
        title: '⚖️ Rebalance Word Counts', 
        message: 'Rebalance word count distribution across sections'
      });
    } else if (outline.length > 0 && outlineConfirmed) {
      // Outline confirmed, focus on content generation
      items.push({ title: '📝 Generate all sections', message: 'Generate all sections of my blog post' });
      outline.forEach(s => items.push({ title: `✍️ Generate ${s.heading}`, message: `Generate the section: ${s.heading}` }));
      items.push({ title: '📈 Run SEO analysis', message: 'Analyze SEO for my blog post' });
      items.push({ title: '🧾 Generate SEO metadata', message: 'Generate SEO metadata and title' });
      items.push({ title: '🧪 Hallucination check', message: 'Check for any false claims in my content' });
      items.push({ title: '🚀 Publish to WordPress', message: 'Publish my blog to WordPress' });
    }
    
    return items;
  }, [research, outline, outlineConfirmed, researchPolling, outlinePolling, mediumPolling]);
};

export const SuggestionsGenerator: React.FC<SuggestionsGeneratorProps> = ({ research, outline, outlineConfirmed = false }) => {
  useSuggestions(research, outline, outlineConfirmed);
  return null; // This is just a utility component
};

export default SuggestionsGenerator;
