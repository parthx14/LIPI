// Enhanced LIPI serverless function with comprehensive multilingual support
exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      }
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ success: false, error: 'Method not allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body);
    
    // Handle both old format (scriptType, tone, topic) and new format (prompt)
    let scriptType, tone, topic, duration, language;
    
    if (data.prompt) {
      // New simplified format - extract from prompt
      topic = data.prompt;
      scriptType = 'TikTok/Reels'; // Default for simple prompts
      tone = 'Conversational';
      duration = '60-seconds';
      language = 'english';
    } else {
      // Old detailed format
      ({ scriptType, tone, topic, duration, language } = data);
      
      if (!scriptType || !tone || !topic) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: false,
            error: 'Missing required fields: either provide "prompt" or "scriptType, tone, topic"'
          })
        };
      }
    }

    const script = generateScript(
      scriptType, 
      tone, 
      topic, 
      duration || '2-minutes', 
      language || 'english'
    );
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        script: script.content.hook + '\n\n' + script.content.mainContent + '\n\n' + script.content.callToAction,
        metadata: script.metadata,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Error generating script:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error: ' + error.message
      })
    };
  }
};

// Helper functions
function parseDuration(duration) {
  const [amount, unit] = duration.split('-');
  const numAmount = parseInt(amount);
  return {
    amount: numAmount,
    unit: unit,
    totalSeconds: unit === 'seconds' ? numAmount : numAmount * 60
  };
}

function calculateTargetWords(durationInfo, scriptType) {
  const wpmRates = {
    'YouTube Video': 150,
    'TikTok/Reels': 180,
    'Instagram Story': 180,
    'Advertisement': 160,
    'Educational Explainer': 140,
    'Business Presentation': 130
  };
  
  const wpm = wpmRates[scriptType] || 150;
  const minutes = durationInfo.totalSeconds / 60;
  return Math.round(wpm * minutes);
}

function getLanguageTemplates(language, scriptType, tone, topic) {
  const templates = {
    'english': {
      hooks: {
        'YouTube Video': {
          'Conversational': `Hey everyone! What if I told you that everything you know about ${topic} is completely wrong?`,
          'Professional': `Today I want to address a common misconception about ${topic} that's been holding people back.`,
          'Witty': `Plot twist: Everything you think you know about ${topic} is about as accurate as a weather forecast.`,
          'Inspirational': `Your journey with ${topic} is about to take an incredible turn. Here's why.`,
          'Storytelling': `Let me tell you about the day I discovered the truth about ${topic} that changed everything.`,
          'Persuasive': `What if I could prove to you that ${topic} isn't what you think it is?`
        }
      },
      ctas: {
        'YouTube Video': `If this helped you understand ${topic} better, hit that like button and subscribe for more insights like this!`,
        'TikTok/Reels': `Follow for more ${topic} tips! What should I cover next?`,
        'Instagram Story': `DM me "TIPS" for my complete ${topic} guide!`,
        'Advertisement': `Ready to master ${topic}? Click the link below to get started today!`,
        'Educational Explainer': `Now that you understand ${topic}, try applying these concepts and let me know how it goes!`,
        'Business Presentation': `Let's discuss how we can implement these ${topic} strategies in our next meeting.`
      }
    },
    'hindi': {
      hooks: {
        'YouTube Video': {
          'Conversational': `नमस्कार दोस्तों! क्या होगा अगर मैं आपको बताऊं कि ${topic} के बारे में आप जो कुछ भी जानते हैं वो गलत है?`,
          'Professional': `आज मैं ${topic} के बारे में एक महत्वपूर्ण गलतफहमी को दूर करना चाहता हूं।`,
          'Witty': `Plot twist: ${topic} के बारे में आपकी जानकारी उतनी ही सटीक है जितना मौसम का पूर्वानुमान।`,
          'Inspirational': `${topic} के साथ आपकी यात्रा एक अविश्वसनीय मोड़ लेने वाली है।`,
          'Storytelling': `मैं आपको उस दिन के बारे में बताता हूं जब मैंने ${topic} की सच्चाई खोजी।`,
          'Persuasive': `क्या होगा अगर मैं आपको साबित कर दूं कि ${topic} वो नहीं है जो आप सोचते हैं?`
        }
      },
      ctas: {
        'YouTube Video': `अगर इससे आपको ${topic} समझने में मदद मिली, तो like button दबाएं और ऐसी और जानकारी के लिए subscribe करें!`,
        'TikTok/Reels': `और ${topic} tips के लिए follow करें! अगला क्या cover करूं?`,
        'Instagram Story': `मेरी complete ${topic} guide के लिए "TIPS" DM करें!`
      }
    }
  };
  
  return templates[language] || templates['english'];
}

