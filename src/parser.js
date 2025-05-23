function parseAmendments(content) {
  const amendments = [];

  const patterns = {
    // "by striking 'X' and inserting 'Y'"
    strikeAndInsert: /by striking [`"']([^`"']+)[`"'] and inserting [`"']([^`"']+)[`"']/gi,

    // "by striking 'X'" (without replacement)
    strikeOnly: /by striking [`"']([^`"']+)[`"'](?! and inserting)/gi,

    // "by inserting 'X' after/before 'Y'"
    insertAfter: /by inserting [`"']([^`"']+)[`"'] after [`"']([^`"']+)[`"']/gi,

    // "is amended to read as follows"
    amendedToRead: /is amended to read as follows:\s*[`"']([^`"']+)[`"']/gi,

    // Multi-line strikes
    complexStrike: /by striking [`"']([\s\S]+?)[`"'];?\s*and/gi
  };

  // Process each pattern
  let match;
  while (match = patterns.strikeAndInsert.exec(content)) {
    amendments.push({
      type: 'replace',
      old: cleanText(match[1]),
      new: cleanText(match[2]),
      position: match.index
    });
  }

  while (match = patterns.strikeOnly.exec(content)) {
    amendments.push({
      type: 'delete',
      old: cleanText(match[1]),
      position: match.index
    });
  }

  while (match = patterns.insertAfter.exec(content)) {
    amendments.push({
      type: 'insert',
      new: cleanText(match[1]),
      after: cleanText(match[2]),
      position: match.index
    });
  }

  // Sort by position
  amendments.sort((a, b) => a.position - b.position);

  return amendments;
}

function cleanText(text) {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/``/g, '"')
    .replace(/''/g, '"');
}

module.exports = { parseAmendments };
