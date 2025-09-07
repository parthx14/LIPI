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

function generateMainContent(scriptType, tone, topic, targetWords, language) {
  const contentTemplates = {
    'english': {
      'YouTube Video': {
        'Conversational': {
          short: `${topic} simplified: Here's the one thing that changes everything. Most people completely miss this core principle, but once you get it, everything clicks.`,
          medium: `Let me break down ${topic} in a way that actually makes sense. The biggest mistake people make? They focus on complicated strategies instead of mastering the basics. Here's what really works: start with the foundation, then build up systematically.`,
          long: `I'm going to explain ${topic} in a conversational way that you can actually apply. Most people approach this completely backwards - they jump into advanced tactics without understanding the fundamentals. Here's the truth: ${topic} isn't about following complex formulas. It's about understanding the core principles and applying them consistently. The secret is to focus on one key element at a time, master it, then move to the next level.`
        },
        'Professional': {
          short: `${topic} analysis: The critical factor most professionals overlook is systematic implementation of core methodologies.`,
          medium: `Our research on ${topic} reveals a significant gap in current approaches. Industry leaders consistently emphasize foundational principles over tactical execution. The data shows that organizations focusing on systematic implementation achieve 3x better results.`,
          long: `Based on comprehensive analysis of ${topic}, we've identified key performance indicators that separate successful implementations from failed attempts. The primary differentiator is not technological sophistication, but rather adherence to proven methodological frameworks. Organizations that prioritize systematic approach development, stakeholder alignment, and measurable outcome tracking consistently outperform those focused solely on tactical execution.`
        },
        'Witty': {
          short: `${topic} is like trying to assemble IKEA furniture - everyone thinks they can skip the instructions until they're crying over a pile of screws.`,
          medium: `Here's the thing about ${topic} - it's simpler than rocket science but somehow everyone treats it like brain surgery. The secret sauce? Stop overthinking it. Most people are out here playing 4D chess when it's really just checkers with extra steps.`,
          long: `Let me tell you about ${topic} - it's the digital equivalent of trying to fold a fitted sheet. Everyone pretends they know what they're doing, but we're all just winging it and hoping for the best. The truth is, ${topic} isn't actually that complicated. We just make it complicated because simple solutions don't make us feel smart enough. Here's the plot twist: the most successful people in ${topic} are the ones who figured out how to make it ridiculously simple.`
        }
      },
      'TikTok/Reels': {
        'Conversational': {
          short: `${topic} in 60 seconds: Stop doing what everyone else is doing. Here's the hack that actually works.`,
          medium: `Real talk about ${topic} - everyone's making it way harder than it needs to be. The game-changer? Focus on this one thing instead of trying to do everything at once.`,
          long: `Okay, let's talk ${topic} because I see people struggling with this every day. Here's what nobody tells you: you don't need to be perfect, you just need to be consistent. The biggest mistake? Trying to copy what works for others instead of finding what works for YOU. Start small, stay consistent, and watch everything change.`
        },
        'Witty': {
          short: `${topic} be like: "I'm not like other strategies, I'm a cool strategy." Spoiler alert: it's not that special.`,
          medium: `POV: You're trying to master ${topic} but it's giving you main character energy when you're clearly the comic relief. Here's how to actually win at this game.`,
          long: `${topic} really said "let me be the most confusing thing ever" and we all just accepted that. But here's the tea - it's actually not that deep. Everyone's out here making it sound like you need a PhD when really you just need common sense and the ability to not overthink everything.`
        }
      }
    },
    'hindi': {
      'YouTube Video': {
        'Conversational': {
          short: `${topic} को सरल बनाया गया: यह एक चीज़ है जो सब कुछ बदल देती है। ज्यादातर लोग इस मूल सिद्धांत को पूरी तरह से miss कर देते हैं।`,
          medium: `मैं आपको ${topic} के बारे में समझाता हूं। सबसे बड़ी गलती यह है कि लोग जटिल रणनीतियों पर focus करते हैं बुनियादी बातों को master करने के बजाय। यहाँ है जो वास्तव में काम करता है।`,
          long: `मैं आपके लिए ${topic} को इस तरह से explain करूंगा जो conversational और practical दोनों है। ज्यादातर लोग इसे बिल्कुल गलत तरीके से approach करते हैं। वे fundamentals को समझे बिना advanced tactics में jump कर जाते हैं। सच्चाई यह है कि ${topic} जटिल formulas follow करने के बारे में नहीं है। यह core principles को समझने और उन्हें consistently apply करने के बारे में है।`
        },
        'Professional': {
          short: `${topic} विश्लेषण: वह महत्वपूर्ण कारक जिसे अधिकांश professionals नजरअंदाज करते हैं वह है core methodologies का systematic implementation।`,
          medium: `${topic} पर हमारे research से current approaches में एक significant gap का पता चलता है। Industry leaders consistently foundational principles पर tactical execution से ज्यादा emphasis देते हैं।`,
          long: `${topic} के comprehensive analysis के आधार पर, हमने key performance indicators की पहचान की है जो successful implementations को failed attempts से अलग करते हैं। Primary differentiator technological sophistication नहीं है, बल्कि proven methodological frameworks का adherence है।`
        },
        'Witty': {
          short: `${topic} IKEA furniture assemble करने जैसा है - सभी को लगता है कि वे instructions skip कर सकते हैं जब तक वे screws के pile पर रो नहीं रहे।`,
          medium: `${topic} के बारे में बात यह है - यह rocket science से simple है लेकिन किसी तरह सभी इसे brain surgery की तरह treat करते हैं। Secret sauce? Overthinking बंद करो।`,
          long: `मैं आपको ${topic} के बारे में बताता हूं - यह fitted sheet fold करने के digital equivalent जैसा है। सभी pretend करते हैं कि वे जानते हैं कि क्या कर रहे हैं, लेकिन हम सभी बस wing कर रहे हैं।`
        }
      },
      'TikTok/Reels': {
        'Conversational': {
          short: `${topic} 60 seconds में: वह करना बंद करो जो बाकी सब कर रहे हैं। यहाँ है hack जो actually काम करता है।`,
          medium: `${topic} के बारे में real talk - सभी इसे जरूरत से ज्यादा hard बना रहे हैं। Game-changer? इस एक चीज़ पर focus करो।`,
          long: `ठीक है, ${topic} के बारे में बात करते हैं क्योंकि मैं लोगों को इसके साथ daily struggle करते देखता हूं। यहाँ है जो कोई नहीं बताता: आपको perfect होने की जरूरत नहीं, बस consistent होने की जरूरत है।`
        }
      }
    },
    'chinese': {
      'YouTube Video': {
        'Conversational': {
          short: `${topic}简化版：这是改变一切的关键。大多数人完全错过了这个核心原则。`,
          medium: `让我快速为您分解${topic}。最大的错误：人们专注于复杂策略而不是掌握基础知识。这是真正有效的方法。`,
          long: `我将以对话的方式为您解释${topic}，您可以实际应用。大多数人的方法完全错误 - 他们在不理解基础的情况下跳到高级策略。真相是：${topic}不是关于遵循复杂公式，而是关于理解核心原则并持续应用它们。`
        }
      }
    },
    'arabic': {
      'YouTube Video': {
        'Conversational': {
          short: `${topic} مبسط: هذا هو الشيء الوحيد الذي يغير كل شيء. معظم الناس يفوتون هذا المبدأ الأساسي تماماً.`,
          medium: `دعني أشرح لك ${topic} بسرعة. أكبر خطأ: الناس يركزون على استراتيجيات معقدة بدلاً من إتقان الأساسيات. هذا ما يعمل حقاً.`,
          long: `سأشرح لك ${topic} بطريقة محادثة يمكنك تطبيقها فعلياً. معظم الناس يتعاملون مع هذا بشكل خاطئ تماماً - يقفزون إلى تكتيكات متقدمة دون فهم الأساسيات. الحقيقة هي: ${topic} ليس عن اتباع صيغ معقدة، بل عن فهم المبادئ الأساسية وتطبيقها باستمرار.`
        }
      }
    },
    'telugu': {
      'YouTube Video': {
        'Conversational': {
          short: `${topic} సరళీకరణ: ఇది అన్నింటినీ మార్చే ఒకే విషయం. చాలా మంది ఈ ప్రాథమిక సూత్రాన్ని పూర్తిగా మిస్ చేస్తారు.`,
          medium: `నేను మీకు ${topic} గురించి త్వరగా వివరిస్తాను. అతిపెద్ద తప్పు: ప్రజలు ప్రాథమిక విషయాలను మాస్టర్ చేయడానికి బదులుగా సంక్లిష్ట వ్యూహాలపై దృష్టి పెడతారు.`,
          long: `నేను మీ కోసం ${topic}ని సంభాషణాత్మక మరియు ఆచరణాత్మక రీతిలో వివరిస్తాను. చాలా మంది దీనిని పూర్తిగా తప్పుగా చేరుకుంటారు - వారు ప్రాథమికాలను అర్థం చేసుకోకుండా అధునాతన వ్యూహాలకు దూకుతారు.`
        }
      }
    },
    'marathi': {
      'YouTube Video': {
        'Conversational': {
          short: `${topic} सरळीकृत: ही एक गोष्ट आहे जी सर्वकाही बदलते. बहुतेक लोक हे मूलभूत तत्त्व पूर्णपणे चुकवतात.`,
          medium: `मी तुम्हाला ${topic} बद्दल त्वरीत सांगतो. सर्वात मोठी चूक: लोक मूलभूत गोष्टींमध्ये प्रभुत्व मिळवण्याऐवजी जटिल रणनीतींवर लक्ष केंद्रित करतात.`,
          long: `मी तुमच्यासाठी ${topic} संभाषणात्मक आणि व्यावहारिक अशा पद्धतीने स्पष्ट करेन. बहुतेक लोक याकडे पूर्णपणे चुकीच्या पद्धतीने जातात - ते मूलभूत गोष्टी न समजता प्रगत तंत्रांकडे उडी मारतात.`
        }
      }
    },
    'spanish': {
      'YouTube Video': {
        'Conversational': {
          short: `${topic} simplificado: Lo único que lo cambia todo. La mayoría se pierde este principio fundamental completamente.`,
          medium: `Te explico ${topic} rápidamente. El error más grande: la gente se enfoca en estrategias complicadas en lugar de dominar lo básico.`,
          long: `Te voy a explicar ${topic} de manera práctica y entendible. La mayoría lo enfoca completamente al revés - saltan a tácticas avanzadas sin entender los fundamentos. La verdad es: ${topic} no se trata de seguir fórmulas complejas. Se trata de entender los principios básicos y aplicarlos consistentemente.`
        }
      }
    }
  };

  const langTemplates = contentTemplates[language] || contentTemplates['english'];
  const scriptTemplates = langTemplates[scriptType] || langTemplates['YouTube Video'];
  const toneTemplates = scriptTemplates[tone] || scriptTemplates['Conversational'];

  if (targetWords <= 50) {
    return toneTemplates.short || getDefaultContent(language, topic, 'short');
  } else if (targetWords <= 100) {
    return toneTemplates.medium || getDefaultContent(language, topic, 'medium');
  } else {
    return toneTemplates.long || getDefaultContent(language, topic, 'long');
  }
}