function generateMainContent(scriptType, tone, topic, targetWords, language) {
  // Comprehensive multilingual content templates
  const contentByLanguage = {
    'hindi': {
      short: `${topic} को सरल बनाया गया: यह एक चीज़ है जो सब कुछ बदल देती है। ज्यादातर लोग इस मूल सिद्धांत को पूरी तरह से miss कर देते हैं।`,
      medium: `मैं आपको ${topic} के बारे में समझाता हूं। सबसे बड़ी गलती यह है कि लोग जटिल रणनीतियों पर focus करते हैं बुनियादी बातों को master करने के बजाय। यहाँ है जो वास्तव में काम करता है।`,
      long: `मैं आपके लिए ${topic} को इस तरह से explain करूंगा जो ${tone.toLowerCase()} और practical दोनों है। ज्यादातर लोग इसे बिल्कुल गलत तरीके से approach करते हैं। वे fundamentals को समझे बिना advanced tactics में jump कर जाते हैं। सच्चाई यह है कि ${topic} जटिल formulas follow करने के बारे में नहीं है। यह core principles को समझने और उन्हें consistently apply करने के बारे में है।`
    },
    'spanish': {
      short: `${topic} simplificado: Esta es la única cosa que lo cambia todo. La mayoría de la gente se pierde este principio fundamental completamente.`,
      medium: `Te explico ${topic} de manera clara. El error más grande: la gente se enfoca en estrategias complicadas en lugar de dominar lo básico. Aquí está lo que realmente funciona.`,
      long: `Te voy a explicar ${topic} de una manera que sea ${tone.toLowerCase()} y práctica. La mayoría lo enfoca completamente al revés - saltan a tácticas avanzadas sin entender los fundamentos. La verdad es que ${topic} no se trata de seguir fórmulas complejas. Se trata de entender los principios básicos y aplicarlos consistentemente.`
    }
  };

  const langContent = contentByLanguage[language];
  
  if (langContent) {
    if (targetWords <= 50) return langContent.short;
    if (targetWords <= 100) return langContent.medium;
    return langContent.long;
  }

  // English fallback
  if (targetWords <= 50) {
    return `${topic} simplified: The key insight that changes everything. Most people miss this fundamental principle completely.`;
  } else if (targetWords <= 100) {
    return `Let me break down ${topic} quickly. The main insight: most people approach this wrong. They focus on tactics, not fundamentals.`;
  } else {
    return `Let me explain ${topic} in a way that's both ${tone.toLowerCase()} and actionable. The key is understanding that most people approach it completely wrong. They focus on surface-level tactics instead of fundamental principles.`;
  }
}

function generateScript(scriptType, tone, topic, duration, language) {
  const languageTemplates = getLanguageTemplates(language, scriptType, tone, topic);
  const hooks = languageTemplates.hooks;
  const ctas = languageTemplates.ctas;

  const durationInfo = parseDuration(duration);
  const targetWords = calculateTargetWords(durationInfo, scriptType);
  
  let mainContent = generateMainContent(scriptType, tone, topic, targetWords, language);

  const script = {
    id: Date.now().toString(),
    type: scriptType,
    tone: tone,
    topic: topic,
    language: language,
    content: {
      hook: (hooks[scriptType] && hooks[scriptType][tone]) ? hooks[scriptType][tone] : (hooks[scriptType] || hooks['YouTube Video']),
      mainContent: mainContent,
      callToAction: ctas[scriptType] || ctas['YouTube Video']
    },
    metadata: {
      wordCount: mainContent.split(' ').length + 20,
      estimatedDuration: `${Math.ceil(durationInfo.totalSeconds / 60)} minutes`,
      generatedAt: new Date().toISOString()
    }
  };

  return script;
}
