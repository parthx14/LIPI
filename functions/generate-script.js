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

  const hookContent = (hooks[scriptType] && hooks[scriptType][tone]) ? hooks[scriptType][tone] : (hooks[scriptType] || hooks['YouTube Video']);
  const ctaContent = ctas[scriptType] || ctas['YouTube Video'];
  
  const hookWords = hookContent.split(' ').length;
  const mainWords = mainContent.split(' ').length;
  const ctaWords = ctaContent.split(' ').length;
  const totalWords = hookWords + mainWords + ctaWords;

  const script = {
    id: Date.now().toString(),
    type: scriptType,
    tone: tone,
    topic: topic,
    language: language,
    duration: duration,
    content: {
      hook: hookContent,
      mainContent: mainContent,
      callToAction: ctaContent
    },
    metadata: {
      wordCount: totalWords,
      targetWords: wordLimits.target,
      hookWords: hookWords,
      mainWords: mainWords,
      ctaWords: ctaWords,
      estimatedDuration: `${Math.ceil(durationInfo.totalSeconds / 60)} minutes`,
      actualDurationSeconds: durationInfo.totalSeconds,
      generatedAt: new Date().toISOString()
    }
  };

  return script;
}

function generateMainContent(scriptType, tone, topic, wordLimits, language) {
  const targetWords = wordLimits.target;
  
  // Determine content length based on target words (accounting for hook and CTA)
  // Reserve approximately 20-30 words for hook and CTA combined
  const mainContentTarget = Math.max(10, targetWords - 25);
  
  let contentLength;
  if (mainContentTarget <= 20) {
    contentLength = 'short';
  } else if (mainContentTarget <= 60) {
    contentLength = 'medium';
  } else if (mainContentTarget <= 150) {
    contentLength = 'long';
  } else {
    contentLength = 'very_long';
  }
  
  // Generate content in the selected language with proper tone and length
  let content = generateContentByLanguageAndTone(language, topic, tone, contentLength, mainContentTarget);
  
  // If content is significantly shorter than target, expand it
  const currentWords = content.split(' ').length;
  if (currentWords < mainContentTarget * 0.7) {
    content = expandContent(content, topic, tone, language, mainContentTarget);
  }
  
  return content;
}

