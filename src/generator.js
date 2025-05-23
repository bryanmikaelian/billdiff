const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');
const { parseAmendments } = require('./parser');
const { generateDiff } = require('./differ');

class LegislativeDiffGenerator {
  constructor() {
    this.contentDir = path.join(__dirname, '..', 'content', 'bills');
    this.templatesDir = path.join(__dirname, '..', 'templates');
    this.distDir = path.join(__dirname, '..', 'dist');
    this.cssDir = path.join(this.distDir, 'css');
  }

  async build() {
    console.log('🏗️  Building legislative diff site...');

    // Clean and create dist directory
    await fs.emptyDir(this.distDir);
    await fs.ensureDir(this.cssDir);

    // Copy static assets
    await this.copyStaticAssets();

    // Process all bills
    const bills = await this.processBills();

    // Generate index page
    await this.generateIndex(bills);

    console.log('✅ Build complete!');
  }

  async processBills() {
    const billDirs = await fs.readdir(this.contentDir);
    const bills = [];

    for (const billId of billDirs) {
      const billPath = path.join(this.contentDir, billId);
      const stat = await fs.stat(billPath);

      if (stat.isDirectory()) {
        console.log(`📋 Processing bill: ${billId}`);
        const bill = await this.processBill(billId, billPath);
        bills.push(bill);
      }
    }

    return bills;
  }

  async processBill(billId, billPath) {
    // Load bill metadata
    const metadataPath = path.join(billPath, 'metadata.json');
    let metadata = {
      id: billId,
      title: billId.toUpperCase(),
      congress: '119th',
      chamber: 'House',
      number: billId.replace(/[^\d]/g, ''),
      shortTitle: `H.R. ${billId.replace(/[^\d]/g, '')}`
    };

    if (await fs.pathExists(metadataPath)) {
      const customMetadata = await fs.readJson(metadataPath);
      metadata = { ...metadata, ...customMetadata };
    }

    // Process sections
    const sectionsPath = path.join(billPath, 'sections');
    const sectionFiles = glob.sync('*.txt', { cwd: sectionsPath });
    const sections = [];

    // Create bill directory in dist
    const billDistDir = path.join(this.distDir, 'bills', billId);
    await fs.ensureDir(billDistDir);

    for (const sectionFile of sectionFiles) {
      const section = await this.processSection(
        path.join(sectionsPath, sectionFile),
        billId,
        billDistDir
      );
      sections.push(section);
    }

    // Generate bill overview page
    await this.generateBillPage(metadata, sections, billId);

    return {
      ...metadata,
      sections: sections,
      totalChanges: sections.reduce((sum, s) => sum + s.changeCount, 0)
    };
  }

  async processSection(filepath, billId, billDistDir) {
    const content = await fs.readFile(filepath, 'utf-8');
    const filename = path.basename(filepath, '.txt');

    // Extract section metadata
    const metadata = this.extractSectionMetadata(content);

    // Parse amendments
    const changes = parseAmendments(content);

    // Generate diff HTML
    const diffHtml = generateDiff(changes);

    // Generate section page
    const pageHtml = await this.generateSectionPage({
      billId: billId,
      title: metadata.title,
      section: metadata.section,
      content: diffHtml,
      raw: content,
      slug: filename
    });

    // Write section page
    await fs.outputFile(path.join(billDistDir, `${filename}.html`), pageHtml);

    return {
      title: metadata.title,
      section: metadata.section,
      slug: filename,
      changeCount: changes.length,
      url: `/bills/${billId}/${filename}.html`
    };
  }

  extractSectionMetadata(content) {
    const metadata = {};

    // Extract section number and title
    const sectionMatch = content.match(/SEC\.\s+(\d+[A-Z]?)\.\s+(.+?)(?:\n|\.)/);
    if (sectionMatch) {
      metadata.section = `SEC. ${sectionMatch[1]}`;
      metadata.title = sectionMatch[2].trim();
    }

    return metadata;
  }

  async generateIndex(bills) {
    const template = await fs.readFile(
      path.join(this.templatesDir, 'index.html'),
      'utf-8'
    );

    const billCards = bills
      .map(bill => `
        <div class="bill-card">
          <div class="bill-header">
            <h2><a href="/bills/${bill.id}/">${bill.shortTitle}</a></h2>
            <span class="bill-congress">${bill.congress} Congress</span>
          </div>
          <h3>${bill.title}</h3>
          <div class="bill-stats">
            <span class="stat">
              <strong>${bill.sections.length}</strong> sections
            </span>
            <span class="stat">
              <strong>${bill.totalChanges}</strong> total changes
            </span>
          </div>
        </div>
      `)
      .join('\n');

    const html = template.replace('{{bills}}', billCards);
    await fs.outputFile(path.join(this.distDir, 'index.html'), html);
  }

  async generateBillPage(metadata, sections, billId) {
    const template = await fs.readFile(
      path.join(this.templatesDir, 'bill.html'),
      'utf-8'
    );

    const sectionList = sections
      .map(section => `
        <div class="section-item">
          <h3><a href="${section.slug}.html">${section.section}</a></h3>
          <p>${section.title}</p>
          <span class="change-count">${section.changeCount} changes</span>
        </div>
      `)
      .join('\n');

    const html = template
      .replace(/{{billId}}/g, metadata.shortTitle)
      .replace(/{{billTitle}}/g, metadata.title)
      .replace(/{{congress}}/g, metadata.congress)
      .replace('{{sections}}', sectionList)
      .replace('{{sectionCount}}', sections.length)
      .replace('{{totalChanges}}', sections.reduce((sum, s) => sum + s.changeCount, 0));

    await fs.outputFile(
      path.join(this.distDir, 'bills', billId, 'index.html'),
      html
    );
  }

  async generateSectionPage(data) {
    const template = await fs.readFile(
      path.join(this.templatesDir, 'section.html'),
      'utf-8'
    );

    return template
      .replace(/{{billId}}/g, data.billId.toUpperCase())
      .replace(/{{title}}/g, data.title)
      .replace(/{{section}}/g, data.section)
      .replace('{{content}}', data.content)
      .replace('{{raw}}', this.escapeHtml(data.raw));
  }

  async copyStaticAssets() {
    const css = await fs.readFile(
      path.join(this.templatesDir, 'styles.css'),
      'utf-8'
    );
    await fs.outputFile(path.join(this.cssDir, 'styles.css'), css);
  }

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}

// Watch mode for development
if (process.argv.includes('--watch')) {
  const chokidar = require('chokidar');
  const generator = new LegislativeDiffGenerator();

  console.log('👀 Watching for changes...');

  chokidar.watch(['content/**/*', 'templates/**/*'])
    .on('change', async () => {
      console.log('🔄 Rebuilding...');
      await generator.build();
    });

  // Initial build
  generator.build();
} else {
  const generator = new LegislativeDiffGenerator();
  generator.build().catch(console.error);
}
