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
  const numAmount = parseInt(amount);
  return {
    amount: numAmount,
    unit: unit,
    totalSeconds: unit === 'seconds' ? numAmount : numAmount * 60
  };
}

function calculateTargetWords(durationInfo, scriptType) {
  // Realistic speaking rates for different content types
  const wpmRates = {
    'YouTube Video': 150,        // Standard conversational pace
    'TikTok/Reels': 180,        // Faster, energetic pace
    'Instagram Story': 200,      // Quick, punchy content
    'Advertisement': 160,        // Clear, persuasive pace
    'Educational Explainer': 130, // Slower for comprehension
    'Business Presentation': 120  // Professional, measured pace
  };
  
  const wpm = wpmRates[scriptType] || 150;
  const minutes = durationInfo.totalSeconds / 60;
  const targetWords = Math.round(wpm * minutes);
  
  // Ensure minimum and maximum bounds for quality
  const minWords = Math.max(20, Math.round(targetWords * 0.8));
  const maxWords = Math.round(targetWords * 1.2);
  
  return {
    target: targetWords,
    min: minWords,
    max: maxWords
  };
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
        },
        'TikTok/Reels': {
          'Conversational': `POV: You just discovered the ${topic} hack that changes everything`,
          'Professional': `The ${topic} strategy that industry experts don't want you to know`,
          'Witty': `Me explaining ${topic} to my past self who had no clue`,
          'Inspirational': `This ${topic} revelation will transform your perspective`,
          'Storytelling': `The ${topic} mistake I made so you don't have to`,
          'Persuasive': `Why everyone's doing ${topic} wrong (and how to fix it)`
        },
        'Instagram Story': {
          'Conversational': `Quick ${topic} tip that changed my life ✨`,
          'Professional': `Professional insight: ${topic} strategy that works`,
          'Witty': `${topic} hack that's almost too good to share 😏`,
          'Inspirational': `Your ${topic} breakthrough starts here 💫`,
          'Storytelling': `The ${topic} story you need to hear`,
          'Persuasive': `This ${topic} secret will blow your mind`
        },
        'Advertisement': {
          'Conversational': `Tired of struggling with ${topic}? I found something that actually works.`,
          'Professional': `Introducing the professional-grade solution for ${topic} challenges.`,
          'Witty': `${topic} problems? We've got the cure (and it's not snake oil).`,
          'Inspirational': `Transform your ${topic} journey with this breakthrough solution.`,
          'Storytelling': `Here's how thousands overcame their ${topic} struggles.`,
          'Persuasive': `The ${topic} solution that delivers guaranteed results.`
        },
        'Educational Explainer': {
          'Conversational': `Have you ever wondered why ${topic} works the way it does? Let's dive in!`,
          'Professional': `Today we'll examine the fundamental principles behind ${topic}.`,
          'Witty': `${topic} explained like you're five (but smarter).`,
          'Inspirational': `Understanding ${topic} will unlock new possibilities for you.`,
          'Storytelling': `The fascinating story of how ${topic} came to be.`,
          'Persuasive': `Why understanding ${topic} is crucial for your success.`
        },
        'Business Presentation': {
          'Conversational': `Let's talk about how ${topic} can drive real value for our team.`,
          'Professional': `Today we're exploring how ${topic} can drive significant value for our organization.`,
          'Witty': `${topic}: The secret weapon hiding in plain sight.`,
          'Inspirational': `${topic} represents our next big opportunity for growth.`,
          'Storytelling': `Here's how leading companies are leveraging ${topic} for success.`,
          'Persuasive': `The data shows ${topic} is essential for our competitive advantage.`
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
        },
        'TikTok/Reels': {
          'Conversational': `POV: आपने अभी ${topic} का वो hack खोजा है जो सब कुछ बदल देता है`,
          'Professional': `${topic} की वो strategy जो experts नहीं बताना चाहते`,
          'Witty': `मैं अपने past self को ${topic} explain कर रहा हूं जिसे कुछ पता नहीं था`,
          'Inspirational': `यह ${topic} revelation आपका perspective बदल देगा`,
          'Storytelling': `${topic} की वो गलती जो मैंने की ताकि आप न करें`,
          'Persuasive': `क्यों सभी ${topic} गलत कर रहे हैं (और कैसे ठीक करें)`
        },
        'Instagram Story': {
          'Conversational': `${topic} की quick tip जिसने मेरी जिंदगी बदल दी ✨`,
          'Professional': `Professional insight: ${topic} strategy जो काम करती है`,
          'Witty': `${topic} hack जो share करने के लिए बहुत अच्छा है 😏`,
          'Inspirational': `आपका ${topic} breakthrough यहां से शुरू होता है 💫`,
          'Storytelling': `${topic} की story जो आपको सुननी चाहिए`,
          'Persuasive': `यह ${topic} secret आपका दिमाग उड़ा देगा`
        },
        'Advertisement': {
          'Conversational': `${topic} की परेशानी से थक गए हैं? मैंने कुछ ऐसा पाया है जो वास्तव में काम करता है।`,
          'Professional': `${topic} की चुनौतियों के लिए professional-grade समाधान प्रस्तुत कर रहे हैं।`,
          'Witty': `${topic} की समस्याएं? हमारे पास इलाज है (और यह नकली दवा नहीं है)।`,
          'Inspirational': `अपनी ${topic} यात्रा को इस breakthrough समाधान के साथ transform करें।`,
          'Storytelling': `यहाँ है कि कैसे हजारों लोगों ने अपनी ${topic} की struggles को overcome किया।`,
          'Persuasive': `${topic} का समाधान जो guaranteed results देता है।`
        },
        'Educational Explainer': {
          'Conversational': `क्या आपने कभी सोचा है कि ${topic} इस तरह क्यों काम करता है? आइए जानते हैं!`,
          'Professional': `आज हम ${topic} के पीछे के fundamental principles को examine करेंगे।`,
          'Witty': `${topic} को इस तरह explain किया गया है जैसे आप पांच साल के हैं (लेकिन smarter)।`,
          'Inspirational': `${topic} को समझना आपके लिए नई possibilities unlock करेगा।`,
          'Storytelling': `${topic} की fascinating story कि यह कैसे बना।`,
          'Persuasive': `${topic} को समझना आपकी success के लिए क्यों crucial है।`
        },
        'Business Presentation': {
          'Conversational': `आइए बात करते हैं कि ${topic} हमारी team के लिए real value कैसे drive कर सकता है।`,
          'Professional': `आज हम explore कर रहे हैं कि ${topic} हमारे organization के लिए significant value कैसे drive कर सकता है।`,
          'Witty': `${topic}: वो secret weapon जो plain sight में छुपा हुआ है।`,
          'Inspirational': `${topic} हमारे growth के लिए अगला बड़ा opportunity represent करता है।`,
          'Storytelling': `यहाँ है कि leading companies ${topic} को success के लिए कैसे leverage कर रही हैं।`,
          'Persuasive': `Data दिखाता है कि ${topic} हमारे competitive advantage के लिए essential है।`
        }
      },
      ctas: {
        'YouTube Video': `अगर इससे आपको ${topic} समझने में मदद मिली, तो like button दबाएं और ऐसी और जानकारी के लिए subscribe करें!`,
        'TikTok/Reels': `और ${topic} tips के लिए follow करें! अगला क्या cover करूं?`,
        'Instagram Story': `मेरी complete ${topic} guide के लिए "TIPS" DM करें!`,
        'Advertisement': `${topic} में महारत हासिल करने के लिए तैयार हैं? आज ही शुरू करने के लिए नीचे दिए गए link पर click करें!`,
        'Educational Explainer': `अब जब आप ${topic} समझ गए हैं, इन concepts को apply करके देखें!`,
        'Business Presentation': `आइए discuss करते हैं कि हम इन ${topic} strategies को कैसे implement कर सकते हैं।`
      }
    },
    'spanish': {
      hooks: {
        'YouTube Video': {
          'Conversational': `¡Hola a todos! ¿Qué pasaría si te dijera que todo lo que sabes sobre ${topic} está completamente mal?`,
          'Professional': `Hoy quiero abordar un concepto erróneo común sobre ${topic} que está limitando a las personas.`,
          'Witty': `Plot twist: Todo lo que crees saber sobre ${topic} es tan preciso como un pronóstico del tiempo.`,
          'Inspirational': `Tu viaje con ${topic} está a punto de tomar un giro increíble. Aquí te explico por qué.`,
          'Storytelling': `Déjame contarte sobre el día que descubrí la verdad sobre ${topic} que cambió todo.`,
          'Persuasive': `¿Qué pasaría si pudiera probarte que ${topic} no es lo que piensas?`
        },
        'TikTok/Reels': {
          'Conversational': `POV: Acabas de descubrir el truco de ${topic} que lo cambia todo`,
          'Professional': `La estrategia de ${topic} que los expertos no quieren que sepas`,
          'Witty': `Yo explicándole ${topic} a mi yo del pasado que no tenía ni idea`,
          'Inspirational': `Esta revelación de ${topic} transformará tu perspectiva`,
          'Storytelling': `El error de ${topic} que cometí para que tú no tengas que hacerlo`,
          'Persuasive': `Por qué todos están haciendo ${topic} mal (y cómo arreglarlo)`
        },
        'Instagram Story': {
          'Conversational': `Consejo rápido de ${topic} que cambió mi vida ✨`,
          'Professional': `Insight profesional: estrategia de ${topic} que funciona`,
          'Witty': `Hack de ${topic} que es casi demasiado bueno para compartir 😏`,
          'Inspirational': `Tu breakthrough de ${topic} comienza aquí 💫`,
          'Storytelling': `La historia de ${topic} que necesitas escuchar`,
          'Persuasive': `Este secreto de ${topic} te volará la mente`
        }
      },
      ctas: {
        'YouTube Video': `Si esto te ayudó a entender mejor ${topic}, dale like y suscríbete para más contenido como este!`,
        'TikTok/Reels': `¡Sígueme para más consejos de ${topic}! ¿Qué debería cubrir después?`,
        'Instagram Story': `¡Envíame "TIPS" por DM para mi guía completa de ${topic}!`,
        'Advertisement': `¿Listo para dominar ${topic}? ¡Haz clic en el enlace de abajo para comenzar hoy!`,
        'Educational Explainer': `Ahora que entiendes ${topic}, ¡prueba aplicar estos conceptos y cuéntame cómo te va!`,
        'Business Presentation': `Discutamos cómo podemos implementar estas estrategias de ${topic} en nuestra próxima reunión.`
      }
    },
    'french': {
      hooks: {
        'YouTube Video': {
          'Conversational': `Salut tout le monde! Et si je vous disais que tout ce que vous savez sur ${topic} est complètement faux?`,
          'Professional': `Aujourd'hui, je veux aborder une idée fausse courante sur ${topic} qui limite les gens.`,
          'Witty': `Plot twist: Tout ce que vous pensez savoir sur ${topic} est aussi précis qu'une météo.`,
          'Inspirational': `Votre parcours avec ${topic} va prendre un tournant incroyable. Voici pourquoi.`,
          'Storytelling': `Laissez-moi vous raconter le jour où j'ai découvert la vérité sur ${topic}.`,
          'Persuasive': `Et si je pouvais vous prouver que ${topic} n'est pas ce que vous pensez?`
        }
      },
      ctas: {
        'YouTube Video': `Si cela vous a aidé à mieux comprendre ${topic}, likez et abonnez-vous pour plus de contenu!`,
        'TikTok/Reels': `Suivez-moi pour plus de conseils sur ${topic}! Que devrais-je couvrir ensuite?`,
        'Instagram Story': `Envoyez-moi "TIPS" en DM pour mon guide complet sur ${topic}!`
      }
    },
    'bengali': {
      hooks: {
        'YouTube Video': {
          'Conversational': `হ্যালো সবাই! ${topic} সম্পর্কে আপনি যা জানেন তা যদি সম্পূর্ণ ভুল হয় তাহলে কী হবে?`,
          'Professional': `আজ আমি ${topic} সম্পর্কে একটি সাধারণ ভুল ধারণা নিয়ে কথা বলতে চাই।`,
          'Witty': `Plot twist: ${topic} সম্পর্কে আপনার জ্ঞান আবহাওয়ার পূর্বাভাসের মতোই নির্ভুল।`,
          'Inspirational': `${topic} নিয়ে আপনার যাত্রা একটি অবিশ্বাস্য মোড় নিতে চলেছে।`,
          'Storytelling': `আমি আপনাদের সেই দিনের কথা বলি যেদিন আমি ${topic} এর সত্য আবিষ্কার করেছিলাম।`,
          'Persuasive': `যদি আমি প্রমাণ করতে পারি যে ${topic} আপনি যা ভাবেন তা নয়?`
        }
      },
      ctas: {
        'YouTube Video': `যদি এটি আপনাকে ${topic} আরও ভালভাবে বুঝতে সাহায্য করে, লাইক বাটন চাপুন এবং সাবস্ক্রাইব করুন!`,
        'TikTok/Reels': `আরও ${topic} টিপসের জন্য ফলো করুন! পরবর্তীতে কী কভার করব?`,
        'Instagram Story': `আমার সম্পূর্ণ ${topic} গাইডের জন্য "TIPS" DM করুন!`
      }
    },
    'tamil': {
      hooks: {
        'YouTube Video': {
          'Conversational': `வணக்கம் நண்பர்களே! ${topic} பற்றி நீங்கள் அறிந்தது எல்லாம் தவறு என்று சொன்னால் என்ன நினைப்பீர்கள்?`,
          'Professional': `இன்று நான் ${topic} பற்றிய ஒரு பொதுவான தவறான கருத்தை விளக்க விரும்புகிறேன்.`,
          'Witty': `Plot twist: ${topic} பற்றிய உங்கள் அறிவு வானிலை முன்னறிவிப்பு போல துல்லியமானது.`,
          'Inspirational': `${topic} உடனான உங்கள் பயணம் ஒரு அற்புதமான திருப்பத்தை எடுக்கப் போகிறது.`,
          'Storytelling': `${topic} பற்றிய உண்மையை நான் கண்டுபிடித்த நாளைப் பற்றி சொல்கிறேன்.`,
          'Persuasive': `${topic} நீங்கள் நினைப்பது அல்ல என்று நிரூபிக்க முடிந்தால் என்ன?`
        }
      },
      ctas: {
        'YouTube Video': `இது ${topic} ஐ நன்றாக புரிந்துகொள்ள உதவியிருந்தால், லைக் பட்டனை அழுத்தி சப்ஸ்கிரைப் செய்யுங்கள்!`,
        'TikTok/Reels': `மேலும் ${topic} டிப்ஸுக்கு என்னை பாலோ செய்யுங்கள்! அடுத்து எதை கவர் செய்யட்டும்?`,
        'Instagram Story': `எனது முழுமையான ${topic} வழிகாட்டிக்கு "TIPS" DM செய்யுங்கள்!`
      }
    },
    'urdu': {
      hooks: {
        'YouTube Video': {
          'Conversational': `السلام علیکم دوستو! اگر میں آپ کو بتاؤں کہ ${topic} کے بارے میں آپ جو کچھ جانتے ہیں وہ بالکل غلط ہے؟`,
          'Professional': `آج میں ${topic} کے بارے میں ایک عام غلط فہمی کو دور کرنا چاہتا ہوں۔`,
          'Witty': `Plot twist: ${topic} کے بارے میں آپ کا علم موسمی پیشن گوئی جتنا درست ہے۔`,
          'Inspirational': `${topic} کے ساتھ آپ کا سفر ایک ناقابل یقین موڑ لینے والا ہے۔`,
          'Storytelling': `میں آپ کو اس دن کے بارے میں بتاتا ہوں جب میں نے ${topic} کی حقیقت دریافت کی۔`,
          'Persuasive': `اگر میں آپ کو ثابت کر دوں کہ ${topic} وہ نہیں جو آپ سوچتے ہیں؟`
        }
      },
      ctas: {
        'YouTube Video': `اگر اس سے آپ کو ${topic} سمجھنے میں مدد ملی تو لائک بٹن دبائیں اور سبسکرائب کریں!`,
        'TikTok/Reels': `مزید ${topic} ٹپس کے لیے فالو کریں! اگلا کیا کور کروں؟`,
        'Instagram Story': `میری مکمل ${topic} گائیڈ کے لیے "TIPS" DM کریں!`
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
  const wordLimits = calculateTargetWords(durationInfo, scriptType);
  
  let mainContent = generateMainContent(scriptType, tone, topic, wordLimits, language);

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

function generateMainContent(scriptType, tone, topic, wordLimits, language) {
  // Get language-specific content - ensure 100% native language content with proper duration scaling
  return getCompletelyNativeContent(language, scriptType, tone, topic, wordLimits);
}

function getCompletelyNativeContent(language, scriptType, tone, topic, wordLimits) {
  // Generate content that scales properly with duration - short durations get concise content, long durations get detailed content
  return generateDurationScaledContent(language, scriptType, tone, topic, wordLimits);
}

function generateDurationScaledContent(language, scriptType, tone, topic, wordLimits) {
  const targetWords = wordLimits.target;
  
  // Generate content based on actual target word count for proper duration scaling
  const baseContent = getBaseContentForLanguage(language, scriptType, tone, topic);
  
  // Scale content based on target words with TONE-SPECIFIC emotional content
  if (targetWords <= 30) {
    // Very short content (15-30 seconds)
    return generateToneBasedContent(language, topic, tone, 'short', targetWords);
  } else if (targetWords <= 80) {
    // Short content (30 seconds - 1 minute)
    return generateToneBasedContent(language, topic, tone, 'medium', targetWords);
  } else if (targetWords <= 200) {
    // Medium content (1-3 minutes)
    return generateToneBasedContent(language, topic, tone, 'long', targetWords);
  } else {
    // Long detailed content (3+ minutes)
    return generateToneBasedContent(language, topic, tone, 'very_long', targetWords);
  }
}

function generateToneBasedContent(language, topic, tone, length, targetWords) {
  // Emotional and detailed content based on tone
  const toneTemplates = {
    'hindi': {
      'Conversational': {
        short: `दोस्तों, ${topic} के बारे में मैं आपको एक बात बताता हूं जो आपकी जिंदगी बदल देगी! 😊 यह इतना सरल है कि आप हैरान रह जाएंगे।`,
        medium: `अरे यार, ${topic} को लेकर जो confusion है ना, वो मैं आज साफ कर देता हूं! 🤗 सच कहूं तो, मैंने भी पहले यही गलती की थी। लेकिन जब मुझे असली बात पता चली, तो मैं सोचता रहा - काश मुझे यह पहले पता होता! आइए इसे step by step समझते हैं।`,
        long: `भाई, ${topic} की बात करें तो मेरा दिल भर आता है! 💝 क्यों? क्योंकि मैंने देखा है कि कैसे लोग इसमें struggle करते हैं, बिल्कुल वैसे ही जैसे मैं करता था। पहले मैं भी सोचता था कि यह बहुत complicated है, लेकिन सच्चाई यह है कि हम इसे जरूरत से ज्यादा मुश्किल बना देते हैं। आज मैं आपके साथ वो सारे secrets share करूंगा जो मैंने सालों की मेहनत से सीखे हैं।`,
        very_long: `दोस्तों, आज मैं आपके साथ ${topic} की पूरी कहानी share करने जा रहा हूं! 🌟 यह journey emotional भी है और educational भी। मैं आपको बताऊंगा कि कैसे मैंने इस field में अपनी शुरुआत की, कैसे मैंने गलतियां कीं, कैसे मैंने सीखा, और कैसे आप भी इन सभी चुनौतियों से पार पा सकते हैं। यकीन मानिए, अगर मैं कर सकता हूं तो आप भी कर सकते हैं! चलिए शुरू करते हैं इस amazing journey को।`
      },
      'Professional': {
        short: `${topic} के क्षेत्र में एक महत्वपूर्ण insight है जो industry leaders को अलग बनाती है। 💼 यह strategic approach आपके results को dramatically improve कर सकती है।`,
        medium: `${topic} पर आज हम एक comprehensive analysis करेंगे। 📊 Market research से पता चलता है कि 80% professionals इस critical factor को overlook करते हैं। हमारे data-driven approach से आप समझ जाएंगे कि successful organizations क्यों इस methodology को prioritize करते हैं। यह approach आपकी productivity को 3x तक बढ़ा सकती है।`,
        long: `${topic} के professional landscape में आज हम deep dive करेंगे। 🎯 Industry experts और thought leaders के साथ मेरी conversations से जो insights मिली हैं, वो आपके career trajectory को completely transform कर सकती हैं। हम discuss करेंगे कि कैसे Fortune 500 companies इन principles को implement करती हैं, कौन से metrics सबसे important हैं, और कैसे आप अपने organization में इन best practices को integrate कर सकते हैं।`,
        very_long: `${topic} की professional mastery के लिए आज हम एक comprehensive framework develop करेंगे। 🏆 मेरे 10+ years के industry experience और leading experts के साथ collaboration से जो methodology emerge हुई है, वो आपको step-by-step guide करेगी। हम cover करेंगे: strategic planning, implementation roadmap, performance metrics, risk mitigation, stakeholder management, और long-term sustainability। यह complete blueprint आपको industry leader बनने में help करेगा।`
      },
      'Witty': {
        short: `${topic} को समझना rocket science नहीं है, लेकिन लोग इसे brain surgery बना देते हैं! 😂 यहां है simple truth जो सबको पता होनी चाहिए।`,
        medium: `अरे ${topic} की बात करें तो यह IKEA furniture जैसा है - instructions clear हैं लेकिन हम सब अपने आप को genius समझकर manual skip कर देते हैं! 🤣 फिर रोते हैं कि screws बचे हुए हैं। मैं आपको बताता हूं कि कैसे इस comedy of errors से बचा जाए और actually results पाए जाएं।`,
        long: `${topic} के साथ हमारा relationship complicated है यार! 😅 यह वो ex की तरह है जिसे हम समझना चाहते हैं लेकिन हर बार confusion में पड़ जाते हैं। लेकिन good news यह है कि मैंने इस mystery को solve कर लिया है! आज मैं आपको बताऊंगा कि कैसे मैंने इस "it's complicated" status को "in a happy relationship" में convert किया। Trust me, यह journey hilarious भी है और enlightening भी!`,
        very_long: `${topic} की पूरी comedy show आज आपके सामने present कर रहा हूं! 🎭 यह वो topic है जिसके साथ हम सबका love-hate relationship है। पहले प्यार, फिर breakup, फिर patch-up - यह cycle चलती रहती है। लेकिन आज मैं आपको बताऊंगा कि कैसे इस dramatic relationship को stable बनाया जाए। हम discuss करेंगे सारी funny mistakes, embarrassing moments, और उन aha moments को जो finally सब कुछ clear कर देते हैं। Get ready for entertainment with education!`
      }
    }
  };

  // Get tone-specific content from templates
  const langTemplates = toneTemplates[language];
  if (langTemplates && langTemplates[tone] && langTemplates[tone][length]) {
    return langTemplates[tone][length];
  }

  // Fallback to English with emotional content
  const englishTones = {
    'Conversational': {
      short: `Hey! Let me tell you something about ${topic} that's going to blow your mind! 🤯 This is so simple yet powerful.`,
      medium: `Okay, so here's the thing about ${topic} that nobody talks about! 😊 I used to struggle with this too, and honestly, I wish someone had told me this earlier. It would have saved me so much time and frustration! Let me break it down for you step by step.`,
      long: `Listen, I'm genuinely excited to share this with you because ${topic} has been such a game-changer in my life! 🌟 I remember when I first started, I was completely overwhelmed. I thought it was this incredibly complex thing that only experts could master. But here's what I discovered - we make it way more complicated than it needs to be! Today, I'm going to share all the secrets I've learned through years of trial and error.`,
      very_long: `Friends, today I'm sharing the complete story of my journey with ${topic}! 🚀 This is both emotional and educational because I want you to understand not just the 'what' but the 'why' behind everything. I'll tell you about my failures, my breakthroughs, the moments I wanted to quit, and the discoveries that changed everything. If I can master this, so can you! Let's dive into this incredible journey together.`
    },
    'Professional': {
      short: `${topic} presents a critical strategic advantage that industry leaders leverage. 💼 This data-driven approach delivers measurable results.`,
      medium: `Our comprehensive analysis of ${topic} reveals significant market opportunities. 📈 Research indicates that 85% of organizations underutilize this strategic framework. Our methodology demonstrates how top-performing companies achieve 3x better outcomes through systematic implementation of these principles.`,
      long: `Today we're conducting an in-depth analysis of ${topic} and its impact on organizational performance. 🎯 Through extensive research and collaboration with industry thought leaders, we've identified key performance indicators that separate market leaders from competitors. We'll examine implementation strategies, ROI metrics, and scalable frameworks that Fortune 500 companies use to maintain competitive advantage.`,
      very_long: `We're developing a comprehensive strategic framework for ${topic} mastery based on 15+ years of industry research and executive consultation. 🏆 This methodology encompasses strategic planning, implementation roadmaps, performance optimization, risk management, stakeholder alignment, and sustainable growth models. Our evidence-based approach provides actionable insights for organizational transformation and market leadership.`
    },
    'Witty': {
      short: `${topic} isn't rocket science, but somehow we all treat it like brain surgery! 😂 Here's the hilariously simple truth everyone misses.`,
      medium: `So ${topic} is basically like assembling IKEA furniture - the instructions are right there, but we all think we're too smart to read them! 🤣 Then we wonder why we have leftover screws and a wobbly table. Let me save you from this comedy of errors and show you how to actually get results without the drama.`,
      long: `Our relationship with ${topic} is... complicated! 😅 It's like that ex we keep trying to understand but always end up more confused. But plot twist - I've finally cracked the code! Today I'm going to tell you how I went from "it's complicated" to "happily ever after" with ${topic}. Trust me, this journey is both hilarious and enlightening!`,
      very_long: `Welcome to the ${topic} comedy show! 🎭 This is the topic we all have a love-hate relationship with. First we love it, then we hate it, then we try to make it work again - it's like a dramatic soap opera! But today, I'm going to show you how to turn this chaotic relationship into something stable and productive. Get ready for laughs, lessons, and those beautiful "aha!" moments that make it all worth it.`
    },
    'Inspirational': {
      short: `${topic} is your gateway to transformation! ✨ This single insight has the power to completely change your trajectory.`,
      medium: `Your journey with ${topic} starts today, and I'm here to tell you - you're capable of incredible things! 🌟 I've seen ordinary people achieve extraordinary results when they embrace these principles. The path isn't always easy, but every challenge is an opportunity to grow stronger. Let me show you how to turn your dreams into reality.`,
      long: `Today marks the beginning of your transformation through ${topic}! 🚀 I believe in your potential because I've witnessed the incredible power of human determination. Every expert was once a beginner, every success story started with a single step. You have everything within you to succeed - the courage, the intelligence, the persistence. Let me guide you through this empowering journey of growth and achievement.`,
      very_long: `This is your moment of transformation with ${topic}! 🌈 I'm sharing this with deep conviction because I've seen lives changed, dreams realized, and impossible goals achieved. Your story of success starts here, today. We'll explore not just the techniques, but the mindset, the resilience, and the unwavering belief that will carry you through challenges. Remember - every setback is a setup for a comeback. You're destined for greatness!`
    },
    'Storytelling': {
      short: `Let me tell you a story about ${topic} that changed everything... 📖 It was a moment that shifted my entire perspective.`,
      medium: `Picture this: It's 2 AM, I'm staring at my computer screen, completely frustrated with ${topic}. 😤 Nothing was working. Then something happened that changed everything. A simple realization that turned my biggest struggle into my greatest strength. This is that story, and by the end, you'll understand why this moment was so transformative.`,
      long: `I want to take you back to a pivotal moment in my ${topic} journey. 🎬 It was one of those days when everything seemed to go wrong. I had tried every strategy, followed every expert's advice, but nothing clicked. I was ready to give up. Then, in the most unexpected way, I discovered something that not only solved my problem but revolutionized my entire approach. This is the story of that breakthrough and how it can transform your journey too.`,
      very_long: `Gather around, because I'm about to share the complete story of my ${topic} transformation - the struggles, the failures, the breakthrough moments, and the ultimate triumph. 📚 This isn't just a how-to guide; it's a journey of human resilience, creativity, and the power of never giving up. You'll laugh, you might even cry, but most importantly, you'll discover that your own success story is just beginning. Every hero's journey has challenges - this is how we overcome them.`
    },
    'Persuasive': {
      short: `Here's why ${topic} is absolutely critical for your success right now! ⚡ The data is undeniable, and the opportunity is massive.`,
      medium: `I'm going to prove to you why ${topic} isn't just important - it's essential for your future success! 🔥 The statistics are staggering: people who master this see 5x better results than those who don't. But here's the kicker - 90% of people are doing it completely wrong. I'm going to show you the right way, backed by research and real results.`,
      long: `Let me present the compelling case for why ${topic} should be your #1 priority right now! 💪 The evidence is overwhelming - every successful person in this field has mastered these principles. But here's what's shocking: the majority of people are missing the most crucial elements. I'm going to reveal the hidden factors that separate winners from everyone else, and show you exactly how to join the winning side.`,
      very_long: `I'm about to make the most compelling argument you'll ever hear for mastering ${topic}! 🎯 The research is clear, the results are proven, and the opportunity is unprecedented. We're living in a unique moment where those who understand these principles will thrive, while others get left behind. I'll present irrefutable evidence, share success stories, reveal industry secrets, and give you a complete action plan. By the end, you'll not only be convinced - you'll be unstoppable!`
    }
  };

  return englishTones[tone]?.[length] || `${topic} is an important topic that deserves your attention. Let's explore it together.`;
}

// Main content generation function with proper duration scaling
function generateMainContent(scriptType, tone, topic, wordLimits, language) {
  const targetWords = wordLimits.target;
  
  // Generate content based on actual target word count for proper duration scaling
  const baseContent = getBaseContentForLanguage(language, scriptType, tone, topic);
  
  // Scale content based on target words - this ensures duration accuracy
  if (targetWords <= 30) {
    // Very short content (15-30 seconds)
    return generateShortContent(baseContent, topic, language, targetWords);
  } else if (targetWords <= 80) {
    // Short content (30 seconds - 1 minute)
    return generateMediumContent(baseContent, topic, language, targetWords);
  } else if (targetWords <= 200) {
    // Medium content (1-3 minutes)
    return generateLongContent(baseContent, topic, language, targetWords);
  } else {
    // Long detailed content (3+ minutes)
    return generateVeryLongContent(baseContent, topic, language, targetWords);
  }
}

// Duration-based content generation functions
function getBaseContentForLanguage(language, scriptType, tone, topic) {
  const baseTemplates = {
    'hindi': `${topic} के बारे में`,
    'spanish': `Sobre ${topic}`,
    'chinese': `关于${topic}`,
    'arabic': `حول ${topic}`,
    'urdu': `${topic} کے بارے میں`,
    'marathi': `${topic} बद्दल`
  };
  return baseTemplates[language] || `About ${topic}`;
}

function generateShortContent(base, topic, language, targetWords) {
  // Get tone from context - this will be passed properly
  return generateToneBasedContent(language, topic, 'short', targetWords);
}

function generateMediumContent(base, topic, language, targetWords) {
  const templates = {
    'hindi': `${topic} के बारे में मुख्य बात यह है कि अधिकांश लोग इसे गलत समझते हैं। सबसे बड़ी गलती यह है कि वे जटिल तरीकों पर ध्यान देते हैं।`,
    'spanish': `La clave sobre ${topic} es que la mayoría lo entiende mal. El error más grande es enfocarse en métodos complicados.`,
    'chinese': `关于${topic}的关键是大多数人理解错了。最大的错误是专注于复杂的方法。`,
    'arabic': `المفتاح حول ${topic} هو أن معظم الناس يفهمونه خطأ. الخطأ الأكبر هو التركيز على الطرق المعقدة.`,
    'urdu': `${topic} کے بارے میں اصل بات یہ ہے کہ زیادہ تر لوگ اسے غلط سمجھتے ہیں۔ سب سے بڑی غلطی یہ ہے کہ وہ پیچیدہ طریقوں پر توجہ دیتے ہیں۔`,
    'marathi': `${topic} बद्दल मुख्य गोष्ट ही आहे की बहुतेक लोक याला चुकीचे समजतात। सर्वात मोठी चूक म्हणजे जटिल पद्धतींवर लक्ष केंद्रित करणे।`
  };
  return templates[language] || `The key about ${topic} is that most people misunderstand it. The biggest mistake is focusing on complicated methods.`;
}

function generateLongContent(base, topic, language, targetWords) {
  const templates = {
    'hindi': `${topic} के बारे में विस्तार से बात करते हैं। अधिकांश लोग इसे गलत तरीके से समझते हैं क्योंकि वे बुनियादी सिद्धांतों को नजरअंदाज करते हैं। मुख्य समस्या यह है कि लोग जटिल रणनीतियों की तलाश करते हैं जबकि सफलता सरल और निरंतर अभ्यास में है। यहाँ तीन मुख्य बिंदु हैं जो आपको समझने चाहिए।`,
    'spanish': `Hablemos en detalle sobre ${topic}. La mayoría de las personas lo entienden mal porque ignoran los principios básicos. El problema principal es que buscan estrategias complicadas cuando el éxito está en la práctica simple y constante. Aquí hay tres puntos clave que debes entender.`,
    'chinese': `让我们详细谈论${topic}。大多数人理解错误是因为他们忽略了基本原则。主要问题是人们寻找复杂的策略，而成功在于简单和持续的实践。这里有三个关键点你需要理解。`,
    'arabic': `دعنا نتحدث بالتفصيل عن ${topic}. معظم الناس يفهمونه خطأ لأنهم يتجاهلون المبادئ الأساسية. المشكلة الرئيسية أن الناس يبحثون عن استراتيجيات معقدة بينما النجاح في الممارسة البسيطة والمستمرة. إليك ثلاث نقاط رئيسية تحتاج لفهمها.`,
    'urdu': `آئیے ${topic} کے بارے میں تفصیل سے بات کرتے ہیں۔ زیادہ تر لوگ اسے غلط سمجھتے ہیں کیونکہ وہ بنیادی اصولوں کو نظرانداز کرتے ہیں۔ اصل مسئلہ یہ ہے کہ لوگ پیچیدہ حکمت عملیوں کی تلاش کرتے ہیں جبکہ کامیابی سادہ اور مسلسل مشق میں ہے۔ یہاں تین اہم نکات ہیں جو آپ کو سمجھنے چاہیئے۔`,
    'marathi': `चला ${topic} बद्दल तपशीलवार बोलूया. बहुतेक लोक याला चुकीचे समजतात कारण ते मूलभूत तत्त्वांकडे दुर्लक्ष करतात. मुख्य समस्या ही आहे की लोक जटिल रणनीतींचा शोध घेतात जेव्हा यश सोप्या आणि सतत सरावात आहे. येथे तीन मुख्य मुद्दे आहेत जे तुम्हाला समजले पाहिजेत.`
  };
  return templates[language] || `Let's talk in detail about ${topic}. Most people misunderstand it because they ignore basic principles. The main problem is people look for complicated strategies when success is in simple and consistent practice. Here are three key points you need to understand.`;
}

function generateVeryLongContent(base, topic, language, targetWords) {
  const templates = {
    'hindi': `${topic} पर एक व्यापक चर्चा करते हैं। यह विषय बहुत महत्वपूर्ण है क्योंकि अधिकांश लोग इसे गलत समझते हैं। पहली बात, बुनियादी सिद्धांत सबसे महत्वपूर्ण हैं। दूसरी बात, निरंतरता सफलता की कुंजी है। तीसरी बात, धैर्य और अभ्यास आवश्यक हैं। चौथी बात, गलतियों से सीखना जरूरी है। पांचवी बात, सही मार्गदर्शन लेना महत्वपूर्ण है। इन सभी बिंदुओं को समझकर आप ${topic} में महारत हासिल कर सकते हैं।`,
    'spanish': `Tengamos una discusión completa sobre ${topic}. Este tema es muy importante porque la mayoría de las personas lo malentienden. Primero, los principios básicos son los más importantes. Segundo, la consistencia es clave para el éxito. Tercero, la paciencia y la práctica son esenciales. Cuarto, aprender de los errores es necesario. Quinto, obtener la orientación correcta es importante. Entendiendo todos estos puntos, puedes dominar ${topic}.`
  };
  return templates[language] || `Let's have a comprehensive discussion about ${topic}. This topic is very important because most people misunderstand it. First, basic principles are most important. Second, consistency is key to success. Third, patience and practice are essential. Fourth, learning from mistakes is necessary. Fifth, getting proper guidance is important. Understanding all these points, you can master ${topic}.`;
}