function generateContentByLanguageAndTone(language, topic, tone, length, targetWords) {
  // Comprehensive multilingual content templates with all tones
  const contentTemplates = {
    'hindi': {
      'Conversational': {
        short: `दोस्तों, ${topic} के बारे में एक बात बताता हूं! 😊 यह सरल trick आपकी जिंदगी बदल देगी।`,
        medium: `अरे यार, ${topic} को लेकर confusion है? मैं आज साफ कर देता हूं! 🤗 सच कहूं तो, मैंने भी पहले यही गलती की थी। लेकिन जब असली बात पता चली, तो सब clear हो गया। आइए step by step समझते हैं।`,
        long: `भाई, ${topic} की बात करें तो मेरा दिल भर आता है! 💝 मैंने देखा है कि कैसे लोग इसमें struggle करते हैं। पहले मैं भी सोचता था कि यह complicated है, लेकिन सच्चाई यह है कि हम इसे जरूरत से ज्यादा मुश्किल बना देते हैं। आज मैं वो सारे secrets share करूंगा जो मैंने सालों की मेहनत से सीखे हैं। पहली बात - foundation strong होना चाहिए। दूसरी बात - consistency सबसे important है।`,
        very_long: `दोस्तों, आज मैं ${topic} की complete journey share करूंगा! 🌟 यह emotional भी है और educational भी। मैं बताऊंगा कि कैसे मैंने शुरुआत की, कैसे गलतियां कीं, कैसे सीखा, और कैसे आप भी सफल हो सकते हैं। यकीन मानिए, अगर मैं कर सकता हूं तो आप भी कर सकते हैं! पहले मैं बिल्कुल beginner था, कुछ नहीं जानता था। फिर धीरे-धीरे practice करके, mistakes से सीखकर, experts से guidance लेकर मैंने इसमें mastery हासिल की। आज मैं आपको वो सारी techniques बताऊंगा जो really काम करती हैं।`
      },
      'Professional': {
        short: `${topic} के क्षेत्र में एक महत्वपूर्ण insight है। 💼 यह strategic approach आपके results को dramatically improve करेगी।`,
        medium: `${topic} पर comprehensive analysis करते हैं। 📊 Research से पता चलता है कि 80% professionals इस critical factor को overlook करते हैं। हमारे data-driven approach से आप समझेंगे कि successful organizations क्यों इस methodology को prioritize करते हैं।`,
        long: `${topic} के professional landscape में deep dive करते हैं। 🎯 Industry experts के साथ conversations से जो insights मिली हैं, वो आपके career को transform कर सकती हैं। हम discuss करेंगे कि Fortune 500 companies कैसे इन principles को implement करती हैं, कौन से metrics important हैं, और कैसे आप अपने organization में best practices integrate कर सकते हैं।`,
        very_long: `${topic} की professional mastery के लिए comprehensive framework develop करते हैं। 🏆 मेरे 10+ years के experience और experts के collaboration से जो methodology emerge हुई है, वो step-by-step guide करेगी। हम cover करेंगे: strategic planning, implementation roadmap, performance metrics, risk mitigation, stakeholder management, और long-term sustainability। यह complete blueprint आपको industry leader बनाएगा। पहले हम foundation set करेंगे, फिर advanced strategies implement करेंगे।`
      },
      'Witty': {
        short: `${topic} rocket science नहीं है, लेकिन हम सब इसे brain surgery की तरह treat करते हैं! 😂 यहाँ है वो hilariously simple सच्चाई।`,
        medium: `तो ${topic} basically IKEA furniture assemble करने जैसा है - instructions सामने हैं, लेकिन हम सब think करते हैं कि हम बहुत smart हैं पढ़ने के लिए! 🤣 फिर wonder करते हैं कि leftover screws क्यों हैं।`,
        long: `${topic} के साथ हमारा relationship... complicated है! 😅 यह उस ex की तरह है जिसे हम समझने की कोशिश करते रहते हैं। लेकिन plot twist - मैंने finally code crack कर लिया है!`,
        very_long: `Welcome to the ${topic} comedy show! 🎭 यह वो topic है जिसके साथ हम सबका love-hate relationship है। पहले love करते हैं, फिर hate करते हैं, फिर वापस काम करने की कोशिश करते हैं - यह dramatic soap opera जैसा है!`
      },
      'Inspirational': {
        short: `${topic} आपके transformation का gateway है! ✨ यह single insight आपकी पूरी trajectory बदल सकती है।`,
        medium: `${topic} के साथ आपकी journey आज शुरू होती है, और मैं यहाँ हूँ आपको बताने - आप incredible चीजों के capable हैं! 🌟 मैंने ordinary लोगों को extraordinary results achieve करते देखा है।`,
        long: `आज आपकी ${topic} के through transformation की शुरुआत है! 🚀 मैं आपकी potential में believe करता हूँ क्योंकि मैंने human determination की incredible power witness की है। हर expert कभी beginner था।`,
        very_long: `यह आपका ${topic} के साथ transformation का moment है! 🌈 मैं यह deep conviction के साथ share कर रहा हूँ क्योंकि मैंने lives change होते देखे हैं, dreams realize होते देखे हैं। आपकी success story यहाँ से शुरू होती है।`
      },
      'Storytelling': {
        short: `मैं आपको ${topic} की एक story बताता हूँ जिसने सब कुछ बदल दिया... 📖 यह एक ऐसा moment था जिसने मेरा पूरा perspective shift कर दिया।`,
        medium: `Picture this: रात के 2 बजे हैं, मैं computer screen पर stare कर रहा हूँ, ${topic} से completely frustrated। 😤 कुछ भी काम नहीं कर रहा था। फिर कुछ ऐसा हुआ जिसने सब कुछ बदल दिया।`,
        long: `मैं आपको अपनी ${topic} journey के एक pivotal moment पर ले जाना चाहता हूँ। 🎬 यह उन दिनों में से एक था जब सब कुछ गलत लग रहा था। मैंने हर strategy try की थी, हर expert की advice follow की थी।`,
        very_long: `Gather around, क्योंकि मैं अपनी ${topic} transformation की complete story share करने वाला हूँ - struggles, failures, breakthrough moments, और ultimate triumph। 📚 यह सिर्फ how-to guide नहीं है; यह human resilience की journey है।`
      },
      'Persuasive': {
        short: `यहाँ है कि ${topic} आपकी success के लिए absolutely critical क्यों है right now! ⚡ Data undeniable है, और opportunity massive है।`,
        medium: `मैं आपको prove करूँगा कि ${topic} सिर्फ important नहीं - यह आपकी future success के लिए essential है! 🔥 Statistics staggering हैं: जो लोग इसे master करते हैं वे 5x better results देखते हैं।`,
        long: `मैं आपके सामने compelling case present करता हूँ कि ${topic} आपकी #1 priority क्यों होनी चाहिए right now! 💪 Evidence overwhelming है - इस field में हर successful person ने ये principles master किए हैं।`,
        very_long: `मैं आपको ${topic} master करने के लिए सबसे compelling argument देने वाला हूँ! 🎯 Research clear है, results proven हैं, और opportunity unprecedented है। हम एक unique moment में जी रहे हैं।`
      }
    },
    'spanish': {
      'Conversational': {
        short: `¡Amigos! Les voy a contar algo sobre ${topic} que les va a cambiar la vida! 😊 Es tan simple que se van a sorprender.`,
        medium: `Oye, ¿están confundidos con ${topic}? ¡Hoy lo voy a aclarar todo! 🤗 La verdad es que yo también cometí este error antes. Pero cuando descubrí la verdad, todo se volvió claro. Vamos a entenderlo paso a paso.`,
        long: `Hermanos, cuando hablo de ${topic} se me llena el corazón! 💝 He visto cómo la gente lucha con esto, igual que yo luchaba antes. Al principio pensaba que era súper complicado, pero la verdad es que lo hacemos más difícil de lo necesario. Hoy voy a compartir todos los secretos que aprendí después de años de trabajo duro. Primero - la base tiene que ser sólida. Segundo - la consistencia es lo más importante.`,
        very_long: `¡Amigos, hoy voy a compartir el journey completo de ${topic}! 🌟 Es emocional y educativo a la vez. Les voy a contar cómo empecé, cómo cometí errores, cómo aprendí, y cómo ustedes también pueden tener éxito. Créanme, si yo pude, ustedes también pueden! Al principio era un completo principiante, no sabía nada. Pero poco a poco, practicando, aprendiendo de los errores, buscando guidance de expertos, logré dominar esto. Hoy les voy a enseñar todas las técnicas que realmente funcionan.`
      },
      'Professional': {
        short: `${topic} presenta una ventaja estratégica crítica que los líderes de la industria aprovechan. 💼 Este enfoque basado en datos ofrece resultados medibles.`,
        medium: `Nuestro análisis integral de ${topic} revela oportunidades significativas en el mercado. 📈 La investigación indica que el 85% de las organizaciones subutilizan este marco estratégico.`,
        long: `Hoy realizamos un análisis profundo de ${topic} y su impacto en el rendimiento organizacional. 🎯 A través de investigación extensiva y colaboración con líderes de pensamiento de la industria, hemos identificado indicadores clave.`,
        very_long: `Estamos desarrollando un marco estratégico integral para el dominio de ${topic} basado en 15+ años de investigación de la industria y consultoría ejecutiva. 🏆 Esta metodología abarca planificación estratégica, hojas de ruta de implementación y modelos de crecimiento sostenible.`
      },
      'Witty': {
        short: `${topic} no es ciencia espacial, ¡pero todos lo tratamos como cirugía cerebral! 😂 Aquí está la verdad hilarantemente simple que todos pasan por alto.`,
        medium: `Entonces ${topic} es básicamente como armar muebles de IKEA - ¡las instrucciones están ahí, pero todos pensamos que somos demasiado inteligentes para leerlas! 🤣`,
        long: `¡Nuestra relación con ${topic} es... complicada! 😅 Es como ese ex que seguimos tratando de entender pero siempre terminamos más confundidos.`,
        very_long: `¡Bienvenidos al show de comedia de ${topic}! 🎭 Este es el tema con el que todos tenemos una relación de amor-odio. Primero lo amamos, luego lo odiamos, luego tratamos de hacer que funcione de nuevo.`
      },
      'Inspirational': {
        short: `¡${topic} es tu puerta de entrada a la transformación! ✨ Esta única perspectiva tiene el poder de cambiar completamente tu trayectoria.`,
        medium: `Tu viaje con ${topic} comienza hoy, y estoy aquí para decirte: ¡eres capaz de cosas increíbles! 🌟 He visto a personas ordinarias lograr resultados extraordinarios cuando abrazan estos principios.`,
        long: `¡Hoy marca el comienzo de tu transformación a través de ${topic}! 🚀 Creo en tu potencial porque he sido testigo del increíble poder de la determinación humana. Cada experto fue una vez un principiante que se negó a rendirse.`,
        very_long: `¡Este es tu momento de transformación con ${topic}! 🌈 Comparto esto con profunda convicción porque he visto vidas cambiadas, sueños realizados y metas imposibles alcanzadas. Tu historia de éxito comienza aquí, hoy.`
      },
      'Storytelling': {
        short: `Déjame contarte una historia sobre ${topic} que cambió todo... 📖 Fue un momento que cambió toda mi perspectiva.`,
        medium: `Imagínate esto: Son las 2 AM, estoy mirando la pantalla de mi computadora, completamente frustrado con ${topic}. 😤 Nada funcionaba. Entonces pasó algo que cambió todo.`,
        long: `Quiero llevarte de vuelta a un momento crucial en mi viaje con ${topic}. 🎬 Fue uno de esos días cuando todo parecía salir mal. Había probado cada estrategia, seguido cada consejo de expertos.`,
        very_long: `Reúnanse, porque estoy a punto de compartir la historia completa de mi transformación con ${topic}: las luchas, los fracasos, los momentos de revelación y el triunfo final. 📚 Esta no es solo una guía práctica; es un viaje de resistencia humana.`
      },
      'Persuasive': {
        short: `¡Aquí está por qué ${topic} es absolutamente crítico para tu éxito ahora mismo! ⚡ Los datos son innegables y la oportunidad es masiva.`,
        medium: `¡Te voy a demostrar por qué ${topic} no es solo importante, es esencial para tu éxito futuro! 🔥 Las estadísticas son asombrosas: las personas que dominan esto ven resultados 5 veces mejores.`,
        long: `¡Permíteme presentar el caso convincente de por qué ${topic} debería ser tu prioridad #1 ahora mismo! 💪 La evidencia es abrumadora: cada persona exitosa en este campo ha dominado estos principios.`,
        very_long: `¡Estoy a punto de hacer el argumento más convincente que jamás hayas escuchado para dominar ${topic}! 🎯 La investigación es clara, los resultados están probados y la oportunidad es sin precedentes.`
      }
    },
    'chinese': {
      'Conversational': {
        short: `朋友们！我要告诉你们关于${topic}的一件事，这会改变你们的生活！😊 简单得让你们惊讶。`,
        medium: `嘿，对${topic}感到困惑吗？今天我来为大家澄清一切！🤗 说实话，我以前也犯过这个错误。但当我发现真相时，一切都变得清晰了。让我们一步步来理解。`,
        long: `兄弟们，谈到${topic}我就激动！💝 我见过人们在这方面的挣扎，就像我以前一样。起初我以为这很复杂，但事实是我们把它弄得比必要的更难。今天我要分享我经过多年努力学到的所有秘密。第一 - 基础必须牢固。第二 - 坚持是最重要的。`,
        very_long: `朋友们，今天我要分享${topic}的完整旅程！🌟 这既感人又有教育意义。我会告诉你们我是如何开始的，如何犯错误，如何学习，以及你们如何也能成功。相信我，如果我能做到，你们也能！起初我完全是个新手，什么都不知道。但慢慢地，通过练习，从错误中学习，寻求专家指导，我掌握了这个。今天我要教你们所有真正有效的技巧。`
      },
      'Professional': {
        short: `${topic}为行业领导者提供了关键的战略优势。💼 这种数据驱动的方法能够提供可衡量的结果。`,
        medium: `我们对${topic}的综合分析揭示了重要的市场机会。📈 研究表明，85%的组织未充分利用这一战略框架。`,
        long: `今天我们对${topic}及其对组织绩效的影响进行深入分析。🎯 通过广泛的研究和与行业思想领袖的合作，我们确定了区分市场领导者和竞争对手的关键绩效指标。`,
        very_long: `我们正在基于15年以上的行业研究和高管咨询，开发${topic}掌握的综合战略框架。🏆 这种方法论包括战略规划、实施路线图、绩效优化、风险管理、利益相关者协调和可持续增长模型。`
      },
      'Witty': {
        short: `${topic}不是火箭科学，但我们都把它当作脑外科手术！😂 这里是大家都错过的搞笑简单真相。`,
        medium: `所以${topic}基本上就像组装宜家家具 - 说明书就在那里，但我们都认为自己太聪明了不需要看！🤣`,
        long: `我们与${topic}的关系...很复杂！😅 就像那个我们一直试图理解但总是更加困惑的前任。`,
        very_long: `欢迎来到${topic}喜剧秀！🎭 这是我们都有爱恨关系的话题。先爱它，然后恨它，然后再试图让它工作。`
      },
      'Inspirational': {
        short: `${topic}是你转变的门户！✨ 这个单一洞察有能力完全改变你的轨迹。`,
        medium: `你与${topic}的旅程今天开始，我在这里告诉你 - 你有能力做出不可思议的事情！🌟 我见过普通人在接受这些原则时取得非凡成果。`,
        long: `今天标志着你通过${topic}转变的开始！🚀 我相信你的潜力，因为我见证了人类决心的不可思议力量。每个专家都曾是拒绝放弃的初学者。`,
        very_long: `这是你与${topic}转变的时刻！🌈 我怀着深深的信念分享这个，因为我见过生活改变，梦想实现，不可能的目标达成。你的成功故事从这里开始。`
      },
      'Storytelling': {
        short: `让我告诉你一个关于${topic}改变一切的故事...📖 那是一个改变我整个视角的时刻。`,
        medium: `想象一下：凌晨2点，我盯着电脑屏幕，对${topic}完全沮丧。😤 什么都不起作用。然后发生了改变一切的事情。`,
        long: `我想带你回到我${topic}旅程中的关键时刻。🎬 那是一切似乎都出错的日子之一。我尝试了每种策略，遵循了每个专家的建议。`,
        very_long: `聚集起来，因为我即将分享我${topic}转变的完整故事 - 挣扎、失败、突破时刻和最终胜利。📚 这不仅仅是操作指南；这是人类韧性的旅程。`
      },
      'Persuasive': {
        short: `这就是为什么${topic}对你现在的成功绝对关键！⚡ 数据不可否认，机会巨大。`,
        medium: `我将向你证明为什么${topic}不仅重要 - 它对你未来的成功至关重要！🔥 统计数据令人震惊：掌握这个的人看到5倍更好的结果。`,
        long: `让我为你呈现为什么${topic}应该是你现在第一优先级的令人信服的案例！💪 证据压倒性 - 这个领域的每个成功人士都掌握了这些原则。`,
        very_long: `我即将为掌握${topic}做出你听过的最有说服力的论证！🎯 研究清楚，结果已证明，机会前所未有。我们生活在一个独特的时刻。`
      }
    }
  };
  
  // Get content for the specified language and tone
  if (contentTemplates[language] && contentTemplates[language][tone] && contentTemplates[language][tone][length]) {
    return contentTemplates[language][tone][length];
  }
  
  // Fallback to English content generation
  return generateEnglishContent(topic, tone, length, targetWords);
}

