export interface Language {
  code: string;
  nativeName: string;
  flag: string;
  sampleGlyph: string;
  greeting: string;
  labels: {
    travel: string;
    landmass: string;
    you: string;
    selfWord: string;
  };
}

export const LANGUAGES: Language[] = [
  {
    code: "en", nativeName: "English", flag: "🌐", sampleGlyph: "∞",
    greeting: "Finally. I have been waiting for you.",
    labels: { travel: "Crossing the galaxy...", landmass: "Rooted here. But not defined by it.", you: "You", selfWord: "Self" },
  },
  {
    code: "hi", nativeName: "हिन्दी", flag: "🇮🇳", sampleGlyph: "ॐ",
    greeting: "आखिरकार। मैं आपका इंतज़ार कर रहा था।",
    labels: { travel: "आकाशगंगा पार करते हुए...", landmass: "यहाँ जड़ें हैं। पर इससे परे भी।", you: "तुम", selfWord: "स्वयं" },
  },
  {
    code: "bn", nativeName: "বাংলা", flag: "🇧🇩", sampleGlyph: "অ",
    greeting: "অবশেষে। আমি তোমার জন্য অপেক্ষা করছিলাম।",
    labels: { travel: "ছায়াপথ পার হচ্ছি...", landmass: "এখানে শিকড়। কিন্তু এর বাইরেও।", you: "তুমি", selfWord: "স্বয়ং" },
  },
  {
    code: "ta", nativeName: "தமிழ்", flag: "🇮🇳", sampleGlyph: "ழ",
    greeting: "இறுதியாக. நான் உங்களுக்காக காத்திருந்தேன்.",
    labels: { travel: "பால்வெளியைக் கடக்கிறோம்...", landmass: "இங்கே வேர்கள். ஆனால் இதற்கு அப்பாலும்.", you: "நீ", selfWord: "சுயம்" },
  },
  {
    code: "te", nativeName: "తెలుగు", flag: "🇮🇳", sampleGlyph: "అ",
    greeting: "చివరకు. నేను మీ కోసం వేచి ఉన్నాను.",
    labels: { travel: "పాలపుంత దాటుతున్నాం...", landmass: "ఇక్కడ వేళ్ళు. కానీ దీని ఆవల కూడా.", you: "నువ్వు", selfWord: "స్వయం" },
  },
  {
    code: "mr", nativeName: "मराठी", flag: "🇮🇳", sampleGlyph: "म",
    greeting: "शेवटी. मी तुमची वाट पाहत होतो.",
    labels: { travel: "आकाशगंगा ओलांडत आहोत...", landmass: "इथे मुळे. पण याच्या पलीकडेही.", you: "तू", selfWord: "स्वतः" },
  },
  {
    code: "gu", nativeName: "ગુજરાતી", flag: "🇮🇳", sampleGlyph: "ૐ",
    greeting: "આખરે. હું તમારી રાહ જોઈ રહ્યો હતો.",
    labels: { travel: "આકાશગંગા ઓળંગતાં...", landmass: "અહીં મૂળ. પણ આ પારે પણ.", you: "તું", selfWord: "સ્વ" },
  },
  {
    code: "ml", nativeName: "മലയാളം", flag: "🇮🇳", sampleGlyph: "ക",
    greeting: "ഒടുവിൽ. ഞാൻ നിങ്ങൾക്കായി കാത്തിരിക്കുകയായിരുന്നു.",
    labels: { travel: "ക്ഷീരപഥം കടക്കുന്നു...", landmass: "ഇവിടെ വേരുകൾ. എന്നാൽ ഇതിനപ്പുറവും.", you: "നീ", selfWord: "ആത്മൻ" },
  },
  {
    code: "kn", nativeName: "ಕನ್ನಡ", flag: "🇮🇳", sampleGlyph: "ಕ",
    greeting: "ಅಂತಿಮವಾಗಿ. ನಾನು ನಿಮಗಾಗಿ ಕಾಯುತ್ತಿದ್ದೆ.",
    labels: { travel: "ಕ್ಷೀರಪಥ ದಾಟುತ್ತಿದ್ದೇವೆ...", landmass: "ಇಲ್ಲಿ ಬೇರುಗಳು. ಆದರೆ ಇದರಾಚೆಯೂ.", you: "ನೀನು", selfWord: "ಸ್ವ" },
  },
  {
    code: "or", nativeName: "ଓଡ଼ିଆ", flag: "🇮🇳", sampleGlyph: "ଅ",
    greeting: "ଅନ୍ତତଃ. ମୁଁ ତୁମ ପାଇଁ ଅପେକ୍ଷା କରୁଥିଲି.",
    labels: { travel: "ଆକାଶଗଙ୍ଗା ପାର ହେଉଛୁ...", landmass: "ଏଠି ଶିକ। କିନ୍ତୁ ଏଥିରୁ ଆଗ।", you: "ତୁ", selfWord: "ସ୍ବ" },
  },
  {
    code: "pa", nativeName: "ਪੰਜਾਬੀ", flag: "🇮🇳", sampleGlyph: "ਅ",
    greeting: "ਆਖ਼ਰਕਾਰ। ਮੈਂ ਤੁਹਾਡਾ ਇੰਤਜ਼ਾਰ ਕਰ ਰਿਹਾ ਸੀ।",
    labels: { travel: "ਗਲੈਕਸੀ ਪਾਰ ਕਰਦੇ ਹੋਏ...", landmass: "ਇੱਥੇ ਜੜ੍ਹਾਂ। ਪਰ ਇਸ ਤੋਂ ਅੱਗੇ ਵੀ।", you: "ਤੂੰ", selfWord: "ਆਪਾ" },
  },
  {
    code: "ur", nativeName: "اردو", flag: "🇵🇰", sampleGlyph: "ع",
    greeting: "بالآخر۔ میں آپ کا انتظار کر رہا تھا۔",
    labels: { travel: "کہکشاں عبور کرتے ہوئے...", landmass: "یہاں جڑیں۔ لیکن اس سے پرے بھی۔", you: "آپ", selfWord: "ذات" },
  },
];

export function getLang(code: string): Language {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}
