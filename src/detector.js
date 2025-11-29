// src/detector.js
// SafeDM - simple rule-based detector (MVP)
// analyze(text) => { score, flags:[{kind,match,weight}], severity }

// We attach the detector to window so injected page scripts can access it.
(function(exports){
  // keyword => weight
  const keywordWeights = {
    // sexualized / body comments
    "nude": 3, "nudes": 3, "boobs": 3, "tits": 3, "sexy": 2, "gorgeous": 1, "hot": 1,
    // contact requests
    "whatsapp": 4, "snapchat": 4, "instagram": 2, "phone": 3, "number": 3, "dm me": 3,
    // location / invite
    "come over": 3, "where are you": 3, "meet": 2, "alone": 2,
    // money / scam
    "paypal": 5, "send money": 5, "lend": 5, "payment": 4,
    // sexual acts / fetish words (example small set)
    "kinky": 3, "bdsm": 3, "submissive": 3
  };

  // helper regex patterns
  const phoneRegex = /\+?\d[\d\s\-\(\)]{5,}\d/; // crude phone number
  const shortLinkRegex = /\b(bit\.ly|tinyurl|goo\.gl|t\.co|bitly)\b/;
  const requestContactRegex = /\b(call me|text me|msg me|dm me|whatsapp me|send me your number|give me your number)\b/;

  function analyze(inputText = "") {
    const result = { score: 0, flags: [], severity: "benign" };
    if (!inputText || typeof inputText !== "string") return result;

    const text = inputText.toLowerCase();

    // keyword matching
    Object.keys(keywordWeights).forEach(k => {
      if (text.includes(k)) {
        result.score += keywordWeights[k];
        result.flags.push({ kind: "keyword", match: k, weight: keywordWeights[k] });
      }
    });

    // regex matches
    if (phoneRegex.test(text)) {
      result.score += 4;
      result.flags.push({ kind: "regex", match: "phone-number", weight: 4 });
    }
    if (shortLinkRegex.test(text)) {
      result.score += 2;
      result.flags.push({ kind: "regex", match: "short-link", weight: 2 });
    }
    if (requestContactRegex.test(text)) {
      result.score += 3;
      result.flags.push({ kind: "regex", match: "request-contact", weight: 3 });
    }

    // heuristic: many emojis + sexual word boosts score (simple)
    const emojiCluster = (text.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}]+/gu) || []).length;
    if (emojiCluster >= 3 && /sexy|hot|gorgeous|kiss|kiss me/.test(text)) {
      result.score += 2;
      result.flags.push({ kind: "heuristic", match: "emoji-sexual-cluster", weight: 2 });
    }

    // severity mapping
    if (result.score >= 8) result.severity = "high";
    else if (result.score >= 5) result.severity = "medium";
    else if (result.score >= 2) result.severity = "low";
    else result.severity = "benign";

    return result;
  }

  // Expose API
  const SafeDMDetector = { analyze };

  // Attach to window (page context). If window not available (node), attach to exports.
  if (typeof window !== 'undefined') {
    try { window.SafeDMDetector = SafeDMDetector; } catch(e){ /* ignore */ }
  }
  if (typeof exports !== 'undefined') {
    exports.SafeDMDetector = SafeDMDetector;
  }

})(typeof module !== 'undefined' ? module.exports : (typeof window !== 'undefined' ? window : {}));
