// Netlify serverless function for LIPI script generation
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
  return {
    amount: parseInt(amount),
    unit: unit,
    totalSeconds: unit === 'seconds' ? parseInt(amount) : parseInt(amount) * 60
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
        'YouTube Video': `What if I told you that everything you know about ${topic} is wrong?`,
        'TikTok/Reels': `POV: You just discovered the ${topic} hack that changes everything`,
        'Instagram Story': `Quick ${topic} tip that changed my life ✨`,
        'Advertisement': `Tired of struggling with ${topic}? There's finally a solution that actually works.`,
        'Educational Explainer': `Have you ever wondered why ${topic} works the way it does?`,
        'Business Presentation': `Today we're exploring how ${topic} can drive significant value for our organization.`
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
        'YouTube Video': `क्या होगा अगर मैं आपको बताऊं कि ${topic} के बारे में आप जो कुछ भी जानते हैं वो गलत है?`,
        'TikTok/Reels': `POV: आपने अभी ${topic} का वो hack खोजा है जो सब कुछ बदल देता है`,
        'Instagram Story': `${topic} की quick tip जिसने मेरी जिंदगी बदल दी ✨`
      },
      ctas: {
        'YouTube Video': `अगर इससे आपको ${topic} समझने में मदद मिली, तो like button दबाएं और ऐसी और जानकारी के लिए subscribe करें!`,
        'TikTok/Reels': `और ${topic} tips के लिए follow करें! अगला क्या cover करूं?`,
        'Instagram Story': `मेरी complete ${topic} guide के लिए "TIPS" DM करें!`
      }
    },
    'spanish': {
      hooks: {
        'YouTube Video': `¿Qué pasaría si te dijera que todo lo que sabes sobre ${topic} está mal?`,
        'TikTok/Reels': `POV: Acabas de descubrir el truco de ${topic} que lo cambia todo`,
        'Instagram Story': `Consejo rápido de ${topic} que cambió mi vida ✨`
      },
      ctas: {
        'YouTube Video': `Si esto te ayudó a entender mejor ${topic}, dale like y suscríbete para más contenido como este!`,
        'TikTok/Reels': `¡Sígueme para más consejos de ${topic}! ¿Qué debería cubrir después?`,
        'Instagram Story': `¡Envíame "TIPS" por DM para mi guía completa de ${topic}!`
      }
    }
  };
  
  return templates[language] || templates['english'];
}

function generateScript(scriptType, tone, topic, duration, language) {
  const languageTemplates = getLanguageTemplates(language, scriptType, tone, topic);
  const hooks = languageTemplates.hooks;
  const ctas = languageTemplates.ctas;

  const durationInfo = parseDuration(duration);
  const targetWords = calculateTargetWords(durationInfo, scriptType);
  
  let mainContent;
  
  if (language === 'hindi') {
    if (targetWords <= 50) {
      mainContent = `${topic} को सरल बनाया गया: एक चीज़ जो सब कुछ बदल देती है वो है मूल सिद्धांत को समझना। ज्यादातर लोग इसे पूरी तरह से miss कर देते हैं।`;
    } else if (targetWords <= 100) {
      mainContent = `मैं आपको ${topic} के बारे में जल्दी से बताता हूं। मुख्य insight: ज्यादातर लोग इसे गलत तरीके से approach करते हैं। वे tactics पर focus करते हैं, fundamentals पर नहीं।`;
    } else {
      mainContent = `मैं आपके लिए ${topic} को इस तरह से explain करूंगा जो ${tone.toLowerCase()} और actionable दोनों है।

मुख्य बात यह समझना है कि ज्यादातर लोग इसे बिल्कुल गलत तरीके से approach करते हैं। वे surface-level tactics पर focus करते हैं बजाय fundamental principles को समझने के।

यहाँ है जो आपको जानना चाहिए: ${topic} सिर्फ rules follow करने या दूसरों को copy करने के बारे में नहीं है। यह underlying psychology और mechanics को समझने के बारे में है जो इसे काम करवाता है।`;
    }
  } else if (language === 'spanish') {
    if (targetWords <= 50) {
      mainContent = `${topic} simplificado: Lo único que lo cambia todo es entender el principio fundamental. La mayoría de la gente se lo pierde completamente.`;
    } else if (targetWords <= 100) {
      mainContent = `Te explico ${topic} rápidamente. La clave: la mayoría lo enfoca mal. Se enfocan en tácticas, no en fundamentos.`;
    } else {
      mainContent = `Te voy a explicar ${topic} de una manera que sea ${tone.toLowerCase()} y práctica.

Lo clave es entender que la mayoría de la gente lo enfoca completamente mal. Se enfocan en tácticas superficiales en lugar de entender los principios fundamentales.

Esto es lo que necesitas saber: ${topic} no se trata solo de seguir reglas o copiar a otros. Se trata de entender la psicología y mecánica subyacente que lo hace funcionar.`;
    }
  } else {
    // English (default)
    if (targetWords <= 50) {
      mainContent = `${topic} simplified: The one thing that changes everything is understanding the core principle. Most people miss this completely.`;
    } else if (targetWords <= 100) {
      mainContent = `Let me break down ${topic} quickly. The key insight: most people approach this wrong. They focus on tactics, not fundamentals. Here's what actually works: understand the underlying principle first, then apply it consistently.`;
    } else {
      mainContent = `Let me break down ${topic} for you in a way that's both ${tone.toLowerCase()} and actionable. 

The key thing to understand is that most people approach it completely wrong. They focus on surface-level tactics instead of understanding the fundamental principles.

Here's what you need to know: ${topic} isn't just about following rules or copying others. It's about understanding the underlying psychology and mechanics that make it work.`;
    }
  }

  const script = {
    id: Date.now().toString(),
    type: scriptType,
    tone: tone,
    topic: topic,
    language: language,
    content: {
      hook: hooks[scriptType] || hooks['YouTube Video'],
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