function getDefaultContent(language, topic, length) {
  const defaults = {
    'hindi': {
      short: `${topic} को सरल बनाया गया: यह मुख्य insight है जो सब कुछ बदल देती है। ज्यादातर लोग इस fundamental principle को पूरी तरह से miss कर देते हैं।`,
      medium: `मैं आपको ${topic} के बारे में जल्दी से बताता हूं। मुख्य insight: ज्यादातर लोग इसे गलत तरीके से approach करते हैं। वे tactics पर focus करते हैं, fundamentals पर नहीं।`,
      long: `मैं आपके लिए ${topic} को इस तरह से explain करूंगा जो actionable हो। मुख्य बात यह समझना है कि ज्यादातर लोग इसे बिल्कुल गलत तरीके से approach करते हैं। वे surface-level tactics पर focus करते हैं fundamental principles को समझने के बजाय।`
    },
    'spanish': {
      short: `${topic} simplificado: Esta es la clave que lo cambia todo. La mayoría de la gente se pierde este principio fundamental completamente.`,
      medium: `Te explico ${topic} rápidamente. La clave: la mayoría lo enfoca mal. Se enfocan en tácticas, no en fundamentos.`,
      long: `Te voy a explicar ${topic} de manera práctica. Lo clave es entender que la mayoría lo enfoca completamente mal. Se enfocan en tácticas superficiales en lugar de entender los principios fundamentales.`
    },
    'chinese': {
      short: `${topic}简化版：这是改变一切的关键洞察。大多数人完全错过了这个基本原则。`,
      medium: `让我快速为您分解${topic}。关键洞察：大多数人方法错误。他们专注于策略，而不是基础。`,
      long: `我将以实用的方式为您解释${topic}。关键是要理解大多数人的方法完全错误。他们专注于表面策略，而不是理解基本原则。`
    },
    'arabic': {
      short: `${topic} مبسط: هذه هي الرؤية الأساسية التي تغير كل شيء. معظم الناس يفوتون هذا المبدأ الأساسي تماماً.`,
      medium: `دعني أشرح لك ${topic} بسرعة. الرؤية الأساسية: معظم الناس يتعاملون مع هذا بشكل خاطئ. يركزون على التكتيكات، وليس الأساسيات.`,
      long: `سأشرح لك ${topic} بطريقة عملية. المفتاح هو فهم أن معظم الناس يتعاملون مع هذا بشكل خاطئ تماماً. يركزون على تكتيكات سطحية بدلاً من فهم المبادئ الأساسية.`
    }
  };
  
  return defaults[language]?.[length] || `${topic} simplified: The key insight that changes everything. Most people miss this fundamental principle completely.`;
}
