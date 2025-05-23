function generateDiff(amendments) {
  if (amendments.length === 0) {
    return '<p class="no-changes">No amendments parsed from this section.</p>';
  }

  let html = '<div class="diff-container">';

  amendments.forEach((amendment, index) => {
    html += `<div class="diff-block" data-index="${index + 1}">`;
    html += `<div class="diff-header">Amendment ${index + 1}</div>`;

    switch (amendment.type) {
      case 'replace':
        html += `
          <div class="line deletion">
            <span class="diff-marker">-</span>
            <span class="diff-content">${escapeHtml(amendment.old)}</span>
          </div>
          <div class="line addition">
            <span class="diff-marker">+</span>
            <span class="diff-content">${escapeHtml(amendment.new)}</span>
          </div>
        `;
        break;

      case 'delete':
        html += `
          <div class="line deletion">
            <span class="diff-marker">-</span>
            <span class="diff-content">${escapeHtml(amendment.old)}</span>
          </div>
        `;
        break;

      case 'insert':
        html += `
          <div class="line context">
            <span class="diff-marker"> </span>
            <span class="diff-content">After: "${escapeHtml(amendment.after)}"</span>
          </div>
          <div class="line addition">
            <span class="diff-marker">+</span>
            <span class="diff-content">${escapeHtml(amendment.new)}</span>
          </div>
        `;
        break;
    }

    html += '</div>';
  });

  html += '</div>';
  return html;
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

module.exports = { generateDiff };
