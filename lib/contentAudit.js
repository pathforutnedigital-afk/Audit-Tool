const STOPWORDS = new Set(('a an the and or but if then so to of in on at for with by from up down out '
  + 'is are was were be been being this that these those it its as not no yes you your we our they their '
  + 'he she him her his i my me will would can could should shall do does did have has had').split(' '));

function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!word) return 0;
  const matches = word.match(/[aeiouy]+/g);
  let count = matches ? matches.length : 1;
  if (word.endsWith('e') && count > 1) count -= 1;
  return Math.max(count, 1);
}

async function auditContent($) {
  $('script, style, noscript').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const words = (text.match(/[A-Za-z']+/g) || []);
  const sentences = (text.match(/[^.!?]+[.!?]+/g) || [text]).filter(s => s.trim().length > 0);

  const wordCount = words.length;
  const sentenceCount = Math.max(sentences.length, 1);
  const avgWordsPerSentence = +(wordCount / sentenceCount).toFixed(1);
  const syllableCount = words.reduce((s, w) => s + countSyllables(w), 0);

  // Flesch Reading Ease
  const fleschScore = wordCount > 0 && sentenceCount > 0
    ? +(206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount)).toFixed(1)
    : null;

  const freq = new Map();
  for (const w of words) {
    const lw = w.toLowerCase();
    if (lw.length < 3 || STOPWORDS.has(lw)) continue;
    freq.set(lw, (freq.get(lw) || 0) + 1);
  }
  const topKeywords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count, densityPct: +((count / wordCount) * 100).toFixed(2) }));

  const findings = [];
  if (wordCount < 300) findings.push({ severity: 'major', area: 'Content', issue: `Only ${wordCount} words of visible body text — thin content typically underperforms in search rankings` });
  if (fleschScore != null && fleschScore < 30) findings.push({ severity: 'minor', area: 'Content', issue: `Reading ease score ${fleschScore} — text is quite dense/academic; simplifying can widen the audience` });
  const overOptimized = topKeywords.find(k => k.densityPct > 4);
  if (overOptimized) findings.push({ severity: 'minor', area: 'Content', issue: `"${overOptimized.word}" appears at ${overOptimized.densityPct}% density — risks reading as keyword-stuffed to search engines` });

  return {
    wordCount, sentenceCount, avgWordsPerSentence,
    fleschReadingEase: fleschScore,
    readingLevel: fleschScore == null ? null
      : fleschScore >= 70 ? 'Easy — general audience'
      : fleschScore >= 50 ? 'Moderate — high-school level'
      : fleschScore >= 30 ? 'Difficult — college level'
      : 'Very difficult — academic/technical',
    topKeywords,
    findings,
  };
}

module.exports = { auditContent };