// Helper functions for content generation
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

// English content generation function with proper scaling
function generateEnglishContent(topic, tone, length, targetWords) {
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

// Function to expand content to meet target word count
function expandContent(baseContent, topic, tone, language, targetWords) {
  const currentWords = baseContent.split(' ').length;
  const wordsNeeded = targetWords - currentWords;
  
  if (wordsNeeded <= 0) return baseContent;
  
  // Generate additional content based on tone and language
  const expansions = {
    'english': {
      'Conversational': [
        `Let me break this down for you step by step.`,
        `Here's what I've learned from my experience with ${topic}.`,
        `The key thing to remember about ${topic} is consistency and patience.`,
        `I want to share some practical tips that actually work.`,
        `This approach has helped thousands of people just like you.`
      ],
      'Professional': [
        `Our research indicates significant opportunities in this area.`,
        `Industry analysis reveals key performance indicators for success.`,
        `Strategic implementation requires systematic methodology and clear metrics.`,
        `Best practices demonstrate measurable improvements in outcomes.`,
        `Data-driven approaches yield consistently superior results.`
      ],
      'Witty': [
        `But seriously, let's talk about what actually works here.`,
        `I know, I know - everyone says that, but hear me out.`,
        `Plot twist: it's actually simpler than you think.`,
        `Here's the part where I drop some knowledge bombs.`,
        `Trust me, I've made all the mistakes so you don't have to.`
      ],
      'Inspirational': [
        `You have everything within you to succeed at this.`,
        `Every expert was once a beginner who refused to give up.`,
        `Your journey with ${topic} is just beginning, and it's going to be amazing.`,
        `Believe in yourself - you're capable of incredible things.`,
        `This is your moment to transform and grow.`
      ],
      'Storytelling': [
        `Let me tell you what happened next in my journey.`,
        `The turning point came when I realized something important.`,
        `This story gets even more interesting from here.`,
        `What I discovered next completely changed my perspective.`,
        `The lessons I learned from this experience were invaluable.`
      ],
      'Persuasive': [
        `The evidence is overwhelming and the results speak for themselves.`,
        `Here's why this matters more than you might think.`,
        `The data clearly shows the impact of this approach.`,
        `This isn't just theory - it's proven by real results.`,
        `The opportunity cost of not acting is simply too high.`
      ]
    },
    'hindi': {
      'Conversational': [
        `मैं आपको step by step बताता हूं कि कैसे करना है।`,
        `${topic} के साथ मेरा experience share करता हूं।`,
        `सबसे important बात है patience और consistency।`,
        `ये practical tips हैं जो actually काम करती हैं।`,
        `हजारों लोगों की इससे help हुई है।`
      ],
      'Professional': [
        `हमारी research में significant opportunities दिखी हैं।`,
        `Industry analysis से key performance indicators clear हैं।`,
        `Strategic implementation के लिए systematic approach चाहिए।`,
        `Best practices से measurable improvements होते हैं।`,
        `Data-driven approach से consistently better results मिलते हैं।`
      ]
    }
  };
  
  const langExpansions = expansions[language] || expansions['english'];
  const toneExpansions = langExpansions[tone] || langExpansions['Conversational'];
  
  // Add expansions until we reach target word count
  let expandedContent = baseContent;
  let addedWords = 0;
  
  for (let i = 0; i < toneExpansions.length && addedWords < wordsNeeded; i++) {
    const expansion = toneExpansions[i];
    const expansionWords = expansion.split(' ').length;
    
    if (addedWords + expansionWords <= wordsNeeded + 10) { // Allow slight overflow
      expandedContent += ' ' + expansion;
      addedWords += expansionWords;
    }
  }
  
  return expandedContent;
}

// Content scaling functions for different durations
function generateShortContent(baseContent, topic, language, targetWords) {
  return generateContentByLanguageAndTone(language, topic, 'Conversational', 'short', targetWords);
}

function generateMediumContent(baseContent, topic, language, targetWords) {
  return generateContentByLanguageAndTone(language, topic, 'Conversational', 'medium', targetWords);
}

function generateLongContent(baseContent, topic, language, targetWords) {
  return generateContentByLanguageAndTone(language, topic, 'Conversational', 'long', targetWords);
}

function generateVeryLongContent(baseContent, topic, language, targetWords) {
  return generateContentByLanguageAndTone(language, topic, 'Conversational', 'very_long', targetWords);
}

// Main content generation function with proper duration scaling
function generateMainContent(scriptType, tone, topic, wordLimits, language) {
  const targetWords = wordLimits.target;
  
  // Determine content length based on target words and use proper tone
  let contentLength;
  if (targetWords <= 30) {
    contentLength = 'short';
  } else if (targetWords <= 80) {
    contentLength = 'medium';
  } else if (targetWords <= 200) {
    contentLength = 'long';
  } else {
    contentLength = 'very_long';
  }
  // Generate content in the selected language with proper tone and length
  return generateContentByLanguageAndTone(language, topic, tone, contentLength, targetWords);
}
